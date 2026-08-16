'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, MapPin } from 'lucide-react'
import { useLocation } from '@/components/location/location-provider'
import { formatBudget } from '@/lib/money'
import { formatDistanceShort } from '@/lib/geo'
import { timeAgo } from '@/lib/format'
import { Skeleton } from '@/components/ui/feedback'
import { CATEGORY_EMOJI } from '@/components/job/job-card'
import type { ApiResponseBody } from '@/lib/api/response'
import type { JobSearchResult } from '@/types/database'

/**
 * Live "jobs near you" strip on the landing page.
 *
 * This is real marketplace data, fetched from the same endpoint the app uses.
 * A landing page showing invented listings would be the exact thing §62 of the
 * brief forbids — and it would set a false expectation about liquidity.
 */
export function NearbyJobsPreview() {
  const { coords, label, isResolved } = useLocation()

  const { data, isPending, isError } = useQuery({
    queryKey: ['landing-nearby-jobs', coords.lat, coords.lng],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: String(coords.lat),
        lng: String(coords.lng),
        radiusKm: '25',
        sort: 'newest',
        pageSize: '3',
      })
      const response = await fetch(`/api/jobs?${params}`)
      const body = (await response.json()) as ApiResponseBody<JobSearchResult[]>
      if (!body.ok) throw new Error(body.error.message)
      return body.data
    },
    staleTime: 120_000,
  })

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden="true" />
          Jobs near {isResolved ? label : 'Lagos'}
        </p>
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 font-display text-eyebrow font-medium text-primary-text hover:underline"
        >
          See all
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>

      {isPending && (
        <div className="space-y-2" role="status" aria-label="Loading nearby jobs">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Could not load nearby jobs right now.
        </p>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-4 text-center">
          <p className="text-sm font-medium">No jobs here yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Be the first — posting is free.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((job) => (
            <li key={job.id}>
              <Link
                href={`/jobs/${job.id}`}
                className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-lg"
                  aria-hidden="true"
                >
                  {CATEGORY_EMOJI[job.category_slug] ?? '🛠️'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{job.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[
                      formatDistanceShort(job.distance_m),
                      job.area_label ?? job.city,
                      timeAgo(job.published_at),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-money">
                  {formatBudget(job.budget_min_minor, job.budget_max_minor, job.currency, job.budget_kind)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
