import { z } from 'zod'
import { defineRoute } from '@/lib/api/handler'
import { ok } from '@/lib/api/response'
import { ApiError } from '@/lib/api/errors'
import { uuid } from '@/lib/validation/common'

export const dynamic = 'force-dynamic'

const params = z.object({ id: uuid })

/**
 * GET /api/jobs/:id/contact — the other party's phone number, if you are
 * entitled to it.
 *
 * Phone numbers are deliberately absent from `JobSearchResult` and from every
 * public listing surface. A number on a public board is a number that gets
 * scraped, and the platform tells users plainly that theirs is never shown. So
 * rather than widen the search payload, the number is fetched on demand and
 * only for a caller who already has a working relationship to the job:
 *
 *   • the poster, once someone is assigned — they may need to reach the hustler
 *     who is on their way
 *   • the assigned hustler — same, in the other direction
 *
 * Everyone else, including a signed-in user merely browsing, gets a 403 with a
 * reason the UI can show. An applicant who has not been accepted is explicitly
 * *not* entitled: until money is committed, in-app messaging is the channel, and
 * that keeps the negotiation on the record where a dispute can reach it.
 *
 * Only assignment states in which work is actually live qualify. A cancelled or
 * still-unpaid assignment does not hand over a phone number.
 */
const LIVE_STATES = ['accepted', 'in_progress', 'submitted', 'confirmed', 'completed']

export const GET = defineRoute(
  { auth: 'required', paramsSchema: params, name: 'GET /api/jobs/:id/contact' },
  async ({ params: { id }, supabase, user }) => {
    const { data: assignment, error } = await supabase
      .from('job_assignments')
      .select('hustler_id, poster_id, status')
      .eq('job_id', id)
      .in('status', LIVE_STATES)
      .maybeSingle()

    if (error) throw error

    if (!assignment) {
      throw new ApiError(
        'FORBIDDEN',
        'Phone numbers are shared once a hustler is hired. Message them here until then.',
      )
    }

    const isPoster = assignment.poster_id === user!.id
    const isHustler = assignment.hustler_id === user!.id

    if (!isPoster && !isHustler) {
      throw new ApiError(
        'FORBIDDEN',
        'Only the poster and the hired hustler can see each other’s number.',
      )
    }

    // Hand back the *counterparty's* number, never your own.
    const counterpartyId = isPoster ? assignment.hustler_id : assignment.poster_id

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, phone, phone_verified')
      .eq('id', counterpartyId)
      .maybeSingle()

    if (profileError) throw profileError

    if (!profile?.phone) {
      throw new ApiError(
        'NOT_FOUND',
        'They have not added a phone number. Message them here instead.',
      )
    }

    return ok({
      name: profile.display_name,
      phone: profile.phone,
      verified: profile.phone_verified ?? false,
    })
  },
)
