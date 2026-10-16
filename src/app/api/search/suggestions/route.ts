import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import type { SearchSuggestion } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * GET /api/search/suggestions — typo-tolerant autocomplete across categories,
 * skills, locations and live jobs. Ranked by trigram similarity in Postgres.
 */
export const GET = defineRoute(
  {
    auth: 'optional',
    querySchema: z.object({ q: z.string().trim().min(1).max(80) }),
    rateLimit: 'search',
    name: 'GET /api/search/suggestions',
  },
  async ({ query, supabase }) => {
    const { data, error } = await supabase.rpc('search_suggestions', {
      p_query: query.q,
      p_limit: 8,
    })

    if (error) throw error
    return ok((data ?? []) as SearchSuggestion[])
  },
)
