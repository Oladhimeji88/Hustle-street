import { NextResponse, type NextRequest } from 'next/server'
import { getPaymentProvider } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplates } from '@/lib/notifications/email'
import { sendPushToUser } from '@/lib/notifications/push'
import { formatMoney } from '@/lib/money'
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/server'
import type { CurrencyCode } from '@/types/database'

// Must run on Node: signature verification needs `node:crypto` over the raw body.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Paystack webhook.
 *
 * This endpoint is the ONLY thing in the system allowed to say a payment
 * succeeded. Four rules it must never break:
 *
 *  1. Verify the signature over the RAW body before parsing anything.
 *  2. Be idempotent — providers retry, and retries must be free.
 *  3. Record the event before acting on it, so there is always evidence.
 *  4. Return 200 for anything we have successfully stored, even if our own
 *     processing then fails. Returning 5xx makes Paystack retry forever; the
 *     stored event is replayed by our own reconciliation job instead.
 */
export async function POST(request: NextRequest) {
  // `request.text()` must be read before any parsing — re-serialising JSON
  // would change byte order and invalidate the HMAC.
  const rawBody = await request.text()

  const provider = getPaymentProvider('paystack')
  const event = provider.parseWebhook(rawBody, request.headers)

  if (!event) {
    // Do not explain why. An attacker probing the signature check learns nothing.
    console.warn('[webhook] rejected paystack payload with invalid signature')
    return NextResponse.json({ received: false }, { status: 401 })
  }

  const admin = createAdminClient()

  // Idempotency gate: the unique index on (provider, event_id) means a replay
  // conflicts here and is acknowledged without being processed twice.
  const { data: stored, error: insertError } = await admin
    .from('payment_webhook_events')
    .insert({
      provider: 'paystack',
      event_id: event.id,
      event_type: event.type,
      signature_valid: true,
      payload: event.raw,
    })
    .select('id, processed_at')
    .maybeSingle()

  if (insertError) {
    const isDuplicate = insertError.code === '23505'
    if (isDuplicate) return NextResponse.json({ received: true, duplicate: true })

    console.error('[webhook] failed to record event', insertError)
    // Could not store it — ask for a retry, since we have no evidence to replay.
    return NextResponse.json({ received: false }, { status: 500 })
  }

  try {
    await processEvent(admin, event.type, event.raw, stored?.id ?? null)

    await admin
      .from('payment_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', stored!.id)

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('[webhook] processing failed', { eventType: event.type, message })

    await admin
      .from('payment_webhook_events')
      .update({
        processing_error: message,
        attempts: (stored as { attempts?: number } | null)?.attempts ?? 1,
      })
      .eq('id', stored!.id)

    // The evidence is safely stored; the reconciliation cron will retry it.
    // Returning 200 stops Paystack retrying a payload we already hold.
    return NextResponse.json({ received: true, deferred: true })
  }
}

type AdminClient = ReturnType<typeof createAdminClient>

async function processEvent(
  admin: AdminClient,
  eventType: string,
  payload: Record<string, unknown>,
  webhookEventId: string | null,
): Promise<void> {
  const data = (payload.data ?? {}) as Record<string, unknown>

  switch (eventType) {
    case 'charge.success': {
      const reference = String(data.reference ?? '')
      if (!reference) throw new Error('charge.success without a reference')

      const { data: transaction } = await admin
        .from('transactions')
        .select('id, kind, status, amount_minor, currency, assignment_id, payer_id, payee_id, job_id')
        .eq('reference', reference)
        .maybeSingle()

      if (!transaction) {
        // A charge we do not recognise. Store and move on rather than throwing —
        // this happens with test charges and other integrations on the account.
        console.warn('[webhook] charge.success for unknown reference', reference)
        return
      }

      if (webhookEventId) {
        await admin
          .from('payment_webhook_events')
          .update({ transaction_id: transaction.id })
          .eq('id', webhookEventId)
      }

      // The RPC posts the double entry, moves the assignment to active and the
      // job to IN_PROGRESS, all in one transaction. It is idempotent.
      const { error } = await admin.rpc('record_escrow_funding', {
        p_transaction_id: transaction.id,
        p_provider_reference: String(data.id ?? reference),
        p_provider_fee_minor: Number(data.fees ?? 0),
        p_paid_amount_minor: Number(data.amount ?? transaction.amount_minor),
      })

      if (error) throw new Error(`record_escrow_funding failed: ${error.message}`)

      void track(ANALYTICS_EVENTS.PAYMENT_COMPLETED, {
        userId: transaction.payer_id ?? undefined,
        properties: { provider: 'paystack', status: 'success' },
      })

      await notifyPaymentSecured(admin, transaction)
      return
    }

    case 'charge.failed': {
      const reference = String(data.reference ?? '')
      if (!reference) return

      await admin
        .from('transactions')
        .update({
          status: 'FAILED',
          failure_reason: String(data.gateway_response ?? 'Payment failed'),
        })
        .eq('reference', reference)
        .eq('status', 'PENDING')

      void track(ANALYTICS_EVENTS.PAYMENT_FAILED, { properties: { provider: 'paystack' } })
      return
    }

    case 'transfer.success':
    case 'transfer.failed':
    case 'transfer.reversed': {
      const transferCode = String(data.transfer_code ?? '')
      const reference = String(data.reference ?? '')

      const { data: payout } = await admin
        .from('payouts')
        .select('id, status')
        .or(
          [
            transferCode ? `provider_reference.eq.${transferCode}` : null,
            reference ? `reference.eq.${reference}` : null,
          ]
            .filter(Boolean)
            .join(','),
        )
        .maybeSingle()

      if (!payout) {
        console.warn('[webhook] transfer event for unknown payout', { transferCode, reference })
        return
      }

      const succeeded = eventType === 'transfer.success'

      const { error } = await admin.rpc('settle_payout', {
        p_payout_id: payout.id,
        p_success: succeeded,
        p_provider_reference: transferCode || reference,
        p_failure_reason: succeeded
          ? null
          : String(data.reason ?? data.message ?? 'Transfer did not go through'),
      })

      if (error) throw new Error(`settle_payout failed: ${error.message}`)
      return
    }

    case 'refund.processed':
    case 'refund.failed':
      // The ledger already reflects the refund at the moment we initiate it —
      // this event is recorded for reconciliation but changes no balances.
      return

    default:
      // Unhandled event types are stored and ignored on purpose. Paystack adds
      // new ones over time and an unknown type is not an error.
      return
  }
}

async function notifyPaymentSecured(
  admin: AdminClient,
  transaction: {
    assignment_id: string | null
    payer_id: string | null
    payee_id: string | null
    amount_minor: number
    currency: string
    job_id: string | null
  },
): Promise<void> {
  if (!transaction.job_id) return

  const { data: job } = await admin
    .from('jobs')
    .select('title')
    .eq('id', transaction.job_id)
    .maybeSingle()

  const amount = formatMoney(transaction.amount_minor, transaction.currency as CurrencyCode)
  const jobTitle = job?.title ?? 'your job'

  const recipients = [transaction.payer_id, transaction.payee_id].filter(Boolean) as string[]

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, display_name')
    .in('id', recipients)

  for (const person of profiles ?? []) {
    if (person.email) {
      void sendEmail({
        to: person.email,
        ...emailTemplates.paymentSecured({ jobTitle, amount, jobId: transaction.job_id }),
      })
    }
  }

  if (transaction.payee_id) {
    void sendPushToUser(transaction.payee_id, {
      title: 'Payment secured',
      body: `${amount} is held for ${jobTitle}. You can start work.`,
      url: `/jobs/${transaction.job_id}`,
      requireInteraction: true,
    })
  }
}
