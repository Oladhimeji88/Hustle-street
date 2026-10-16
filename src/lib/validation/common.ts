import { z } from 'zod'

/**
 * Shared validation primitives.
 *
 * These schemas are used on both sides of the wire: React Hook Form validates
 * with them in the browser for instant feedback, and every route handler
 * re-validates with the same schema on the server. The client copy is a
 * convenience; the server copy is the one that counts.
 */

export const uuid = z.string().uuid('Invalid identifier')

export const shortText = (min: number, max: number, label = 'This field') =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`)

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254)

/**
 * Password policy.
 *
 * Length is the dominant factor in real-world resistance, so the floor is 10
 * characters rather than the usual 8-with-symbols theatre. We still require a
 * mix, because credential-stuffing lists are full of short lowercase words.
 */
export const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'That password is too long')
  .refine((value) => /[a-z]/.test(value), 'Include a lowercase letter')
  .refine((value) => /[A-Z0-9]/.test(value), 'Include a capital letter or a number')

/** E.164, with Nigerian local formats normalised before validation. */
export const phone = z
  .string()
  .trim()
  .transform((value) => {
    const digits = value.replace(/[^\d+]/g, '')
    if (digits.startsWith('+')) return digits
    if (digits.startsWith('234')) return `+${digits}`
    if (digits.startsWith('0')) return `+234${digits.slice(1)}`
    if (/^[789]\d{9}$/.test(digits)) return `+234${digits}`
    return digits
  })
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid phone number'))

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Usernames must be at least 3 characters')
  .max(24, 'Usernames must be at most 24 characters')
  .regex(/^[a-z0-9_]+$/, 'Use only lowercase letters, numbers and underscores')
  .refine(
    (value) => !RESERVED_USERNAMES.has(value),
    'That username is reserved',
  )

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'support', 'help', 'api', 'auth', 'login',
  'signup', 'settings', 'wallet', 'jobs', 'job', 'messages', 'hustle',
  'hustlestreet', 'official', 'system', 'moderator', 'staff', 'security',
  'billing', 'payments', 'about', 'terms', 'privacy', 'safety', 'me', 'you',
])

export const otpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code')

/** Money always crosses the wire as an integer in minor units. */
export const minorAmount = z
  .number()
  .int('Amount must be a whole number of kobo')
  .nonnegative('Amount cannot be negative')
  .max(1_000_000_000_00, 'That amount is too large')

export const positiveMinorAmount = minorAmount.refine((v) => v > 0, 'Enter an amount')

export const latitude = z.number().min(-90).max(90)
export const longitude = z.number().min(-180).max(180)

export const coordinates = z.object({ lat: latitude, lng: longitude })

export const currencyCode = z.enum(['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES'])

/**
 * Pagination. Capped so a caller cannot ask for 100,000 rows and take the
 * database with them.
 */
export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

/** Comma-separated query param → string array. */
export const csvArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return undefined
    const list = Array.isArray(value) ? value : value.split(',')
    const cleaned = list.map((v) => v.trim()).filter(Boolean)
    return cleaned.length ? cleaned : undefined
  })

export const csvUuidArray = csvArray.pipe(z.array(uuid).max(30).optional())

export const booleanParam = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    if (typeof value === 'boolean') return value
    return value === 'true' || value === '1'
  })

/**
 * Strips characters that carry no meaning in user text but do carry risk:
 * zero-width joiners used to evade moderation, and control characters.
 * Output is still escaped by React on render — this is defence in depth.
 */
export function sanitizeText(input: string): string {
  return input
    // C0/C1 control characters, keeping tab (x09) and newline (x0A).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Zero-width space / non-joiner / joiner and the byte-order mark.
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
}

export const sanitizedText = (min: number, max: number, label?: string) =>
  z.string().transform(sanitizeText).pipe(shortText(min, max, label))

/** File upload constraints, enforced again server-side on the storage path. */
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const

export const ATTACHMENT_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  'application/pdf',
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'video/mp4',
  'video/webm',
] as const

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

export const storagePath = z
  .string()
  .min(1)
  .max(400)
  // Reject traversal and absolute paths outright rather than trying to clean them.
  .refine((value) => !value.includes('..') && !value.startsWith('/'), 'Invalid file path')
