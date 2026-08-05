import { defineRoute } from '@/lib/api/handler'
import { created } from '@/lib/api/response'
import { ApiError, ERROR_CODES } from '@/lib/api/errors'
import { requestPayoutInput } from '@/lib/validation/account'
import { getPaymentProvider } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/admin'
import { ANALYTICS_EVENTS, budgetBucket, track } from '@/lib/analytics/server'
import type { Payout } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/payouts — withdraw earnings.
 *
 * `request_payout` locks the balance row before checking it, which is what
 * stops two concurrent requests both passing the "do you have enough" test. It
 * debits the available balance immediately, so the money cannot be spent twice
 * while the transfer is in flight.
 *
 * The provider transfer is fired afterwards; if it fails, the webhook (or the
 * reconciliation cron) calls `settle_payout` with success=false and the ledger
 * reverses cleanly.
 */
export const POST = defineRoute(
  {
    auth: 'required',
    bodySchema: requestPayoutInput,
    rateLimit: 'payoutRequest',
    name: 'POST /api/payouts',
  },
  async ({ body, supabase, user }) => {
    const { data, error } = await supabase.rpc('request_payout', {
      p_amount_minor: body.amountMinor,
      p_payout_account_id: body.payoutAccountId,
    })

    if (error) throw error

    const payout = (Array.isArray(data) ? data[0] : data) as Payout

    await track(ANALYTICS_EVENTS.PAYOUT_REQUESTED, {
      userId: user!.id,
      properties: { budget_bucket: budgetBucket(body.amountMinor) },
    })

    // Instruct the provider. Done with the admin client because we need the
    // recipient token, which the user's own RLS view does not expose.
    const admin = createAdminClient()
    const { data: account } = await admin
      .from('payout_accounts')
      .select('recipient_code, provider')
      .eq('id', body.payoutAccountId)
      .maybeSingle()

    if (!account?.recipient_code) {
      throw new ApiError(
        ERROR_CODES.INVALID_STATE,
        'This payout account is not ready yet. Please re-add it.',
      )
    }

    try {
      const provider = getPaymentProvider(account.provider ?? undefined)
      const transfer = await provider.initiateTransfer({
        reference: payout.reference,
        recipientCode: account.recipient_code,
        amountMinor: payout.amount_minor - payout.fee_minor,
        currency: payout.currency,
        reason: 'Hustle Street earnings withdrawal',
      })

      await admin
        .from('payouts')
        .update({
          status: 'processing',
          provider_reference: transfer.providerReference,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payout.id)
    } catch (providerError) {
      // Reverse immediately rather than leaving money stuck in clearing.
      await admin.rpc('settle_payout', {
        p_payout_id: payout.id,
        p_success: false,
        p_provider_reference: null,
        p_failure_reason:
          providerError instanceof Error ? providerError.message : 'Transfer could not be started',
      })

      throw new ApiError(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'We could not start that withdrawal. Your balance is unchanged — please try again.',
      )
    }

    return created(payout)
  },
)
