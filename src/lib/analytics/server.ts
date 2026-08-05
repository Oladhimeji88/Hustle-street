import 'server-only'

import { publicEnv } from '@/lib/config/env'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sanitizeProperties,
  type AnalyticsEvent,
  type AnalyticsProperties,
} from './events'

// Re-exported so route handlers need only one analytics import.
export { ANALYTICS_EVENTS, budgetBucket, distanceBucket } from './events'
export type { AnalyticsEvent, AnalyticsProperties } from './events'

/**
 * Server-side event tracking.
 *
 * Never throws and never blocks the caller's critical path — an analytics
 * failure must not roll back a job posting or a payment.
 */
export async function track(
  event: AnalyticsEvent,
  options: {
    userId?: string | null
    anonymousId?: string | null
    sessionId?: string | null
    properties?: AnalyticsProperties
    city?: string | null
    countryCode?: string | null
    platform?: string | null
  } = {},
): Promise<void> {
  const properties = sanitizeProperties(options.properties ?? {})

  try {
    const admin = createAdminClient()
    await admin.from('analytics_events').insert({
      event,
      user_id: options.userId ?? null,
      anonymous_id: options.anonymousId ?? null,
      session_id: options.sessionId ?? null,
      properties,
      platform: options.platform ?? 'web',
      city: options.city ?? null,
      country_code: options.countryCode ?? null,
      app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    })
  } catch (error) {
    console.warn('[analytics] failed to record event', { event, error })
  }

  // Optional forwarding. Fire-and-forget with a short timeout.
  if (publicEnv.NEXT_PUBLIC_POSTHOG_KEY) {
    void forwardToPostHog(event, options.userId ?? options.anonymousId ?? 'anonymous', properties)
  }
}

async function forwardToPostHog(
  event: string,
  distinctId: string,
  properties: AnalyticsProperties,
): Promise<void> {
  try {
    await fetch(`${publicEnv.NEXT_PUBLIC_POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: publicEnv.NEXT_PUBLIC_POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: 'hustle-street-server' },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5_000),
    })
  } catch {
    // Deliberately silent: the internal table already has the event.
  }
}
