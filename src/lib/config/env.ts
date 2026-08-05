import { z } from 'zod'

/**
 * Environment contract.
 *
 * Two separate schemas: `publicEnv` is inlined into the browser bundle,
 * `serverEnv` is only ever read on the server. Keeping them apart means a
 * secret cannot leak into the client by accident — importing `serverEnv` from a
 * client component is a build error, not a silent disclosure.
 *
 * Both are validated eagerly at module load. A misconfigured deployment fails
 * to boot instead of failing later on a payment.
 */

const appEnvSchema = z.enum(['development', 'staging', 'production'])

// ─── Public (browser-safe) ────────────────────────────────────────────────────

const publicSchema = z.object({
  NEXT_PUBLIC_APP_ENV: appEnvSchema.default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().optional().default(''),
  NEXT_PUBLIC_MAP_TILE_URL: z
    .string()
    .default('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
  NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: z.string().default('© OpenStreetMap contributors'),
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().optional().default(''),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional().default(''),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional().default(''),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional().default('https://eu.i.posthog.com'),
})

// Next.js only inlines `process.env.X` when referenced literally, so the object
// must be spelled out rather than built from a loop.
const rawPublic = {
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  NEXT_PUBLIC_MAP_TILE_URL: process.env.NEXT_PUBLIC_MAP_TILE_URL,
  NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION,
  NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
}

function readPublicEnv() {
  const parsed = publicSchema.safeParse(rawPublic)
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid public environment configuration:\n${detail}`)
  }
  return parsed.data
}

export const publicEnv = readPublicEnv()

export const isProduction = publicEnv.NEXT_PUBLIC_APP_ENV === 'production'
export const isStaging = publicEnv.NEXT_PUBLIC_APP_ENV === 'staging'
export const isDevelopment = publicEnv.NEXT_PUBLIC_APP_ENV === 'development'

// ─── Server-only ──────────────────────────────────────────────────────────────

const serverSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    DATABASE_URL: z.string().optional().default(''),

    PAYMENT_PROVIDER: z.enum(['paystack', 'flutterwave']).default('paystack'),
    PAYSTACK_SECRET_KEY: z.string().optional().default(''),
    PAYSTACK_WEBHOOK_SECRET: z.string().optional().default(''),

    GEOCODING_PROVIDER_URL: z.string().default('https://nominatim.openstreetmap.org'),
    GEOCODING_API_KEY: z.string().optional().default(''),

    VAPID_PRIVATE_KEY: z.string().optional().default(''),
    VAPID_SUBJECT: z.string().optional().default('mailto:support@hustlestreet.ng'),

    EMAIL_PROVIDER: z.enum(['console', 'resend', 'postmark']).default('console'),
    EMAIL_API_KEY: z.string().optional().default(''),
    EMAIL_FROM: z.string().default('Hustle Street <no-reply@hustlestreet.ng>'),

    SMS_PROVIDER: z.enum(['console', 'termii', 'twilio']).default('console'),
    SMS_API_KEY: z.string().optional().default(''),
    SMS_SENDER_ID: z.string().default('HustleSt'),

    CRON_SECRET: z.string().default(''),
    RATE_LIMIT_BACKEND: z.enum(['memory', 'postgres']).default('postgres'),

    // Pepper for hashing IPs and device fingerprints. Falls back to the service
    // role key so a missing value never disables fraud tracking outright.
    FINGERPRINT_PEPPER: z.string().optional().default(''),
  })
  .superRefine((value, ctx) => {
    if (!isProduction) return

    // Production-only invariants. Everything below is a mistake that would be
    // discovered in the worst possible way — a real user's real money.
    if (value.PAYMENT_PROVIDER === 'paystack') {
      if (!value.PAYSTACK_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PAYSTACK_SECRET_KEY'],
          message: 'is required in production',
        })
      } else if (value.PAYSTACK_SECRET_KEY.startsWith('sk_test_')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PAYSTACK_SECRET_KEY'],
          message: 'is a TEST key — production requires a live key',
        })
      }
    }

    if (!value.CRON_SECRET || value.CRON_SECRET.length < 24) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CRON_SECRET'],
        message: 'must be at least 24 characters in production',
      })
    }

    if (value.EMAIL_PROVIDER === 'console') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_PROVIDER'],
        message: 'cannot be "console" in production — configure a real provider',
      })
    }
  })

type ServerEnv = z.infer<typeof serverSchema>

let cachedServerEnv: ServerEnv | null = null

/**
 * Server-only environment. Throws if called from the browser bundle.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() must never be called in the browser')
  }
  if (cachedServerEnv) return cachedServerEnv

  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET,
    GEOCODING_PROVIDER_URL: process.env.GEOCODING_PROVIDER_URL,
    GEOCODING_API_KEY: process.env.GEOCODING_API_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SMS_PROVIDER: process.env.SMS_PROVIDER,
    SMS_API_KEY: process.env.SMS_API_KEY,
    SMS_SENDER_ID: process.env.SMS_SENDER_ID,
    CRON_SECRET: process.env.CRON_SECRET,
    RATE_LIMIT_BACKEND: process.env.RATE_LIMIT_BACKEND,
    FINGERPRINT_PEPPER: process.env.FINGERPRINT_PEPPER,
  })

  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `  • ${i.path.join('.')} ${i.message}`).join('\n')
    throw new Error(`Invalid server environment configuration:\n${detail}`)
  }

  cachedServerEnv = parsed.data
  return cachedServerEnv
}

/** True when web push is fully configured on both ends. */
export function isPushConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && getServerEnv().VAPID_PRIVATE_KEY)
}

/** True when the payment provider can actually charge. */
export function isPaymentConfigured(): boolean {
  const env = getServerEnv()
  return env.PAYMENT_PROVIDER === 'paystack'
    ? Boolean(env.PAYSTACK_SECRET_KEY && publicEnv.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY)
    : false
}
