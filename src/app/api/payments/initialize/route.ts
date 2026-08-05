import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { ApiError, ERROR_CODES, forbidden, invalidState, notFound } from '@/lib/api/errors'
import { initializePaymentInput } from '@/lib/validation/account'
import { getPaymentProvider } from '@/lib/payments'
import { PaymentProviderError } from '@/lib/payments/types'
import { publicEnv } from '@/lib/config/env'
import { ANALYTICS_EVENTS, budgetBucket, track } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/payments/initialize — start funding an escrow.
 *
 * Returns a hosted checkout URL. Note what this endpoint does NOT do: it never
 * marks anything as paid. The transaction stays PENDING until the provider's
 * signed webhook says otherwise. A client that "succeeds" on the callback page
 * has proved nothing.
 */
export const POST = defineRoute(
  {
    auth: 'required',
    bodySchema: initializePaymentInput,
    rateLimit: 'paymentInitialize',
    name: 'POST /api/payments/initialize',
  },
  async ({ body, supabase, user, profile }) => {
    const { data: assignment } = await supabase
      .from('job_assignments')
      .select('id, job_id, poster_id, hustler_id, status, agreed_price_minor, currency')
      .eq('id', body.assignmentId)
      .maybeSingle()

    if (!assignment) throw notFound('Job agreement')

    // Only the poster pays, and only while the agreement is awaiting funding.
    if (assignment.poster_id !== user!.id) {
      throw forbidden('Only the poster can pay for this job.')
    }

    if (assignment.status !== 'pending_payment') {
      throw invalidState(
        assignment.status === 'active'
          ? 'This job has already been paid for.'
          : 'This job is no longer awaiting payment.',
      )
    }

    // The transaction was created by `accept_application`, keyed by assignment.
    const { data: transaction } = await supabase
      .from('transactions')
      .select('id, reference, status, amount_minor, currency, provider')
      .eq('assignment_id', assignment.id)
      .eq('kind', 'escrow_funding')
      .maybeSingle()

    if (!transaction) throw notFound('Payment')

    if (transaction.status === 'HELD' || transaction.status === 'RELEASED') {
      throw invalidState('This job has already been paid for.')
    }

    const email = profile?.email ?? user!.email
    if (!email) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        'Add an email address to your profile before paying.',
      )
    }

    const provider = getPaymentProvider(transaction.provider ?? undefined)
    if (!provider.isConfigured()) {
      throw new ApiError(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Payments are temporarily unavailable. Please try again shortly.',
      )
    }

    // Only ever hand the provider a callback on our own origin.
    const callbackPath =
      body.callbackPath?.startsWith('/') && !body.callbackPath.startsWith('//')
        ? body.callbackPath
        : `/jobs/${assignment.job_id}/payment/return`

    try {
      const checkout = await provider.initializeCharge({
        reference: transaction.reference,
        amountMinor: transaction.amount_minor,
        currency: transaction.currency,
        email,
        callbackUrl: `${publicEnv.NEXT_PUBLIC_APP_URL}${callbackPath}`,
        metadata: {
          transaction_id: transaction.id,
          assignment_id: assignment.id,
          job_id: assignment.job_id,
          poster_id: assignment.poster_id,
          hustler_id: assignment.hustler_id,
        },
      })

      await track(ANALYTICS_EVENTS.PAYMENT_STARTED, {
        userId: user!.id,
        properties: {
          provider: provider.name,
          budget_bucket: budgetBucket(transaction.amount_minor),
        },
      })

      return ok({
        authorizationUrl: checkout.authorizationUrl,
        accessCode: checkout.accessCode,
        reference: checkout.reference,
        amountMinor: transaction.amount_minor,
        currency: transaction.currency,
        publicKey: publicEnv.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      })
    } catch (error) {
      if (error instanceof PaymentProviderError) {
        await track(ANALYTICS_EVENTS.PAYMENT_FAILED, {
          userId: user!.id,
          properties: { provider: provider.name, error_code: error.providerCode ?? 'unknown' },
        })
        throw new ApiError(
          error.retryable ? ERROR_CODES.SERVICE_UNAVAILABLE : ERROR_CODES.PROVIDER_ERROR,
          'We could not start that payment. Please try again.',
        )
      }
      throw error
    }
  },
)
