import { z } from 'zod'
import {
  email,
  minorAmount,
  otpCode,
  password,
  phone,
  sanitizedText,
  storagePath,
  username,
  uuid,
} from './common'

/** Auth, profile, wallet and trust-and-safety payloads. */

// ─── Auth ────────────────────────────────────────────────────────────────────

export const signUpInput = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
    displayName: sanitizedText(2, 60, 'Your name'),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: 'Please accept the terms to continue' }),
    }),
    intent: z.enum(['post', 'hustle', 'both']).default('both'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const signInInput = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
  next: z.string().max(300).optional(),
})

export const phoneStartInput = z.object({
  phone,
})

export const phoneVerifyInput = z.object({
  phone,
  code: otpCode,
})

export const requestPasswordResetInput = z.object({
  email,
})

export const resetPasswordInput = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((value) => value.password !== value.currentPassword, {
    path: ['password'],
    message: 'Choose a password you have not used here before',
  })

// ─── Profile ─────────────────────────────────────────────────────────────────

export const onboardingProfileInput = z.object({
  username,
  displayName: sanitizedText(2, 60, 'Your name'),
  headline: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(1000).optional(),
  isHustler: z.boolean().default(false),
  isPoster: z.boolean().default(true),
  city: z.string().trim().max(80).optional(),
  area: z.string().trim().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

export const updateProfileInput = z.object({
  displayName: sanitizedText(2, 60, 'Your name').optional(),
  username: username.optional(),
  headline: z.string().trim().max(80).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  area: z.string().trim().max(120).nullable().optional(),
  state: z.string().trim().max(80).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  isHustler: z.boolean().optional(),
  isPoster: z.boolean().optional(),
  serviceRadiusKm: z.number().int().min(1).max(200).optional(),
  hourlyRateMinor: minorAmount.nullable().optional(),
  startingPriceMinor: minorAmount.nullable().optional(),
  availableNow: z.boolean().optional(),
  acceptsRemote: z.boolean().optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(64).optional(),
})

export const updateSkillsInput = z.object({
  skillIds: z.array(uuid).max(20),
  primarySkillId: uuid.optional(),
})

export const availabilitySlotInput = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
})

export const updateAvailabilityInput = z.object({
  slots: z.array(availabilitySlotInput).max(21),
  availableNow: z.boolean().optional(),
})

export const portfolioItemInput = z.object({
  title: sanitizedText(2, 120, 'The title'),
  description: z.string().trim().max(600).optional(),
  mediaPath: storagePath,
  mediaType: z.enum(['image', 'video', 'link']).default('image'),
  linkUrl: z.string().url().optional(),
})

// ─── Notifications ───────────────────────────────────────────────────────────

export const notificationPreferencesInput = z.object({
  inAppEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  jobsNearby: z.boolean().optional(),
  applicationUpdates: z.boolean().optional(),
  messages: z.boolean().optional(),
  payments: z.boolean().optional(),
  reviews: z.boolean().optional(),
  marketing: z.boolean().optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
  nearbyRadiusKm: z.number().int().min(1).max(100).optional(),
})

export const pushSubscriptionInput = z.object({
  endpoint: z.string().url().max(600),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(10).max(200),
  }),
})

// ─── Messaging ───────────────────────────────────────────────────────────────

export const sendMessageInput = z.object({
  body: z.string().trim().max(4000).optional(),
  kind: z.enum(['text', 'image', 'file', 'voice']).default('text'),
  /**
   * Client-generated idempotency key. The PWA queues messages composed offline
   * and replays them on reconnect; the nonce is what stops a flaky network from
   * turning one message into three.
   */
  clientNonce: z.string().min(8).max(64).optional(),
  replyToId: uuid.optional(),
  attachments: z
    .array(
      z.object({
        storagePath,
        fileName: z.string().max(200).optional(),
        mimeType: z.string().max(120),
        byteSize: z.number().int().positive().max(25 * 1024 * 1024),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        durationMs: z.number().int().positive().max(600_000).optional(),
      }),
    )
    .max(5)
    .default([]),
})

// ─── Money ───────────────────────────────────────────────────────────────────

export const initializePaymentInput = z.object({
  assignmentId: uuid,
  /** Where Paystack should send the user back to. Validated against our origin. */
  callbackPath: z.string().max(300).optional(),
})

export const addPayoutAccountInput = z.object({
  bankCode: z.string().trim().min(1).max(20),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Enter your 10-digit account number'),
})

export const requestPayoutInput = z.object({
  amountMinor: minorAmount.refine((v) => v > 0, 'Enter an amount'),
  payoutAccountId: uuid,
})

// ─── Trust & safety ──────────────────────────────────────────────────────────

const ratingScore = z.number().int().min(1).max(5)

export const createReviewInput = z.object({
  assignmentId: uuid,
  rating: ratingScore,
  body: z.string().trim().max(2000).optional(),
  // Category scores. Which subset applies depends on the direction; the server
  // discards the ones that do not belong to the reviewer's role.
  quality: ratingScore.optional(),
  communication: ratingScore.optional(),
  reliability: ratingScore.optional(),
  professionalism: ratingScore.optional(),
  paymentPromptness: ratingScore.optional(),
  respect: ratingScore.optional(),
  jobAccuracy: ratingScore.optional(),
})

export const createReportInput = z.object({
  targetKind: z.enum(['user', 'job', 'message', 'review', 'application']),
  targetId: uuid,
  reason: sanitizedText(3, 200, 'The reason'),
  details: z.string().trim().max(2000).optional(),
  evidencePaths: z.array(storagePath).max(6).default([]),
})

export const openDisputeInput = z.object({
  assignmentId: uuid,
  reason: z.enum([
    'not_completed',
    'poor_quality',
    'payment_issue',
    'wrong_description',
    'fraud',
    'safety_issue',
    'cancellation',
    'other',
  ]),
  description: sanitizedText(20, 4000, 'The description'),
  evidencePaths: z.array(storagePath).max(10).default([]),
})

export const disputeEvidenceInput = z.object({
  kind: z.enum(['note', 'image', 'file', 'message_ref', 'transaction_ref']).default('note'),
  body: z.string().trim().max(2000).optional(),
  storagePath: storagePath.optional(),
  referenceId: uuid.optional(),
})

export const resolveDisputeInput = z
  .object({
    resolution: z.enum([
      'refund_poster',
      'release_hustler',
      'split',
      'no_action',
      'cancelled_by_agreement',
    ]),
    refundToPosterMinor: minorAmount.default(0),
    releaseToHustlerMinor: minorAmount.default(0),
    note: sanitizedText(5, 2000, 'The note'),
  })
  .superRefine((value, ctx) => {
    if (value.resolution === 'split') {
      if (value.refundToPosterMinor <= 0 || value.releaseToHustlerMinor <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['refundToPosterMinor'],
          message: 'A split must give something to both parties',
        })
      }
    }
    if (value.resolution === 'refund_poster' && value.releaseToHustlerMinor > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['releaseToHustlerMinor'],
        message: 'A full refund cannot also release to the hustler',
      })
    }
    if (value.resolution === 'release_hustler' && value.refundToPosterMinor > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['refundToPosterMinor'],
        message: 'A full release cannot also refund the poster',
      })
    }
  })

export const blockUserInput = z.object({
  userId: uuid,
  reason: z.string().trim().max(300).optional(),
})

// ─── Admin ───────────────────────────────────────────────────────────────────

export const moderateUserInput = z.object({
  action: z.enum(['suspend', 'restrict', 'ban', 'restore', 'verify_identity', 'reject_identity']),
  reason: sanitizedText(5, 500, 'The reason'),
  until: z.coerce.date().optional(),
})

export const moderateJobInput = z.object({
  action: z.enum(['flag', 'unflag', 'remove', 'restore']),
  reason: sanitizedText(5, 500, 'The reason'),
})

export const updateSettingInput = z.object({
  key: z.string().min(1).max(80),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown()), z.record(z.unknown())]),
  reason: z.string().trim().max(300).optional(),
})

export const categoryInput = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,48}$/, 'Use lowercase letters, numbers and hyphens'),
  name: sanitizedText(2, 60, 'The name'),
  description: z.string().trim().max(300).optional(),
  icon: z.string().trim().max(40).optional(),
  color: z.string().trim().max(24).optional(),
  position: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
  minBudgetMinor: minorAmount.optional(),
  parentId: uuid.nullable().optional(),
})
