/**
 * The error vocabulary.
 *
 * Everything the API can go wrong with maps to one of these codes. The client
 * switches on `code`, never on the message, so wording can change freely and
 * be translated later without breaking behaviour.
 */

export const ERROR_CODES = {
  // 400
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  // 401 / 403
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  PHONE_NOT_VERIFIED: 'PHONE_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  // 404 / 409
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  // 422 — the request was well formed but the domain refused it
  INVALID_STATE: 'INVALID_STATE',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  // 429
  RATE_LIMITED: 'RATE_LIMITED',
  // 5xx
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  EMAIL_NOT_VERIFIED: 403,
  PHONE_NOT_VERIFIED: 403,
  ACCOUNT_SUSPENDED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ALREADY_EXISTS: 409,
  INVALID_STATE: 422,
  INSUFFICIENT_BALANCE: 422,
  LIMIT_EXCEEDED: 422,
  PAYMENT_REQUIRED: 402,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  PROVIDER_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
}

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: unknown
  /** Set when the failure is transient and the client may retry. */
  readonly retryAfterSeconds?: number

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: unknown; status?: number; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.code = code
    this.status = options.status ?? STATUS_BY_CODE[code] ?? 500
    this.details = options.details
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

// ─── Constructors for the common cases ───────────────────────────────────────

export const unauthenticated = (message = 'Please sign in to continue.') =>
  new ApiError(ERROR_CODES.UNAUTHENTICATED, message)

export const forbidden = (message = 'You do not have access to this.') =>
  new ApiError(ERROR_CODES.FORBIDDEN, message)

export const notFound = (what = 'Resource') =>
  new ApiError(ERROR_CODES.NOT_FOUND, `${what} not found.`)

export const invalidState = (message: string) =>
  new ApiError(ERROR_CODES.INVALID_STATE, message)

export const conflict = (message: string) => new ApiError(ERROR_CODES.CONFLICT, message)

export const validationError = (message: string, details?: unknown) =>
  new ApiError(ERROR_CODES.VALIDATION_ERROR, message, { details })

export const rateLimited = (retryAfterSeconds: number) =>
  new ApiError(ERROR_CODES.RATE_LIMITED, 'Too many requests. Please slow down.', {
    retryAfterSeconds,
  })

export const providerError = (message = 'A third-party service failed. Please try again.') =>
  new ApiError(ERROR_CODES.PROVIDER_ERROR, message)

/**
 * Translates a PostgreSQL / PostgREST error into an ApiError.
 *
 * The database is where most business rules are enforced, so its errors are a
 * first-class part of the API surface, not an internal detail to hide behind a
 * generic 500.
 */
export function fromPostgresError(error: {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}): ApiError {
  const message = error.message ?? 'Database error'

  switch (error.code) {
    case '23505': // unique_violation
      return new ApiError(ERROR_CODES.ALREADY_EXISTS, 'That already exists.', {
        details: error.details,
      })
    case '23503': // foreign_key_violation
      return new ApiError(ERROR_CODES.BAD_REQUEST, 'A referenced record does not exist.')
    case '23514': // check_violation
    case '23P01': // exclusion_violation
      return new ApiError(ERROR_CODES.INVALID_STATE, cleanPgMessage(message))
    case '42501': // insufficient_privilege
      return new ApiError(ERROR_CODES.FORBIDDEN, cleanPgMessage(message))
    case 'P0002': // no_data_found
      return new ApiError(ERROR_CODES.NOT_FOUND, cleanPgMessage(message))
    case '2F004': // restrict_violation family — our append-only guards
    case '23001':
      return new ApiError(ERROR_CODES.FORBIDDEN, cleanPgMessage(message))
    case '40001': // serialization_failure
    case '40P01': // deadlock_detected
      return new ApiError(ERROR_CODES.SERVICE_UNAVAILABLE, 'Please try that again.', {
        retryAfterSeconds: 1,
      })
    case 'PGRST116': // PostgREST: no rows for .single()
      return new ApiError(ERROR_CODES.NOT_FOUND, 'Not found.')
    case '42P01':
    case '42703':
      return new ApiError(ERROR_CODES.INTERNAL_ERROR, 'Database schema error.')
    default:
      // RAISE EXCEPTION in our own functions surfaces as P0001 and the message
      // is written for humans, so pass it through.
      if (error.code === 'P0001') {
        return new ApiError(ERROR_CODES.INVALID_STATE, cleanPgMessage(message))
      }
      return new ApiError(ERROR_CODES.INTERNAL_ERROR, 'Something went wrong. Please try again.', {
        details: process.env.NODE_ENV === 'development' ? { code: error.code, message } : undefined,
      })
  }
}

/** Strips PostgreSQL noise so the message reads like product copy. */
function cleanPgMessage(message: string): string {
  return message
    .replace(/^ERROR:\s*/i, '')
    .replace(/\s*\(SQLSTATE.*\)$/i, '')
    .replace(/^new row for relation "\w+" violates check constraint "(\w+)"$/i, (_, constraint) =>
      humaniseConstraint(constraint),
    )
    .trim()
}

/** Turns a constraint name into something a person can act on. */
function humaniseConstraint(constraint: string): string {
  const map: Record<string, string> = {
    jobs_title_length: 'The title must be between 6 and 120 characters.',
    jobs_description_length: 'The description must be between 20 and 5000 characters.',
    jobs_budget_range_ordered: 'The maximum budget must be at least the minimum.',
    jobs_fixed_budget_present: 'A fixed-price job needs a price.',
    jobs_onsite_needs_location: 'An on-site job needs a location.',
    job_applications_message_length: 'Your message must be between 10 and 2000 characters.',
    job_assignments_fee_arithmetic: 'The fee breakdown does not add up.',
    reviews_not_self: 'You cannot review yourself.',
    profiles_username_format:
      'Usernames may only contain lowercase letters, numbers and underscores (3–24 characters).',
  }
  return map[constraint] ?? 'That value is not allowed.'
}
