import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'

export const revalidate = 300

/** GET /api/categories — the marketplace taxonomy, admin-managed. */
export const GET = defineRoute(
  { auth: 'none', rateLimit: 'read', name: 'GET /api/categories' },
  async ({ supabase }) => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, parent_id, slug, name, description, icon, color, position, job_count, min_budget_minor')
      .eq('is_active', true)
      .order('position')

    if (error) throw error
    return ok(data ?? [])
  },
)
