import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { notFound } from '@/lib/api/errors'
import { updateJobInput } from '@/lib/validation/job'
import { uuid } from '@/lib/validation/common'
import { createHash } from 'node:crypto'

export const dynamic = 'force-dynamic'

const params = z.object({ id: uuid })

/**
 * GET /api/jobs/:id
 *
 * RLS decides visibility, so a job the caller may not see simply returns no
 * rows and becomes a 404 — the same response as a job that does not exist. That
 * symmetry matters: a 403 would confirm the job is real.
 */
export const GET = defineRoute(
  { auth: 'optional', paramsSchema: params, rateLimit: 'read', name: 'GET /api/jobs/:id' },
  async ({ params: { id }, supabase, user, ipHash }) => {
    const { data: job, error } = await supabase
      .from('jobs')
      .select(
        `
        *,
        categories(id, name, slug, icon),
        job_images(id, storage_path, media_type, width, height, position),
        job_requirements(id, label, kind, is_mandatory, position),
        poster:profiles!jobs_poster_id_fkey(
          id, username, display_name, avatar_url, rating_avg, rating_count,
          jobs_posted, jobs_completed, identity_verified, phone_verified, created_at
        )
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw error
    if (!job) throw notFound('Job')

    // Exact coordinates come from a separate, permission-gated view rather than
    // being selected onto the job row.
    const { data: precise } = await supabase
      .from('job_precise_location')
      .select('*')
      .eq('job_id', id)
      .maybeSingle()

    // Has the caller already applied? Drives the CTA state.
    let myApplication = null
    if (user) {
      const { data } = await supabase
        .from('job_applications')
        .select('id, status, proposed_price_minor, created_at')
        .eq('job_id', id)
        .eq('hustler_id', user.id)
        .maybeSingle()
      myApplication = data
    }

    // Deduplicated view counting: one row per viewer per day, so a poster
    // refreshing their own listing cannot inflate the number.
    const viewerKey = user?.id ?? createHash('sha256').update(ipHash).digest('hex').slice(0, 32)
    if (job.poster_id !== user?.id) {
      void supabase
        .from('job_views')
        .insert({ job_id: id, viewer_id: user?.id ?? null, viewer_key: viewerKey })
    }

    return ok({ ...job, precise_location: precise ?? null, my_application: myApplication })
  },
)

/** PATCH /api/jobs/:id — edit a job. Completed jobs are frozen in the database. */
export const PATCH = defineRoute(
  {
    auth: 'required',
    paramsSchema: params,
    bodySchema: updateJobInput.omit({ id: true }),
    name: 'PATCH /api/jobs/:id',
  },
  async ({ params: { id }, body, supabase }) => {
    const patch: Record<string, unknown> = {}
    if (body.title !== undefined) patch.title = body.title
    if (body.description !== undefined) patch.description = body.description
    if (body.categoryId !== undefined) patch.category_id = body.categoryId
    if (body.urgency !== undefined) patch.urgency = body.urgency
    if (body.budgetKind !== undefined) patch.budget_kind = body.budgetKind
    if (body.budgetMinMinor !== undefined) patch.budget_min_minor = body.budgetMinMinor
    if (body.budgetMaxMinor !== undefined) patch.budget_max_minor = body.budgetMaxMinor
    if (body.scheduleKind !== undefined) patch.schedule_kind = body.scheduleKind
    if (body.scheduledFor !== undefined) patch.scheduled_for = body.scheduledFor?.toISOString()
    if (body.lat !== undefined) patch.exact_lat = body.lat
    if (body.lng !== undefined) patch.exact_lng = body.lng
    if (body.areaLabel !== undefined) patch.area_label = body.areaLabel
    if (body.visibility !== undefined) patch.visibility = body.visibility

    const { data, error } = await supabase
      .from('jobs')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return ok(data)
  },
)

/**
 * DELETE /api/jobs/:id — soft delete.
 *
 * Never a hard delete: the job is referenced by applications, messages,
 * assignments and possibly a ledger entry. Soft deletion keeps that history
 * intact and auditable.
 */
export const DELETE = defineRoute(
  { auth: 'required', paramsSchema: params, name: 'DELETE /api/jobs/:id' },
  async ({ params: { id }, supabase }) => {
    const { error } = await supabase
      .from('jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['DRAFT', 'PUBLISHED', 'APPLICATIONS_OPEN', 'EXPIRED', 'CANCELLED'])

    if (error) throw error
    return ok({ deleted: true })
  },
)
