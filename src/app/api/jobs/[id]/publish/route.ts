import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { uuid } from '@/lib/validation/common'
import { ANALYTICS_EVENTS, budgetBucket, track } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/jobs/:id/publish
 *
 * All the real work — ownership check, open-job limit, area labelling, expiry
 * and the notification fan-out to nearby hustlers — happens inside the
 * `publish_job` RPC, in a single transaction. If any part fails, nothing is
 * published and no notifications go out.
 */
export const POST = defineRoute(
  {
    auth: 'required',
    paramsSchema: z.object({ id: uuid }),
    rateLimit: 'jobPublish',
    name: 'POST /api/jobs/:id/publish',
  },
  async ({ params: { id }, supabase, user }) => {
    const { data, error } = await supabase.rpc('publish_job', { p_job_id: id })
    if (error) throw error

    const job = Array.isArray(data) ? data[0] : data

    await track(ANALYTICS_EVENTS.JOB_PUBLISHED, {
      userId: user!.id,
      properties: {
        budget_bucket: budgetBucket(job?.budget_min_minor),
        urgency: job?.urgency,
        location_kind: job?.location_kind,
      },
    })

    return ok({
      job,
      // Surfaced in the success screen: "12 hustlers nearby were notified."
      notifiedCount: job?.notified_count ?? 0,
    })
  },
)
