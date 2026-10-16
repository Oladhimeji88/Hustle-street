import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

/** GET /api/jobs/saved/ids — ids only, so bookmark state renders without a join. */
export const GET = defineRoute(
  { auth: 'required', rateLimit: 'read', name: 'GET /api/jobs/saved/ids' },
  async ({ supabase, user }) => {
    const { data, error } = await supabase
      .from('saved_jobs')
      .select('job_id')
      .eq('user_id', user!.id)

    if (error) throw error
    return ok((data ?? []).map((row) => row.job_id))
  },
)
