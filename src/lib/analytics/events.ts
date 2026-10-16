/**
 * Product analytics.
 *
 * Events are always written to our own `analytics_events` table first — that is
 * the source of truth for funnels and is not subject to an ad-blocker or a
 * vendor outage. Forwarding to PostHog is an optional side effect.
 *
 * Privacy rules baked in here:
 *  - no raw IP addresses
 *  - no precise coordinates (city-level only)
 *  - no free-text user content in properties
 *  - no email or phone
 */

export const ANALYTICS_EVENTS = {
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_VERIFIED: 'account_verified',
  PROFILE_COMPLETED: 'profile_completed',
  ONBOARDING_STEP: 'onboarding_step_completed',

  JOB_CREATED: 'job_created',
  JOB_PUBLISHED: 'job_published',
  JOB_VIEWED: 'job_viewed',
  JOB_SAVED: 'job_saved',
  JOB_SHARED: 'job_shared',
  JOB_CANCELLED: 'job_cancelled',

  SEARCH_PERFORMED: 'search_performed',
  FILTER_APPLIED: 'filter_applied',
  LOCATION_GRANTED: 'location_permission_granted',
  LOCATION_DENIED: 'location_permission_denied',

  APPLICATION_SUBMITTED: 'application_submitted',
  APPLICATION_ACCEPTED: 'application_accepted',
  APPLICATION_DECLINED: 'application_declined',
  APPLICATION_WITHDRAWN: 'application_withdrawn',

  MESSAGE_SENT: 'message_sent',

  PAYMENT_STARTED: 'payment_started',
  PAYMENT_COMPLETED: 'payment_completed',
  PAYMENT_FAILED: 'payment_failed',
  PAYOUT_REQUESTED: 'payout_requested',

  JOB_STARTED: 'job_started',
  JOB_SUBMITTED: 'job_submitted',
  JOB_COMPLETED: 'job_completed',

  REVIEW_SUBMITTED: 'review_submitted',
  DISPUTE_CREATED: 'dispute_created',
  REPORT_CREATED: 'report_created',

  PWA_INSTALLED: 'pwa_installed',
  PUSH_ENABLED: 'push_permission_granted',
  OFFLINE_QUEUED: 'offline_action_queued',
} as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined
}

/**
 * Property allowlist.
 *
 * Anything not on this list is dropped rather than sent. An allowlist means a
 * careless `track(event, job)` cannot leak a description or an address into an
 * analytics pipeline.
 */
const ALLOWED_PROPERTIES = new Set([
  'category', 'category_slug', 'currency', 'budget_bucket', 'urgency',
  'location_kind', 'schedule_kind', 'visibility', 'distance_bucket',
  'result_count', 'sort', 'filter_count', 'step', 'source', 'surface',
  'has_images', 'image_count', 'requirement_count', 'application_count',
  'role', 'intent', 'method', 'provider', 'status', 'reason', 'kind',
  'rating', 'is_first', 'duration_ms', 'city', 'country_code', 'platform',
  'app_version', 'radius_km', 'error_code',
])

export function sanitizeProperties(properties: AnalyticsProperties): AnalyticsProperties {
  const clean: AnalyticsProperties = {}
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(key)) continue
    if (value === undefined) continue
    // Bound string lengths so nothing large sneaks through an allowed key.
    clean[key] = typeof value === 'string' ? value.slice(0, 120) : value
  }
  return clean
}

/**
 * Buckets a money amount instead of recording it exactly.
 *
 * Exact amounts on a small marketplace are close to personally identifying;
 * buckets answer every product question we actually have.
 */
export function budgetBucket(minorAmount: number | null | undefined): string {
  if (minorAmount == null) return 'unknown'
  const major = minorAmount / 100
  if (major < 5_000) return '<5k'
  if (major < 15_000) return '5k-15k'
  if (major < 50_000) return '15k-50k'
  if (major < 150_000) return '50k-150k'
  if (major < 500_000) return '150k-500k'
  return '500k+'
}

/** Same idea for distance. */
export function distanceBucket(meters: number | null | undefined): string {
  if (meters == null) return 'unknown'
  const km = meters / 1000
  if (km < 1) return '<1km'
  if (km < 3) return '1-3km'
  if (km < 10) return '3-10km'
  if (km < 25) return '10-25km'
  return '25km+'
}
