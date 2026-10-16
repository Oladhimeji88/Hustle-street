import { defineRoute } from '@/lib/api/handler'
import { ok, paginationMeta } from '@/lib/api/response'
import { searchHustlersQuery } from '@/lib/validation/job'
import type { HustlerSearchResult } from '@/types/database'

export const dynamic = 'force-dynamic'

/** GET /api/hustlers — hustler discovery, mirroring the job search contract. */
export const GET = defineRoute(
  { auth: 'optional', querySchema: searchHustlersQuery, rateLimit: 'search', name: 'GET /api/hustlers' },
  async ({ query, supabase }) => {
    const { data, error } = await supabase.rpc('search_hustlers', {
      p_lat: query.lat ?? null,
      p_lng: query.lng ?? null,
      p_radius_km: query.radiusKm ?? null,
      p_query: query.q ?? null,
      p_category_ids: query.categories ?? null,
      p_skill_ids: query.skills ?? null,
      p_min_rating: query.minRating ?? null,
      p_available_now: query.availableNow ?? null,
      p_max_price_minor: query.maxPrice ?? null,
      p_verified_only: query.verifiedOnly ?? false,
      p_sort: query.sort,
      p_limit: query.pageSize,
      p_offset: (query.page - 1) * query.pageSize,
    })

    if (error) throw error

    const rows = (data ?? []) as HustlerSearchResult[]
    const total = rows[0]?.total_count ?? 0

    return ok(rows, paginationMeta(Number(total), query.page, query.pageSize))
  },
)
