import { z } from 'zod'

/**
 * Nigerian identity verification payloads.
 *
 * ── NIN and BVN are not ordinary form fields ────────────────────────────────
 *
 * The **BVN** is a banking credential issued by the CBN and shared across every
 * Nigerian bank. It is not a username. A leaked BVN is a durable, unrotatable
 * identifier tied to someone's accounts, and its use is regulated: collecting
 * and processing it puts you under both CBN guidance and the Nigeria Data
 * Protection Act 2023.
 *
 * The **NIN** is the national identity number, similarly sensitive and
 * similarly unrotatable.
 *
 * Two rules follow, and they are enforced elsewhere in this codebase rather
 * than merely recommended here:
 *
 *   1. **Neither number is ever stored.** They are posted once, sent straight to
 *      a licensed verification provider, and dropped. What persists is the
 *      provider's verdict, its reference, and a salted hash used only to stop
 *      one person registering ten accounts. See `lib/kyc/provider.ts`.
 *
 *   2. **Neither number is ever logged**, which is why the API route redacts
 *      them from its own error paths.
 *
 * If you are tempted to add a `nin` column to `profiles`, read rule 1 again.
 */

/**
 * Both identifiers are exactly 11 digits.
 *
 * BVNs conventionally begin with 2, but that is a convention rather than a
 * specification, so it is not enforced. Rejecting a valid BVN because it starts
 * with something unexpected is a worse failure than letting the provider
 * reject it.
 */
const elevenDigits = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(
      z
        .string()
        .regex(/^\d{11}$/, `${label} is 11 digits`),
    )

export const nin = elevenDigits('Your NIN')
export const bvn = elevenDigits('Your BVN')

/**
 * A liveness capture, as a data URL from the camera.
 *
 * Capped at ~1.5MB encoded. A single JPEG frame at the resolution we request is
 * far under that; anything larger is either a misconfigured capture or someone
 * posting a video file, and neither should reach the provider.
 */
export const livenessFrame = z
  .string()
  .startsWith('data:image/jpeg;base64,', 'Liveness capture must be a JPEG frame')
  .max(1_500_000, 'Liveness capture is too large')

export const kycVerifyInput = z.object({
  nin,
  bvn,
  /**
   * Full name as it appears on the ID, used by the provider to match against
   * the NIMC and NIBSS records. A mismatch here is the most common reason a
   * genuine verification fails.
   */
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter your full name')
    .max(120, 'That name is too long'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker')
    .refine((v) => {
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return false
      const age = (Date.now() - d.getTime()) / 31_557_600_000
      return age >= 18 && age <= 120
    }, 'You must be at least 18'),
  liveness: livenessFrame,
})

export type KycVerifyInput = z.infer<typeof kycVerifyInput>

/** What the client is allowed to learn about a verification attempt. */
export const kycResult = z.object({
  status: z.enum(['verified', 'pending', 'rejected']),
  reference: z.string(),
  /** Present only on rejection, and deliberately non-specific. */
  reason: z.string().optional(),
})

export type KycResult = z.infer<typeof kycResult>
