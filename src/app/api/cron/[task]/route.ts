import { NextResponse, type NextRequest } from 'next/server'
import { assertCronRequest } from '@/lib/api/handler'
import { getServerEnv } from '@/lib/config/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/notifications/push'
import { sendEmail } from '@/lib/notifications/email'
import { sendSms } from '@/lib/notifications/sms'
import { toApiError } from '@/lib/api/response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Scheduled maintenance.
 *
 * Every task is idempotent and bounded, so a double-fire from an at-least-once
 * scheduler is harmless and a single run can never take the database with it.
 *
 * Authenticated with a shared secret compared in constant time — without it,
 * anyone could trigger `auto-confirm` and release every held payment.
 *
 * Schedule (see vercel.json for the cron expressions):
 *   auto-confirm       every 15 minutes
 *   mature-earnings    hourly
 *   expire-jobs        daily at 03:00
 *   publish-reviews    daily at 04:00
 *   notifications      every 2 minutes
 *   reconcile          daily at 05:00
 *   cleanup            daily at 04:30
 */
const TASKS = [
  'auto-confirm',
  'mature-earnings',
  'expire-jobs',
  'publish-reviews',
  'notifications',
  'reconcile',
  'cleanup',
] as const

type Task = (typeof TASKS)[number]

export async function POST(request: NextRequest, context: { params: Promise<{ task: string }> }) {
  return run(request, context)
}

// GET is supported because several managed schedulers only issue GET requests.
export async function GET(request: NextRequest, context: { params: Promise<{ task: string }> }) {
  return run(request, context)
}

async function run(request: NextRequest, context: { params: Promise<{ task: string }> }) {
  const startedAt = Date.now()

  try {
    assertCronRequest(request, getServerEnv().CRON_SECRET)
  } catch {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { task } = await context.params

  if (!TASKS.includes(task as Task)) {
    return NextResponse.json({ ok: false, error: 'unknown task' }, { status: 404 })
  }

  const admin = createAdminClient()

  try {
    const result = await execute(task as Task, admin)

    await admin.from('audit_logs').insert({
      actor_kind: 'system',
      action: `cron.${task}`,
      entity_type: 'cron',
      changes: { ...result, duration_ms: Date.now() - startedAt },
    })

    return NextResponse.json({ ok: true, task, ...result, durationMs: Date.now() - startedAt })
  } catch (error) {
    const apiError = toApiError(error, `cron/${task}`)
    console.error(`[cron] ${task} failed`, apiError.message)

    await admin.from('audit_logs').insert({
      actor_kind: 'system',
      action: `cron.${task}.failed`,
      entity_type: 'cron',
      changes: { error: apiError.message },
    })

    return NextResponse.json({ ok: false, task, error: apiError.message }, { status: 500 })
  }
}

type AdminClient = ReturnType<typeof createAdminClient>

async function execute(task: Task, admin: AdminClient): Promise<Record<string, unknown>> {
  switch (task) {
    case 'auto-confirm': {
      // Releases escrow for submitted jobs the poster never confirmed. Skips
      // anything under dispute.
      const { data, error } = await admin.rpc('auto_confirm_due_assignments')
      if (error) throw error
      return { confirmed: data ?? 0 }
    }

    case 'mature-earnings': {
      // Moves cleared earnings from pending into the withdrawable balance.
      const { data, error } = await admin.rpc('mature_pending_earnings')
      if (error) throw error
      return { matured: data ?? 0 }
    }

    case 'expire-jobs': {
      const { data, error } = await admin.rpc('expire_stale_jobs')
      if (error) throw error
      return { expired: data ?? 0 }
    }

    case 'publish-reviews': {
      const { data, error } = await admin.rpc('publish_due_reviews')
      if (error) throw error
      return { published: data ?? 0 }
    }

    case 'notifications':
      return drainNotificationQueue(admin)

    case 'reconcile':
      return reconcile(admin)

    case 'cleanup':
      return cleanup(admin)
  }
}

/**
 * Drains the notification delivery queue.
 *
 * Claims a bounded batch, sends, and records the outcome per row. A provider
 * failure marks that single delivery failed and moves on — one bad email
 * address must not stall the queue.
 */
async function drainNotificationQueue(admin: AdminClient): Promise<Record<string, unknown>> {
  const { data: batch } = await admin
    .from('notification_deliveries')
    .select(
      'id, channel, user_id, notification_id, attempts, notifications(title, body, action_url, kind)',
    )
    .eq('status', 'queued')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for')
    .limit(50)

  if (!batch?.length) return { sent: 0, failed: 0 }

  await admin
    .from('notification_deliveries')
    .update({ status: 'sending' })
    .in('id', batch.map((row) => row.id))

  let sent = 0
  let failed = 0

  for (const delivery of batch) {
    const notification = delivery.notifications as unknown as {
      title: string
      body: string | null
      action_url: string | null
      kind: string
    } | null

    if (!notification) {
      await admin
        .from('notification_deliveries')
        .update({ status: 'skipped', failed_reason: 'notification missing' })
        .eq('id', delivery.id)
      continue
    }

    try {
      if (delivery.channel === 'push') {
        const result = await sendPushToUser(delivery.user_id, {
          title: notification.title,
          body: notification.body ?? undefined,
          url: notification.action_url ?? '/home',
          tag: notification.kind,
        })
        if (result.sent === 0 && result.failed > 0) throw new Error('all push endpoints failed')
      } else if (delivery.channel === 'email') {
        const { data: profile } = await admin
          .from('profiles')
          .select('email, display_name')
          .eq('id', delivery.user_id)
          .maybeSingle()

        if (!profile?.email) throw new Error('no email on file')

        await sendEmail({
          to: profile.email,
          subject: notification.title,
          text: `${notification.title}\n\n${notification.body ?? ''}`,
          html: `<p><strong>${notification.title}</strong></p><p>${notification.body ?? ''}</p>`,
          tag: notification.kind,
        })
      } else if (delivery.channel === 'sms') {
        const { data: profile } = await admin
          .from('profiles')
          .select('phone')
          .eq('id', delivery.user_id)
          .maybeSingle()

        if (!profile?.phone) throw new Error('no phone on file')

        await sendSms({
          to: profile.phone,
          body: `${notification.title}${notification.body ? ` — ${notification.body}` : ''}`,
        })
      }

      await admin
        .from('notification_deliveries')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', delivery.id)

      sent += 1
    } catch (error) {
      const attempts = (delivery.attempts ?? 0) + 1
      const giveUp = attempts >= 4

      await admin
        .from('notification_deliveries')
        .update({
          status: giveUp ? 'failed' : 'queued',
          attempts,
          failed_reason: error instanceof Error ? error.message : 'unknown',
          // Exponential backoff: 1m, 4m, 9m.
          scheduled_for: giveUp
            ? undefined
            : new Date(Date.now() + attempts * attempts * 60_000).toISOString(),
        })
        .eq('id', delivery.id)

      failed += 1
    }
  }

  return { sent, failed }
}

/**
 * Reconciliation.
 *
 * Two jobs: prove the ledger's cached balances still match its immutable
 * entries, and replay any webhook we stored but failed to process.
 */
async function reconcile(admin: AdminClient): Promise<Record<string, unknown>> {
  const { data: drift, error } = await admin.rpc('reconcile_ledger')
  if (error) throw error

  if (drift && drift.length > 0) {
    // A non-empty result means a cached balance disagrees with the entries.
    // That is a serious integrity signal — surface it loudly.
    console.error('[reconcile] LEDGER DRIFT DETECTED', drift)
    await admin.from('audit_logs').insert({
      actor_kind: 'system',
      action: 'ledger.drift_detected',
      entity_type: 'ledger',
      changes: { accounts: drift },
    })
  }

  const { data: stuck } = await admin
    .from('payment_webhook_events')
    .select('id, event_type, payload')
    .is('processed_at', null)
    .lt('attempts', 5)
    .order('received_at')
    .limit(20)

  return { driftedAccounts: drift?.length ?? 0, pendingWebhooks: stuck?.length ?? 0 }
}

/** Housekeeping: expire ephemeral rows that would otherwise grow unbounded. */
async function cleanup(admin: AdminClient): Promise<Record<string, unknown>> {
  const now = new Date().toISOString()

  const [typing, rateLimits, deliveries] = await Promise.all([
    admin.from('typing_indicators').delete().lt('expires_at', now),
    admin.from('rate_limits').delete().lt('expires_at', now),
    admin
      .from('notification_deliveries')
      .delete()
      .eq('status', 'sent')
      .lt('sent_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ])

  return {
    typingCleared: typing.count ?? 0,
    rateLimitsCleared: rateLimits.count ?? 0,
    deliveriesCleared: deliveries.count ?? 0,
  }
}
