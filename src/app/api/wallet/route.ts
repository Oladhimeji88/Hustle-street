import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/wallet — balances plus recent movements.
 *
 * Balances come from the `wallets` view, which is derived from the ledger.
 * There is no stored balance column anywhere, so this can never disagree with
 * the transaction history shown beside it.
 */
export const GET = defineRoute(
  { auth: 'required', rateLimit: 'read', name: 'GET /api/wallet' },
  async ({ supabase, user }) => {
    const [wallet, transactions, payouts, payoutAccounts] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user!.id).maybeSingle(),
      supabase
        .from('transactions')
        .select('id, reference, kind, status, amount_minor, fee_minor, net_minor, currency, job_id, created_at, released_at, metadata')
        .or(`payer_id.eq.${user!.id},payee_id.eq.${user!.id}`)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('payouts')
        .select('id, reference, amount_minor, fee_minor, currency, status, requested_at, completed_at, failure_reason')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('payout_accounts')
        .select('id, bank_name, bank_code, account_last4, account_name, currency, is_default, is_verified')
        .eq('user_id', user!.id),
    ])

    if (wallet.error) throw wallet.error
    if (transactions.error) throw transactions.error

    return ok({
      wallet: wallet.data ?? {
        user_id: user!.id,
        currency: 'NGN',
        available_minor: 0,
        pending_minor: 0,
        total_minor: 0,
        withdrawing_minor: 0,
      },
      transactions: transactions.data ?? [],
      payouts: payouts.data ?? [],
      payoutAccounts: payoutAccounts.data ?? [],
    })
  },
)
