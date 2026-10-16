import 'server-only'

import webpush from 'web-push'
import { getServerEnv, publicEnv } from '@/lib/config/env'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Web Push (VAPID).
 *
 * Delivery is best-effort by design: a push that fails must never fail the
 * operation that triggered it. Subscriptions that the push service reports as
 * gone (404/410) are marked dead so the worker stops wasting requests on them.
 */

let configured = false

function ensureConfigured(): boolean {
  if (configured) return true

  const env = getServerEnv()
  const publicKey = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey || !env.VAPID_PRIVATE_KEY) return false

  webpush.setVapidDetails(env.VAPID_SUBJECT, publicKey, env.VAPID_PRIVATE_KEY)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body?: string
  /** Deep link opened when the notification is tapped. */
  url?: string
  icon?: string
  badge?: string
  image?: string
  /** Collapses same-tag notifications so a chat cannot spam the tray. */
  tag?: string
  /** Notifications the user must see even in a quiet tray. */
  requireInteraction?: boolean
  data?: Record<string, unknown>
}

export interface PushResult {
  sent: number
  failed: number
  removed: number
}

/**
 * Sends a push to every live subscription a user has.
 *
 * Returns counts rather than throwing — callers log and move on.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, removed: 0 }
  if (!ensureConfigured()) return result

  const admin = createAdminClient()
  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .is('failed_at', null)

  if (!subscriptions?.length) return result

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? '',
    url: payload.url ?? '/home',
    icon: payload.icon ?? '/icons/icon-192.png',
    badge: payload.badge ?? '/icons/badge-72.png',
    image: payload.image,
    tag: payload.tag,
    requireInteraction: payload.requireInteraction ?? false,
    data: payload.data ?? {},
  })

  const deadSubscriptionIds: string[] = []

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          { TTL: 60 * 60 * 24, urgency: payload.requireInteraction ? 'high' : 'normal' },
        )
        result.sent += 1
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode

        // 404/410 mean the subscription is permanently gone — the user
        // uninstalled the PWA or revoked permission.
        if (statusCode === 404 || statusCode === 410) {
          deadSubscriptionIds.push(subscription.id)
          result.removed += 1
        } else {
          result.failed += 1
          console.warn('[push] delivery failed', { statusCode, endpoint: subscription.endpoint.slice(0, 60) })
        }
      }
    }),
  )

  if (deadSubscriptionIds.length) {
    await admin
      .from('push_subscriptions')
      .update({ failed_at: new Date().toISOString() })
      .in('id', deadSubscriptionIds)
  }

  // Track successful use so stale-but-alive subscriptions can be pruned later.
  if (result.sent > 0) {
    await admin
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('failed_at', null)
  }

  return result
}

// The browser-side helper lives in ./vapid so this server-only module is
// never pulled into a client bundle.
export { urlBase64ToUint8Array } from './vapid'
