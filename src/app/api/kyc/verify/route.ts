import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { kycVerifyInput } from '@/lib/validation/kyc'
import { getKycProvider, identityHash } from '@/lib/kyc/provider'

export const dynamic = 'force-dynamic'

/**
 * POST /api/kyc/verify
 *
 * Takes a NIN, a BVN and a liveness frame, sends them to the verification
 * provider, and stores only the verdict.
 *
 * ── The one thing this route must never do ──────────────────────────────────
 *
 * Persist or log the numbers. They live in `input` for the duration of the call
 * and are dropped when it returns. The `profiles` update below writes a status,
 * a provider reference and a salted hash — never the identifiers themselves.
 * A `console.error(error)` added carelessly to the catch block would undo this,
 * because provider errors quote the submitted payload back.
 *
 * `auth: 'required'` because verification attaches to an account. An anonymous
 * endpoint that checks BVNs is a BVN-validation oracle for whoever finds it.
 */
export const POST = defineRoute(
  { auth: 'required', bodySchema: kycVerifyInput, name: 'POST /api/kyc/verify' },
  async ({ body, supabase, user }) => {
    const provider = getKycProvider()
    const result = await provider.verify(body)

    // Only ever the derived hash, never the source values.
    const hash = identityHash(body.nin, body.bvn)

    // A hash already claimed by a different account means one person is running
    // several. Reject rather than silently linking them: identity verification
    // that permits duplicates is not identity verification.
    const { data: clash } = await supabase
      .from('profiles')
      .select('id')
      .eq('identity_hash', hash)
      .neq('id', user!.id)
      .maybeSingle()

    if (clash) {
      return ok({
        status: 'rejected' as const,
        reference: result.reference,
        reason: 'These details are already verified on another account.',
      })
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        identity_verified: result.status === 'verified',
        identity_status: result.status,
        identity_reference: result.reference,
        identity_hash: hash,
        identity_verified_at: result.status === 'verified' ? new Date().toISOString() : null,
      })
      .eq('id', user!.id)

    if (error) throw error

    return ok(result)
  },
)
