import { z } from 'zod'
import {
  booleanParam,
  coordinates,
  csvUuidArray,
  latitude,
  longitude,
  minorAmount,
  pagination,
  positiveMinorAmount,
  sanitizedText,
  storagePath,
  uuid,
} from './common'

/**
 * Job schemas.
 *
 * The post-a-job wizard validates step by step in the browser using the same
 * building blocks the server uses for the final submission, so a user never
 * discovers on step 10 that something they typed on step 2 was invalid.
 */

export const jobUrgency = z.enum(['flexible', 'scheduled', 'today', 'asap'])
export const jobScheduleKind = z.enum(['asap', 'today', 'tomorrow', 'date', 'flexible'])
export const budgetKind = z.enum(['fixed', 'negotiable', 'hourly'])
export const jobVisibility = z.enum(['nearby', 'category', 'invite_only', 'public'])
export const jobLocationKind = z.enum(['onsite', 'remote', 'hybrid'])

// ─── Wizard steps ────────────────────────────────────────────────────────────

export const jobTitleStep = z.object({
  title: sanitizedText(6, 120, 'The title'),
})

export const jobDescriptionStep = z.object({
  description: sanitizedText(20, 5000, 'The description'),
})

export const jobCategoryStep = z.object({
  categoryId: uuid,
})

export const jobLocationStep = z
  .object({
    locationKind: jobLocationKind.default('onsite'),
    lat: latitude.optional(),
    lng: longitude.optional(),
    areaLabel: z.string().trim().max(120).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    addressId: uuid.optional(),
    addressLine: z.string().trim().max(200).optional(),
    landmark: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    // Remote work needs no coordinates; anything on the ground does.
    if (value.locationKind !== 'remote' && (value.lat === undefined || value.lng === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lat'],
        message: 'Pick a location so nearby hustlers can find this job',
      })
    }
  })

export const jobScheduleStep = z
  .object({
    scheduleKind: jobScheduleKind.default('flexible'),
    scheduledFor: z.coerce.date().optional(),
    durationMinutes: z.number().int().min(15).max(10_080).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scheduleKind === 'date') {
      if (!value.scheduledFor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scheduledFor'],
          message: 'Choose a date and time',
        })
      } else if (value.scheduledFor.getTime() < Date.now() - 60_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scheduledFor'],
          message: 'Pick a time in the future',
        })
      }
    }
  })

export const jobBudgetStep = z
  .object({
    budgetKind: budgetKind.default('fixed'),
    budgetMinMinor: minorAmount.optional(),
    budgetMaxMinor: minorAmount.optional(),
    currency: z.enum(['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES']).default('NGN'),
  })
  .superRefine((value, ctx) => {
    if (value.budgetKind === 'fixed' && !value.budgetMinMinor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['budgetMinMinor'],
        message: 'Enter how much you are offering',
      })
    }
    if (
      value.budgetMinMinor !== undefined &&
      value.budgetMaxMinor !== undefined &&
      value.budgetMaxMinor < value.budgetMinMinor
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['budgetMaxMinor'],
        message: 'The maximum must be at least the minimum',
      })
    }
  })

export const jobRequirementInput = z.object({
  label: sanitizedText(2, 160, 'The requirement'),
  kind: z
    .enum(['vehicle', 'tools', 'experience', 'availability', 'verification', 'custom'])
    .default('custom'),
  isMandatory: z.boolean().default(true),
})

export const jobMediaInput = z.object({
  storagePath,
  mediaType: z.enum(['image', 'video']).default('image'),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  byteSize: z.number().int().positive().max(20 * 1024 * 1024).optional(),
})

// ─── Full job payloads ───────────────────────────────────────────────────────

export const createJobInput = z.object({
  title: sanitizedText(6, 120, 'The title'),
  description: sanitizedText(20, 5000, 'The description'),
  categoryId: uuid,

  locationKind: jobLocationKind.default('onsite'),
  lat: latitude.optional(),
  lng: longitude.optional(),
  areaLabel: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  addressId: uuid.optional(),

  scheduleKind: jobScheduleKind.default('flexible'),
  scheduledFor: z.coerce.date().optional(),
  durationMinutes: z.number().int().min(15).max(10_080).optional(),
  urgency: jobUrgency.default('flexible'),

  budgetKind: budgetKind.default('fixed'),
  budgetMinMinor: minorAmount.optional(),
  budgetMaxMinor: minorAmount.optional(),
  currency: z.enum(['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES']).default('NGN'),

  visibility: jobVisibility.default('nearby'),
  invitedHustlerIds: z.array(uuid).max(20).optional(),

  requirements: z.array(jobRequirementInput).max(10).default([]),
  media: z.array(jobMediaInput).max(8).default([]),
})

export type CreateJobInput = z.infer<typeof createJobInput>

export const updateJobInput = createJobInput.partial().extend({
  id: uuid,
})

export const cancelJobInput = z.object({
  reason: sanitizedText(3, 500, 'The reason'),
})

// ─── Discovery ───────────────────────────────────────────────────────────────

export const jobSortOption = z.enum(['relevant', 'nearest', 'newest', 'highest_paying', 'urgent'])

export const searchJobsQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().min(1).max(500).optional(),
    categories: csvUuidArray,
    minBudget: z.coerce.number().int().nonnegative().optional(),
    maxBudget: z.coerce.number().int().nonnegative().optional(),
    urgency: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((v) => {
        if (!v) return undefined
        const list = Array.isArray(v) ? v : v.split(',')
        return list.filter((item): item is z.infer<typeof jobUrgency> =>
          jobUrgency.options.includes(item as never),
        )
      }),
    locationKind: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((v) => {
        if (!v) return undefined
        const list = Array.isArray(v) ? v : v.split(',')
        return list.filter((item): item is z.infer<typeof jobLocationKind> =>
          jobLocationKind.options.includes(item as never),
        )
      }),
    minRating: z.coerce.number().min(0).max(5).optional(),
    postedWithinHours: z.coerce.number().int().min(1).max(720).optional(),
    sort: jobSortOption.default('relevant'),
  })
  .merge(pagination)

export type SearchJobsQuery = z.infer<typeof searchJobsQuery>

export const mapBoundsQuery = z.object({
  minLat: z.coerce.number().min(-90).max(90),
  minLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
  categories: csvUuidArray,
})

// ─── Applications ────────────────────────────────────────────────────────────

export const applyToJobInput = z.object({
  proposedPriceMinor: positiveMinorAmount,
  message: sanitizedText(10, 2000, 'Your message'),
  canStartAt: z.coerce.date().optional(),
  estimatedMinutes: z.number().int().min(15).max(43_200).optional(),
  skillIds: z.array(uuid).max(10).default([]),
  portfolioItemIds: z.array(uuid).max(6).default([]),
})

export type ApplyToJobInput = z.infer<typeof applyToJobInput>

export const applicationDecisionInput = z.object({
  action: z.enum(['accept', 'decline', 'shortlist', 'unshortlist']),
  reason: z.string().trim().max(500).optional(),
})

export const withdrawApplicationInput = z.object({
  reason: z.string().trim().max(500).optional(),
})

// ─── Completion ──────────────────────────────────────────────────────────────

export const submitCompletionInput = z.object({
  note: sanitizedText(0, 2000).optional(),
  media: z.array(storagePath).max(8).default([]),
})

// ─── Hustler discovery ───────────────────────────────────────────────────────

export const hustlerSortOption = z.enum(['relevant', 'nearest', 'rating', 'experience', 'price'])

export const searchHustlersQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().min(1).max(500).optional(),
    categories: csvUuidArray,
    skills: csvUuidArray,
    minRating: z.coerce.number().min(0).max(5).optional(),
    availableNow: booleanParam,
    maxPrice: z.coerce.number().int().nonnegative().optional(),
    verifiedOnly: booleanParam,
    sort: hustlerSortOption.default('relevant'),
  })
  .merge(pagination)

export type SearchHustlersQuery = z.infer<typeof searchHustlersQuery>

export const saveLocationInput = z.object({
  ...coordinates.shape,
  label: z.string().trim().max(60).default('Home'),
  line1: sanitizedText(3, 200, 'The address'),
  line2: z.string().trim().max(200).optional(),
  area: z.string().trim().max(120).optional(),
  city: sanitizedText(2, 80, 'The city'),
  state: z.string().trim().max(80).optional(),
  landmark: z.string().trim().max(200).optional(),
  instructions: z.string().trim().max(500).optional(),
  isDefault: z.boolean().default(false),
})
