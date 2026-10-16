import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { uuid } from '@/lib/validation/common'
import { cancelJobInput } from '@/lib/validation/job'
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/jobs/:id/cancel
 *
 * `cancel_job` refunds any held escrow, closes the assignment, declines open
 * applications and moves the job to CANCELLED — atomically. It refuses to
 * cancel a job whose work has already been submitted; that must go through
 * confirmation or a dispute.
 */
export const POST = defineRoute(
  {
    auth: 'required',
    paramsSchema: z.object({ id: uuid }),
    bodySchema: cancelJobInput,
    name: 'POST /api/jobs/:id/cancel',
  },
  async ({ params: { id }, body, supabase, user }) => {
    const { data, error } = await supabase.rpc('cancel_job', {
      p_job_id: id,
      p_reason: body.reason,
    })

    if (error) throw error
    void track(ANALYTICS_EVENTS.JOB_CANCELLED, { userId: user!.id, properties: { reason: 'poster' } })
    return ok(Array.isArray(data) ? data[0] : data)
  },
)
