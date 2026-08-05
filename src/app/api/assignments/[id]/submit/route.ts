import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { uuid } from '@/lib/validation/common'
import { submitCompletionInput } from '@/lib/validation/job'
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/assignments/:id/submit — the hustler marks the work done.
 *
 * Starts the auto-confirmation clock. Money does not move here; it moves when
 * the poster confirms, or when the clock runs out.
 */
export const POST = defineRoute(
  {
    auth: 'required',
    paramsSchema: z.object({ id: uuid }),
    bodySchema: submitCompletionInput,
    name: 'POST /api/assignments/:id/submit',
  },
  async ({ params: { id }, body, supabase, user }) => {
    const { data, error } = await supabase.rpc('submit_job_completion', {
      p_assignment_id: id,
      p_note: body.note ?? null,
      p_media: body.media,
    })

    if (error) throw error
    await track(ANALYTICS_EVENTS.JOB_SUBMITTED, { userId: user!.id })
    return ok(Array.isArray(data) ? data[0] : data)
  },
)
