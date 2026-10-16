import 'server-only'

import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { z } from 'zod'
import type { User } from '@supabase/supabase-js'
import { createClient, getCurrentProfile, getCurrentRoles } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/types/database'
import { ApiError, ERROR_CODES, forbidden, unauthenticated } from './errors'
import { fail, toApiError } from './response'
import {
  clientIp,
  enforceRateLimit,
  hashIdentifier,
  rateLimitHeaders,
  type RateLimitBucket,
} from './rate-limit'

/**
 * Route handler composition.
 *
 * `defineRoute` wraps a handler with the cross-cutting concerns every endpoint
 * needs — authentication, authorization, validation, rate limiting, error
 * shaping and request logging — so an individual route only contains its own
 * business logic. Forgetting one of these is then impossible rather than
 * merely discouraged.
 */

export interface RouteContext<TBody = unknown, TQuery = unknown, TParams = unknown> {
  request: NextRequest
  requestId: string
  body: TBody
  query: TQuery
  params: TParams
  /** Present whenever `auth` is 'required'. */
  user: User | null
  profile: Profile | null
  roles: UserRole[]
  ipHash: string
  supabase: Awaited<ReturnType<typeof createClient>>
}

export interface RouteOptions<TBody, TQuery, TParams> {
  /** 'required' rejects anonymous callers; 'optional' exposes user when present. */
  auth?: 'required' | 'optional' | 'none'
  /** Minimum role. Implies auth: 'required'. */
  role?: UserRole
  /** Reject users whose account is not active. Default true for authed routes. */
  requireActiveAccount?: boolean
  /*
   * The third generic is the schema's INPUT type. Leaving it open means the
   * handler receives the parsed OUTPUT — so `.default()` and `.transform()`
   * fields arrive as required, non-undefined values, which is what the route
   * code actually deals with.
   */
  bodySchema?: z.ZodType<TBody, z.ZodTypeDef, unknown>
  querySchema?: z.ZodType<TQuery, z.ZodTypeDef, unknown>
  paramsSchema?: z.ZodType<TParams, z.ZodTypeDef, unknown>
  rateLimit?: RateLimitBucket
  /** Route name used in logs. Defaults to the pathname. */
  name?: string
}

type Handler<TBody, TQuery, TParams> = (
  ctx: RouteContext<TBody, TQuery, TParams>,
) => Promise<NextResponse> | NextResponse

/**
 * Next.js 15 passes route params as a promise, and always supplies this second
 * argument — including for routes with no dynamic segments, where it resolves
 * to an empty object. It must be required to satisfy Next's generated types.
 */
type NextRouteArgs = { params: Promise<Record<string, string | string[]>> }

const ROLE_RANK: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2, superadmin: 3 }

export function defineRoute<TBody = undefined, TQuery = undefined, TParams = undefined>(
  options: RouteOptions<TBody, TQuery, TParams>,
  handler: Handler<TBody, TQuery, TParams>,
) {
  return async function route(request: NextRequest, args: NextRouteArgs): Promise<NextResponse> {
    const requestId = request.headers.get('x-request-id') ?? randomUUID()
    const started = Date.now()
    const routeName = options.name ?? new URL(request.url).pathname

    try {
      const supabase = await createClient()
      const ipHash = hashIdentifier(clientIp(request))

      // ── Authentication ──────────────────────────────────────────────────
      const authMode = options.role ? 'required' : (options.auth ?? 'none')
      let user: User | null = null
      let profile: Profile | null = null
      let roles: UserRole[] = []

      if (authMode !== 'none') {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        user = authUser

        if (!user && authMode === 'required') throw unauthenticated()

        if (user) {
          profile = await getCurrentProfile()
          roles = await getCurrentRoles()
        }
      }

      // ── Account state ───────────────────────────────────────────────────
      const requireActive = options.requireActiveAccount ?? authMode === 'required'
      if (requireActive && profile) {
        if (profile.status === 'banned' || profile.status === 'deleted') {
          throw new ApiError(
            ERROR_CODES.ACCOUNT_SUSPENDED,
            'This account has been closed. Contact support if you believe this is a mistake.',
          )
        }
        if (profile.status === 'suspended') {
          throw new ApiError(
            ERROR_CODES.ACCOUNT_SUSPENDED,
            profile.suspension_reason
              ? `Your account is suspended: ${profile.suspension_reason}`
              : 'Your account is suspended. Contact support.',
          )
        }
      }

      // ── Authorization ───────────────────────────────────────────────────
      if (options.role) {
        const highest = roles.reduce((max, r) => Math.max(max, ROLE_RANK[r] ?? 0), 0)
        if (highest < ROLE_RANK[options.role]) throw forbidden()
      }

      // ── Rate limiting ───────────────────────────────────────────────────
      let rateHeaders: HeadersInit | undefined
      if (options.rateLimit) {
        // Authenticated callers are limited per user; anonymous ones per IP.
        const identifier = user?.id ?? ipHash
        const result = await enforceRateLimit(options.rateLimit, identifier)
        rateHeaders = rateLimitHeaders(options.rateLimit, result)
      }

      // ── Validation ──────────────────────────────────────────────────────
      let body = undefined as TBody
      if (options.bodySchema) {
        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          throw new ApiError(ERROR_CODES.BAD_REQUEST, 'Expected a JSON body.')
        }
        body = options.bodySchema.parse(raw)
      }

      let query = undefined as TQuery
      if (options.querySchema) {
        const url = new URL(request.url)
        const raw: Record<string, string | string[]> = {}
        for (const key of new Set(url.searchParams.keys())) {
          const values = url.searchParams.getAll(key)
          raw[key] = values.length > 1 ? values : values[0]!
        }
        query = options.querySchema.parse(raw)
      }

      let params = undefined as TParams
      if (options.paramsSchema) {
        params = options.paramsSchema.parse((await args?.params) ?? {})
      } else if (args?.params) {
        params = (await args.params) as TParams
      }

      // ── Handler ─────────────────────────────────────────────────────────
      const response = await handler({
        request,
        requestId,
        body,
        query,
        params,
        user,
        profile,
        roles,
        ipHash,
        supabase,
      })

      response.headers.set('x-request-id', requestId)
      if (rateHeaders) {
        for (const [key, value] of Object.entries(rateHeaders)) response.headers.set(key, value)
      }

      logRequest({ routeName, requestId, status: response.status, ms: Date.now() - started, userId: user?.id })
      return response
    } catch (error) {
      const apiError = toApiError(error, routeName)

      logRequest({
        routeName,
        requestId,
        status: apiError.status,
        ms: Date.now() - started,
        error: apiError.code,
        message: apiError.message,
      })

      const response = fail(apiError)
      response.headers.set('x-request-id', requestId)
      return response
    }
  }
}

function logRequest(entry: {
  routeName: string
  requestId: string
  status: number
  ms: number
  userId?: string
  error?: string
  message?: string
}) {
  // Structured single-line logs so a log drain can parse them without a shipper.
  const level = entry.status >= 500 ? 'error' : entry.status >= 400 ? 'warn' : 'info'
  const payload = JSON.stringify({ t: new Date().toISOString(), level, ...entry })

  if (level === 'error') console.error(payload)
  else if (level === 'warn') console.warn(payload)
  else if (process.env.NODE_ENV !== 'production') console.log(payload)
}

/**
 * Guard for cron endpoints. The scheduler proves itself with a shared secret;
 * without it these routes would let anyone trigger payment releases.
 */
export function assertCronRequest(request: NextRequest, cronSecret: string): void {
  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!cronSecret || !provided || provided.length !== cronSecret.length) {
    throw forbidden('Invalid cron credentials.')
  }

  // Constant-time comparison so the secret cannot be recovered by timing.
  let mismatch = 0
  for (let i = 0; i < cronSecret.length; i++) {
    mismatch |= cronSecret.charCodeAt(i) ^ provided.charCodeAt(i)
  }
  if (mismatch !== 0) throw forbidden('Invalid cron credentials.')
}
