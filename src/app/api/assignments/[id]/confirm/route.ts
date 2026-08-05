import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { uuid } from '@/lib/validation/common'
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/server'
import type { ConfirmCompletionResult } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/assignments/:id/confirm — release the money.
 *
 * The single most consequential endpoint in the product. Everything that makes
 * it safe lives in `confirm_job_completion`: the poster check, the "already
 * completed" short-circuit, the balanced ledger posting, and the idempotency
 * key that makes a double release structurally impossible.
 */
export const POST = defineRoute(
  { auth: 'required', paramsSchema: z.object({ id: uuid }), name: 'POST /api/assignments/:id/confirm' },
  async ({ params: { id }, supabase, user }) => {
    const { data, error } = await supabase.rpc('confirm_job_completion', {
      p_assignment_id: id,
      p_system_auto: false,
    })

    if (error) throw error

    const result = (Array.isArray(data) ? data[0] : data) as ConfirmCompletionResult
    void track(ANALYTICS_EVENTS.JOB_COMPLETED, { userId: user!.id })
    return ok(result)
  },
)
