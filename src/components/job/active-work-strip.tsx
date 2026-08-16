import Link from 'next/link'
import { ArrowRight, CircleDot, Clock, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/money'
import { formatCountdown } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import type { AssignmentStatus, CurrencyCode } from '@/types/database'

interface ActiveAssignment {
  id: string
  job_id: string
  status: AssignmentStatus
  agreed_price_minor: number
  hustler_net_minor: number
  currency: CurrencyCode
  auto_confirm_at: string | null
  poster_id: string
  hustler_id: string
  jobs: { title: string; status: string } | null
}

/**
 * Work in flight.
 *
 * Anything the user needs to act on outranks discovery entirely: an unfunded
 * hire, a job awaiting confirmation, work in progress. This is the difference
 * between a marketplace people browse and one they actually complete jobs on.
 */
export async function ActiveWorkStrip({ userId }: { userId: string }) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('job_assignments')
    .select(
      'id, job_id, status, agreed_price_minor, hustler_net_minor, currency, auto_confirm_at, poster_id, hustler_id, jobs(title, status)',
    )
    .or(`poster_id.eq.${userId},hustler_id.eq.${userId}`)
    .in('status', ['pending_payment', 'active', 'submitted', 'disputed'])
    .order('updated_at', { ascending: false })
    .limit(3)

  const assignments = (data ?? []) as unknown as ActiveAssignment[]
  if (assignments.length === 0) return null

  return (
    <section className="mt-6" aria-labelledby="active-work">
      <h2 id="active-work" className="mb-2.5 font-display text-lg font-medium tracking-tight">
        Needs your attention
      </h2>

      <ul className="space-y-2.5">
        {assignments.map((assignment) => {
          const isPoster = assignment.poster_id === userId
          const state = describeAssignment(assignment, isPoster)

          return (
            <li key={assignment.id}>
              <Link
                href={`/jobs/${assignment.job_id}`}
                className="street-card flex items-center gap-3 p-4"
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${state.tone}`}
                  aria-hidden="true"
                >
                  <state.icon className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-medium">
                    {assignment.jobs?.title ?? 'Job'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{state.detail}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-bold tabular-nums text-money">
                    {formatMoney(
                      isPoster ? assignment.agreed_price_minor : assignment.hustler_net_minor,
                      assignment.currency,
                      { compact: true },
                    )}
                  </p>
                  {state.badge && (
                    <Badge variant={state.badgeVariant} size="sm" className="mt-1">
                      {state.badge}
                    </Badge>
                  )}
                </div>

                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function describeAssignment(assignment: ActiveAssignment, isPoster: boolean) {
  switch (assignment.status) {
    case 'pending_payment':
      return isPoster
        ? {
            icon: ShieldCheck,
            tone: 'bg-warning-soft text-warning-foreground',
            detail: 'Secure the payment so work can start',
            badge: 'Pay now',
            badgeVariant: 'warning' as const,
          }
        : {
            icon: Clock,
            tone: 'bg-warning-soft text-warning-foreground',
            detail: 'Waiting for the poster to fund this job',
            badge: 'Awaiting payment',
            badgeVariant: 'warning' as const,
          }

    case 'active':
      return {
        icon: CircleDot,
        tone: 'bg-primary-soft text-primary',
        detail: isPoster ? 'Work in progress' : 'Get it done, then submit for confirmation',
        badge: 'In progress',
        badgeVariant: 'primary' as const,
      }

    case 'submitted':
      return isPoster
        ? {
            icon: ShieldCheck,
            tone: 'bg-money-soft text-money',
            detail: assignment.auto_confirm_at
              ? `Confirm to release payment · auto-releases ${formatCountdown(assignment.auto_confirm_at).toLowerCase()}`
              : 'Confirm to release payment',
            badge: 'Confirm',
            badgeVariant: 'money' as const,
          }
        : {
            icon: Clock,
            tone: 'bg-money-soft text-money',
            detail: 'Submitted — waiting for confirmation',
            badge: 'Submitted',
            badgeVariant: 'money' as const,
          }

    case 'disputed':
      return {
        icon: ShieldCheck,
        tone: 'bg-destructive-soft text-destructive',
        detail: 'A dispute is open on this job',
        badge: 'Disputed',
        badgeVariant: 'destructive' as const,
      }

    default:
      return {
        icon: CircleDot,
        tone: 'bg-secondary text-secondary-foreground',
        detail: 'Open job',
        badge: undefined,
        badgeVariant: 'neutral' as const,
      }
  }
}
