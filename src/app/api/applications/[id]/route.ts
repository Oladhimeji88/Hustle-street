import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { forbidden, notFound } from '@/lib/api/errors'
import { uuid } from '@/lib/validation/common'
import { applicationDecisionInput } from '@/lib/validation/job'
import { ANALYTICS_EVENTS, track } from '@/lib/analytics/server'
import { sendEmail, emailTemplates } from '@/lib/notifications/email'
import { sendPushToUser } from '@/lib/notifications/push'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatMoney } from '@/lib/money'
import type { AcceptApplicationResult } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/applications/:id — the hiring decision.
 *
 * `accept` runs the `accept_application` RPC, which atomically creates the
 * agreement, declines every other applicant, moves the job to HIRED, opens the
 * job conversation and creates the escrow-funding transaction. Either all of
 * that happens or none of it does.
 */
export const PATCH = defineRoute(
  {
    auth: 'required',
    paramsSchema: z.object({ id: uuid }),
    bodySchema: applicationDecisionInput,
    name: 'PATCH /api/applications/:id',
  },
  async ({ params: { id }, body, supabase, user }) => {
    const { data: application } = await supabase
      .from('job_applications')
      .select('id, job_id, hustler_id, status, proposed_price_minor, currency, jobs(poster_id, title)')
      .eq('id', id)
      .maybeSingle()

    if (!application) throw notFound('Application')

    const job = application.jobs as unknown as { poster_id: string; title: string } | null
    const isPoster = job?.poster_id === user!.id

    switch (body.action) {
      case 'accept': {
        if (!isPoster) throw forbidden('Only the job poster can accept an application.')

        const { data, error } = await supabase.rpc('accept_application', { p_application_id: id })
        if (error) throw error

        const result = (Array.isArray(data) ? data[0] : data) as AcceptApplicationResult

        await track(ANALYTICS_EVENTS.APPLICATION_ACCEPTED, { userId: user!.id })

        // Out-of-band delivery. Failures here are logged inside the helpers and
        // never roll back the hire.
        void notifyHired(application.hustler_id, job?.title ?? 'a job', result)

        return ok(result)
      }

      case 'decline': {
        if (!isPoster) throw forbidden('Only the job poster can decline an application.')

        const { data, error } = await supabase
          .from('job_applications')
          .update({
            status: 'declined',
            responded_at: new Date().toISOString(),
            decline_reason: body.reason ?? null,
          })
          .eq('id', id)
          .select('*')
          .single()

        if (error) throw error
        await track(ANALYTICS_EVENTS.APPLICATION_DECLINED, { userId: user!.id })
        return ok(data)
      }

      case 'shortlist':
      case 'unshortlist': {
        if (!isPoster) throw forbidden('Only the job poster can shortlist an application.')

        const shortlisting = body.action === 'shortlist'
        const { data, error } = await supabase
          .from('job_applications')
          .update({
            is_shortlisted: shortlisting,
            status: shortlisting ? 'shortlisted' : 'submitted',
          })
          .eq('id', id)
          .select('*')
          .single()

        if (error) throw error
        return ok(data)
      }

      default:
        throw forbidden()
    }
  },
)

/** DELETE /api/applications/:id — the hustler withdraws their own application. */
export const DELETE = defineRoute(
  { auth: 'required', paramsSchema: z.object({ id: uuid }), name: 'DELETE /api/applications/:id' },
  async ({ params: { id }, supabase, user }) => {
    const { data, error } = await supabase
      .from('job_applications')
      .update({ status: 'withdrawn', responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('hustler_id', user!.id)
      .eq('status', 'submitted')
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw notFound('Application')

    await track(ANALYTICS_EVENTS.APPLICATION_WITHDRAWN, { userId: user!.id })
    return ok(data)
  },
)

async function notifyHired(hustlerId: string, jobTitle: string, result: AcceptApplicationResult) {
  const admin = createAdminClient()
  const { data: hustler } = await admin
    .from('profiles')
    .select('email, display_name')
    .eq('id', hustlerId)
    .maybeSingle()

  const amount = formatMoney(result.amount_minor, result.currency)

  if (hustler?.email) {
    void sendEmail({
      to: hustler.email,
      ...emailTemplates.applicationAccepted({
        hustlerName: hustler.display_name,
        jobTitle,
        amount,
        jobId: result.assignment_id,
      }),
    })
  }

  void sendPushToUser(hustlerId, {
    title: "You've got the job! 🎉",
    body: `${jobTitle} — ${amount}`,
    url: `/jobs/${result.assignment_id}`,
    tag: `hired-${result.assignment_id}`,
    requireInteraction: true,
  })
}
