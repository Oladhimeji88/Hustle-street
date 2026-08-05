import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { pushSubscriptionInput } from '@/lib/validation/account'
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/notifications/subscribe — register a Web Push endpoint.
 *
 * Upserts on the endpoint so re-subscribing after a browser rotates its
 * endpoint does not leave dead rows behind, and clears any previous failure
 * marker on the same endpoint.
 */
export const POST = defineRoute(
  { auth: 'required', bodySchema: pushSubscriptionInput, name: 'POST /api/notifications/subscribe' },
  async ({ body, supabase, user, request }) => {
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user!.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: request.headers.get('user-agent'),
        failed_at: null,
        failure_count: 0,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )

    if (error) throw error

    await supabase
      .from('notification_preferences')
      .upsert({ user_id: user!.id, push_enabled: true }, { onConflict: 'user_id' })

    void track(ANALYTICS_EVENTS.PUSH_ENABLED, { userId: user!.id })
    return ok({ subscribed: true })
  },
)

/** DELETE — unsubscribe this device. */
export const DELETE = defineRoute(
  { auth: 'required', bodySchema: pushSubscriptionInput.pick({ endpoint: true }), name: 'DELETE /api/notifications/subscribe' },
  async ({ body, supabase, user }) => {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user!.id)
      .eq('endpoint', body.endpoint)

    return ok({ subscribed: false })
  },
)
