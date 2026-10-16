import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import type { JobRecommendation } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * GET /api/jobs/recommended — personalised feed.
 *
 * Scoring lives in `recommend_jobs()` with weights read from platform settings,
 * so relevance can be retuned from the admin dashboard without a deploy.
 */
export const GET = defineRoute(
  { auth: 'required', rateLimit: 'read', name: 'GET /api/jobs/recommended' },
  async ({ supabase, profile }) => {
    if (!profile?.is_hustler) return ok([])

    const { data, error } = await supabase.rpc('recommend_jobs', {
      p_hustler_id: profile.id,
      p_limit: 12,
    })

    if (error) throw error
    return ok((data ?? []) as JobRecommendation[])
  },
)
