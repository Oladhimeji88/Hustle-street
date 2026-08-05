import { defineRoute } from '@/lib/api/handler'
import { created, ok, paginationMeta } from '@/lib/api/response'
import { ApiError, ERROR_CODES } from '@/lib/api/errors'
import { createJobInput, searchJobsQuery } from '@/lib/validation/job'
import { track, ANALYTICS_EVENTS } from '@/lib/analytics/server'
import { budgetBucket } from '@/lib/analytics/events'
import type { JobSearchResult } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * GET /api/jobs — marketplace discovery.
 *
 * All the filtering, ranking and geospatial work happens inside the
 * `search_jobs` RPC. Doing it in one round trip matters: the alternative is
 * fetching rows and filtering in Node, which would break pagination and leak
 * jobs the caller should not see.
 */
export const GET = defineRoute(
  {
    auth: 'optional',
    querySchema: searchJobsQuery,
    rateLimit: 'search',
    name: 'GET /api/jobs',
  },
  async ({ query, supabase, user }) => {
    const offset = (query.page - 1) * query.pageSize

    const { data, error } = await supabase.rpc('search_jobs', {
      p_lat: query.lat ?? null,
      p_lng: query.lng ?? null,
      p_radius_km: query.radiusKm ?? null,
      p_query: query.q ?? null,
      p_category_ids: query.categories ?? null,
      p_min_budget_minor: query.minBudget ?? null,
      p_max_budget_minor: query.maxBudget ?? null,
      p_urgency: query.urgency?.length ? query.urgency : null,
      p_location_kind: query.locationKind?.length ? query.locationKind : null,
      p_min_poster_rating: query.minRating ?? null,
      p_posted_within_hours: query.postedWithinHours ?? null,
      p_sort: query.sort,
      p_limit: query.pageSize,
      p_offset: offset,
    })

    if (error) throw error

    const rows = (data ?? []) as JobSearchResult[]
    // `total_count` is the same on every row; the RPC computes it once.
    const total = rows[0]?.total_count ?? 0

    // Record the search so the suggestion engine and the admin funnel have
    // something real to work with.
    if (query.q) {
      await track(ANALYTICS_EVENTS.SEARCH_PERFORMED, {
        userId: user?.id,
        properties: {
          result_count: rows.length,
          sort: query.sort,
          filter_count: [
            query.categories,
            query.minBudget,
            query.maxBudget,
            query.urgency,
            query.minRating,
          ].filter(Boolean).length,
        },
      })

      void supabase.from('search_queries').insert({
        user_id: user?.id ?? null,
        query: query.q,
        normalized: query.q.toLowerCase().trim(),
        result_count: Number(total),
        filters: { sort: query.sort, categories: query.categories ?? [] },
      })
    }

    return ok(rows, paginationMeta(Number(total), query.page, query.pageSize))
  },
)

/**
 * POST /api/jobs — create a draft.
 *
 * Creation and publication are deliberately separate. A draft is cheap and
 * private; publishing is what triggers limit checks, area labelling and the
 * notification fan-out, and that lives in the `publish_job` RPC.
 */
export const POST = defineRoute(
  {
    auth: 'required',
    bodySchema: createJobInput,
    rateLimit: 'jobCreate',
    name: 'POST /api/jobs',
  },
  async ({ body, supabase, user, profile }) => {
    if (!profile) throw new ApiError(ERROR_CODES.FORBIDDEN, 'Complete your profile first.')

    // An on-site job with no coordinates would be invisible in discovery, so
    // reject it here with a useful message rather than letting the database
    // constraint fire at publish time.
    if (body.locationKind !== 'remote' && (body.lat === undefined || body.lng === undefined)) {
      throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 'Pick a location for this job.')
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        poster_id: user!.id,
        category_id: body.categoryId,
        title: body.title,
        description: body.description,
        status: 'DRAFT',
        urgency: body.urgency,
        location_kind: body.locationKind,
        visibility: body.visibility,
        address_id: body.addressId ?? null,
        exact_lat: body.lat ?? null,
        exact_lng: body.lng ?? null,
        area_label: body.areaLabel ?? null,
        city: body.city ?? profile.city,
        state: body.state ?? profile.state,
        country_code: profile.country_code,
        schedule_kind: body.scheduleKind,
        scheduled_for: body.scheduledFor?.toISOString() ?? null,
        duration_minutes: body.durationMinutes ?? null,
        budget_kind: body.budgetKind,
        budget_min_minor: body.budgetMinMinor ?? null,
        budget_max_minor: body.budgetMaxMinor ?? null,
        currency: body.currency,
      })
      .select('*')
      .single()

    if (error) throw error

    // Requirements and media are separate tables; insert them alongside.
    if (body.requirements.length > 0) {
      const { error: requirementError } = await supabase.from('job_requirements').insert(
        body.requirements.map((requirement, index) => ({
          job_id: job.id,
          label: requirement.label,
          kind: requirement.kind,
          is_mandatory: requirement.isMandatory,
          position: index,
        })),
      )
      if (requirementError) throw requirementError
    }

    if (body.media.length > 0) {
      const { error: mediaError } = await supabase.from('job_images').insert(
        body.media.map((item, index) => ({
          job_id: job.id,
          storage_path: item.storagePath,
          media_type: item.mediaType,
          width: item.width ?? null,
          height: item.height ?? null,
          byte_size: item.byteSize ?? null,
          position: index,
        })),
      )
      if (mediaError) throw mediaError
    }

    if (body.visibility === 'invite_only' && body.invitedHustlerIds?.length) {
      await supabase.from('job_invitations').insert(
        body.invitedHustlerIds.map((hustlerId) => ({
          job_id: job.id,
          hustler_id: hustlerId,
          invited_by: user!.id,
        })),
      )
    }

    await track(ANALYTICS_EVENTS.JOB_CREATED, {
      userId: user!.id,
      properties: {
        budget_bucket: budgetBucket(body.budgetMinMinor),
        location_kind: body.locationKind,
        schedule_kind: body.scheduleKind,
        urgency: body.urgency,
        visibility: body.visibility,
        image_count: body.media.length,
        requirement_count: body.requirements.length,
      },
    })

    return created(job)
  },
)
