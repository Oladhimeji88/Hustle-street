import 'server-only'

import { createHash } from 'node:crypto'
import { getServerEnv } from '@/lib/config/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimited } from './errors'

/**
 * Rate limiting.
 *
 * Two backends:
 *   - `postgres` (default) — a shared fixed-window counter, so limits hold
 *     across every serverless instance. This is the only correct choice in
 *     production; a per-instance limiter is trivially bypassed by fanning
 *     requests across cold starts.
 *   - `memory` — a single-process fallback for local development and tests.
 *
 * The database path degrades open: if the counter table is unreachable we allow
 * the request rather than take the whole product down. Abuse is a smaller
 * problem than an outage, and the expensive operations (payments, payouts) have
 * their own hard database-level guards regardless.
 */

export interface RateLimitRule {
  /** Maximum requests inside the window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

export const RATE_LIMITS = {
  // Auth surfaces are the highest-value target for credential stuffing.
  authSignIn: { limit: 8, windowSeconds: 300 },
  authSignUp: { limit: 5, windowSeconds: 3600 },
  authOtp: { limit: 5, windowSeconds: 900 },
  authPasswordReset: { limit: 4, windowSeconds: 3600 },

  // Writes that create content or notify other people.
  jobCreate: { limit: 20, windowSeconds: 3600 },
  jobPublish: { limit: 15, windowSeconds: 3600 },
  applicationCreate: { limit: 30, windowSeconds: 3600 },
  messageSend: { limit: 90, windowSeconds: 60 },
  reportCreate: { limit: 10, windowSeconds: 3600 },
  reviewCreate: { limit: 20, windowSeconds: 3600 },

  // Money. Deliberately tight.
  paymentInitialize: { limit: 12, windowSeconds: 600 },
  payoutRequest: { limit: 5, windowSeconds: 3600 },

  // Read-heavy endpoints, generous but not unbounded.
  search: { limit: 120, windowSeconds: 60 },
  read: { limit: 300, windowSeconds: 60 },
  upload: { limit: 40, windowSeconds: 600 },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitBucket = keyof typeof RATE_LIMITS

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfterSeconds: number
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

const memoryStore = new Map<string, { count: number; expiresAt: number }>()

function memoryLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now()
  const windowMs = rule.windowSeconds * 1000
  const windowStart = Math.floor(now / windowMs) * windowMs
  const storeKey = `${key}:${windowStart}`

  // Opportunistic sweep so the map cannot grow without bound.
  if (memoryStore.size > 10_000) {
    for (const [k, v] of memoryStore) if (v.expiresAt < now) memoryStore.delete(k)
  }

  const entry = memoryStore.get(storeKey) ?? { count: 0, expiresAt: windowStart + windowMs }
  entry.count += 1
  memoryStore.set(storeKey, entry)

  const resetAt = new Date(entry.expiresAt)
  return {
    allowed: entry.count <= rule.limit,
    remaining: Math.max(0, rule.limit - entry.count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
  }
}

// ─── Identity ────────────────────────────────────────────────────────────────

/**
 * Hashes the caller's IP with a server-side pepper.
 *
 * Raw IP addresses are personal data under NDPA/GDPR and we have no product
 * reason to keep them, so only the hash is ever stored or compared.
 */
export function hashIdentifier(value: string): string {
  const env = getServerEnv()
  const pepper = env.FINGERPRINT_PEPPER || env.SUPABASE_SERVICE_ROLE_KEY
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex').slice(0, 32)
}

/** Best-effort client IP behind Vercel / Cloudflare / a generic proxy. */
export function clientIp(request: Request): string {
  const headers = request.headers
  const forwarded = headers.get('x-forwarded-for')
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-real-ip') ??
    (forwarded ? forwarded.split(',')[0]!.trim() : null) ??
    'unknown'
  )
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Consumes one unit from a bucket.
 *
 * Prefer a user id as the identifier when the caller is authenticated — IP
 * limiting alone punishes everyone behind the same NAT, which in Nigeria means
 * an entire office or campus.
 */
export async function checkRateLimit(
  bucket: RateLimitBucket,
  identifier: string,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[bucket]
  const key = `${bucket}:${identifier}`

  if (getServerEnv().RATE_LIMIT_BACKEND === 'memory') {
    return memoryLimit(key, rule)
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    })

    if (error || !data) throw error ?? new Error('rate_limit_hit returned no rows')

    const row = Array.isArray(data) ? data[0] : data
    const resetAt = new Date(row.reset_at)

    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
    }
  } catch (error) {
    // Degrade open — see the note at the top of this file.
    console.error('[rate-limit] backend unavailable, allowing request', { bucket, error })
    return {
      allowed: true,
      remaining: rule.limit,
      resetAt: new Date(Date.now() + rule.windowSeconds * 1000),
      retryAfterSeconds: rule.windowSeconds,
    }
  }
}

/** Throws a 429 ApiError when the bucket is exhausted. */
export async function enforceRateLimit(
  bucket: RateLimitBucket,
  identifier: string,
): Promise<RateLimitResult> {
  const result = await checkRateLimit(bucket, identifier)
  if (!result.allowed) throw rateLimited(result.retryAfterSeconds)
  return result
}

/** Standard headers so clients can back off before being rejected. */
export function rateLimitHeaders(bucket: RateLimitBucket, result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(RATE_LIMITS[bucket].limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
  }
}
