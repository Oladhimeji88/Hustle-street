import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { created, ok } from '@/lib/api/response'
import { forbidden } from '@/lib/api/errors'
import { uuid } from '@/lib/validation/common'
import { applyToJobInput } from '@/lib/validation/job'
import { ANALYTICS_EVENTS, budgetBucket, track } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

const params = z.object({ id: uuid })

/**
 * GET /api/jobs/:id/applications — the poster's comparison view.
 *
 * RLS restricts rows to the job's poster, so a competing hustler cannot read
 * anyone else's proposed price. Each row is joined with a live profile snapshot
 * so the poster compares reputations, not just numbers.
 */
export const GET = defineRoute(
  { auth: 'required', paramsSchema: params, rateLimit: 'read', name: 'GET /api/jobs/:id/applications' },
  async ({ params: { id }, supabase, user }) => {
    const { data: job } = await supabase.from('jobs').select('poster_id').eq('id', id).maybeSingle()
    if (!job || job.poster_id !== user!.id) throw forbidden('Only the job poster can see applications.')

    const { data, error } = await supabase
      .from('job_applications')
      .select(
        `
        *,
        hustler:profiles!job_applications_hustler_id_fkey(
          id, username, display_name, avatar_url, headline, bio,
          rating_avg, rating_count, jobs_completed, response_rate, response_time_secs,
          available_now, identity_verified, phone_verified, area, city
        )
      `,
      )
      .eq('job_id', id)
      .order('is_shortlisted', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    // Mark unseen applications as viewed so the response-rate metric is honest.
    const unseen = (data ?? []).filter((row) => !row.poster_viewed_at).map((row) => row.id)
    if (unseen.length > 0) {
      void supabase
        .from('job_applications')
        .update({ poster_viewed_at: new Date().toISOString() })
        .in('id', unseen)
    }

    return ok(data ?? [])
  },
)

/**
 * POST /api/jobs/:id/applications — apply for a job.
 *
 * The `apply_to_job` RPC owns the rules (cannot apply to your own job, job must
 * be open, daily cap, blocks, invite-only) so they hold for every caller.
 */
export const POST = defineRoute(
  {
    auth: 'required',
    paramsSchema: params,
    bodySchema: applyToJobInput,
    rateLimit: 'applicationCreate',
    name: 'POST /api/jobs/:id/applications',
  },
  async ({ params: { id }, body, supabase, user }) => {
    const { data, error } = await supabase.rpc('apply_to_job', {
      p_job_id: id,
      p_proposed_price_minor: body.proposedPriceMinor,
      p_message: body.message,
      p_can_start_at: body.canStartAt?.toISOString() ?? null,
      p_estimated_minutes: body.estimatedMinutes ?? null,
      p_skill_ids: body.skillIds,
      p_portfolio_item_ids: body.portfolioItemIds,
    })

    if (error) throw error

    const application = Array.isArray(data) ? data[0] : data

    void track(ANALYTICS_EVENTS.APPLICATION_SUBMITTED, {
      userId: user!.id,
      properties: { budget_bucket: budgetBucket(body.proposedPriceMinor) },
    })

    return created(application)
  },
)
