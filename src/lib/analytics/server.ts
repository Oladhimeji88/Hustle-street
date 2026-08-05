import 'server-only'

import { PostHog } from 'posthog-node'
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
 * Never throws, so an analytics failure cannot roll back a job posting or payment.
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

  // PostHog server events require a stable distinct id. Unauthenticated
  // activity remains personless in the internal analytics table rather than
  // being forwarded under a fabricated shared identity.
  const distinctId = options.userId ?? options.anonymousId
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (projectToken && host && distinctId) {
    try {
      const posthog = getPostHogClient(projectToken, host)
      posthog.capture({
        distinctId,
        event,
        properties: { ...properties, $lib: 'hustle-street-server' },
      })
      await posthog.flush()
    } catch {
      // Deliberately silent: the internal table already has the event.
    }
  }
}

let posthogClient: PostHog | undefined

function getPostHogClient(projectToken: string, host: string): PostHog {
  posthogClient ??= new PostHog(projectToken, {
    host,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  })
  return posthogClient
}
