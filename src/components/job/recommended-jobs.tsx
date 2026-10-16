'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { useRecommendedJobs } from '@/hooks/use-jobs'
import { formatBudget } from '@/lib/money'
import { formatDistanceShort } from '@/lib/geo'
import { Badge } from '@/components/ui/badge'
import { ChipRail } from '@/components/ui/chip'
import { Skeleton } from '@/components/ui/feedback'

/**
 * Personalised job rail.
 *
 * Each card carries the *reason* it was surfaced ("Matches your skills",
 * "Few applicants so far"). A recommendation you cannot explain is one people
 * stop trusting — and the scoring in `recommend_jobs()` is deterministic, so we
 * can always say why.
 */
export function RecommendedJobs() {
  const { data, isPending, isError } = useRecommendedJobs()

  if (isPending) {
    return (
      <div className="rail bleed">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-[152px] w-[260px] shrink-0 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError || !data || data.length === 0) return null

  return (
    <ChipRail ariaLabel="Recommended jobs">
      {data.slice(0, 8).map((job) => (
        <Link
          key={job.job_id}
          href={`/jobs/${job.job_id}`}
          className="street-card flex w-[260px] shrink-0 flex-col gap-2 p-4"
        >
          <Badge variant="primary" size="sm" className="self-start">
            <Sparkles aria-hidden="true" />
            {job.reason}
          </Badge>

          <h3 className="line-clamp-2 font-display text-[15px] font-medium leading-snug">
            {job.title}
          </h3>

          <p className="font-label text-lg font-semibold tabular-nums text-money">
            {formatBudget(job.budget_min_minor, job.budget_max_minor, job.currency)}
          </p>

          <p className="mt-auto text-xs text-muted-foreground">
            {[
              job.category_name,
              formatDistanceShort(job.distance_m),
              job.application_count === 0
                ? 'No applicants yet'
                : `${job.application_count} applied`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </Link>
      ))}
    </ChipRail>
  )
}
