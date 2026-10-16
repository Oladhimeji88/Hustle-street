import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { uuid } from '@/lib/validation/common'
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

const params = z.object({ id: uuid })

/** POST /api/jobs/:id/save — bookmark. Idempotent: saving twice is not an error. */
export const POST = defineRoute(
  { auth: 'required', paramsSchema: params, name: 'POST /api/jobs/:id/save' },
  async ({ params: { id }, supabase, user }) => {
    const { error } = await supabase
      .from('saved_jobs')
      .upsert({ user_id: user!.id, job_id: id }, { onConflict: 'user_id,job_id', ignoreDuplicates: true })

    if (error) throw error
    void track(ANALYTICS_EVENTS.JOB_SAVED, { userId: user!.id })
    return ok({ saved: true })
  },
)

export const DELETE = defineRoute(
  { auth: 'required', paramsSchema: params, name: 'DELETE /api/jobs/:id/save' },
  async ({ params: { id }, supabase, user }) => {
    const { error } = await supabase
      .from('saved_jobs')
      .delete()
      .eq('user_id', user!.id)
      .eq('job_id', id)

    if (error) throw error
    return ok({ saved: false })
  },
)
