import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { ApiError, ERROR_CODES, fromPostgresError } from './errors'

/**
 * One response envelope for the entire API.
 *
 * Success: { ok: true, data, meta? }
 * Failure: { ok: false, error: { code, message, details? } }
 *
 * The client never has to guess whether it got data or an error, and every
 * failure carries a machine-readable code.
 */

export interface ApiMeta {
  page?: number
  pageSize?: number
  total?: number
  hasMore?: boolean
  [key: string]: unknown
}

export type ApiSuccess<T> = { ok: true; data: T; meta?: ApiMeta }
export type ApiFailure = {
  ok: false
  error: { code: string; message: string; details?: unknown }
}
export type ApiResponseBody<T> = ApiSuccess<T> | ApiFailure

export function ok<T>(data: T, meta?: ApiMeta, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data, ...(meta ? { meta } : {}) }, init)
}

export function created<T>(data: T, meta?: ApiMeta): NextResponse<ApiSuccess<T>> {
  return ok(data, meta, { status: 201 })
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

export function fail(error: ApiError): NextResponse<ApiFailure> {
  const headers = new Headers()
  if (error.retryAfterSeconds) {
    headers.set('Retry-After', String(error.retryAfterSeconds))
  }

  return NextResponse.json(
    {
      ok: false as const,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    },
    { status: error.status, headers },
  )
}

/**
 * Normalises anything thrown inside a route handler into an ApiError.
 *
 * Unexpected errors are logged with their full detail server-side and reduced
 * to a generic message client-side — we never leak a stack trace or an internal
 * table name to a caller.
 */
export function toApiError(error: unknown, context?: string): ApiError {
  if (error instanceof ApiError) return error

  if (error instanceof ZodError) {
    return new ApiError(ERROR_CODES.VALIDATION_ERROR, 'Please check the highlighted fields.', {
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  // Supabase / PostgREST errors are plain objects with a `code`.
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return fromPostgresError(error as { code?: string; message?: string })
  }

  console.error(`[api] unhandled error${context ? ` in ${context}` : ''}`, error)

  return new ApiError(ERROR_CODES.INTERNAL_ERROR, 'Something went wrong. Please try again.')
}

/** Pagination meta from a total count and the current window. */
export function paginationMeta(total: number, page: number, pageSize: number): ApiMeta {
  return {
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  }
}
