'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Bookmark, MapPin, Wifi } from 'lucide-react'
import { cn, countLabel } from '@/lib/utils'
import { formatBudget } from '@/lib/money'
import { formatDistanceShort } from '@/lib/geo'
import { formatSchedule } from '@/lib/format'
import { Avatar } from '@/components/ui/avatar'
import { Badge, UrgencyBadge } from '@/components/ui/badge'
import { RatingDisplay } from '@/components/ui/rating'
import { JobContactActions } from './job-contact-actions'
import type { JobSearchResult } from '@/types/database'

/**
 * The job card — the single most important component in the product.
 *
 * It has to answer, at a glance and in this order:
 *   1. What is the job?      (title, category)
 *   2. What does it pay?     (budget, in money green)
 *   3. Where is it?          (distance + area — never an exact address)
 *   4. When?                 (schedule / urgency)
 *   5. What are my odds?     (applicant count)
 *   6. Can I trust them?     (poster rating + verification)
 *
 * Everything else is noise — and that list is now enforced rather than merely
 * stated. The card had grown a posted-at timestamp, an applicant-count badge and
 * a "Be the first to apply" nudge, none of which answer one of the six: the
 * timestamp restated the schedule line, and the nudge fired on every job with no
 * applicants, which is most of them. They are gone, the count moved into the
 * situational line as text, and the space they freed went into padding.
 *
 * The result is fewer elements at more generous spacing rather than a shorter
 * card, which is the trade that was wanted: density of *information* was never
 * the problem, density of *marks* was.
 */

export interface JobCardProps {
  job: JobSearchResult
  saved?: boolean
  onToggleSave?: (jobId: string, nextSaved: boolean) => void
  /** Compact variant for horizontal rails on the home screen. */
  variant?: 'default' | 'compact'
  className?: string
  /** Where the card was rendered, for analytics attribution. */
  surface?: string
}

export function JobCard({
  job,
  saved = false,
  onToggleSave,
  variant = 'default',
  className,
  surface,
}: JobCardProps) {
  const isRemote = job.location_kind === 'remote'
  const budget = formatBudget(job.budget_min_minor, job.budget_max_minor, job.currency, job.budget_kind)

  const locationLabel = isRemote
    ? 'Remote'
    : [formatDistanceShort(job.distance_m), job.area_label ?? job.city].filter(Boolean).join(' · ')

  const scheduleLabel =
    job.schedule_kind === 'date' && job.scheduled_for
      ? formatSchedule(job.scheduled_for)
      : job.schedule_kind === 'asap'
        ? 'As soon as possible'
        : job.schedule_kind === 'today'
          ? 'Today'
          : job.schedule_kind === 'tomorrow'
            ? 'Tomorrow'
            : 'Flexible timing'

  if (variant === 'compact') {
    return (
      <Link
        href={`/jobs/${job.id}`}
        className="street-card block w-[260px] shrink-0 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        data-surface={surface}
      >
        <div className="flex items-start justify-between gap-2">
          <Badge variant="neutral" size="sm">
            {job.category_name}
          </Badge>
          <UrgencyBadge urgency={job.urgency} />
        </div>
        <h3 className="mt-2.5 line-clamp-2 font-display text-[15px] font-medium leading-snug">
          {job.title}
        </h3>
        <p className="mt-2 font-label text-lg font-semibold tabular-nums text-money">{budget}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {isRemote ? <Wifi className="size-3.5" /> : <MapPin className="size-3.5" />}
          <span className="truncate">{locationLabel}</span>
        </p>
      </Link>
    )
  }

  return (
    <article className={cn('street-card relative overflow-hidden', className)} data-surface={surface}>
      {/* The whole card is the link; interactive children sit above it. */}
      <Link href={`/jobs/${job.id}`} className="absolute inset-0 z-0" aria-label={job.title}>
        <span className="sr-only">View job: {job.title}</span>
      </Link>

      <div className="relative p-5">
        <div className="flex gap-4">
          {job.cover_image ? (
            <div className="relative size-[72px] shrink-0 overflow-hidden rounded-xl bg-muted">
              <Image
                src={job.cover_image}
                alt=""
                fill
                sizes="72px"
                className="object-cover"
                unoptimized={job.cover_image.startsWith('http') === false}
              />
            </div>
          ) : (
            <div
              className="flex size-[72px] shrink-0 items-center justify-center rounded-xl bg-primary-soft text-2xl"
              aria-hidden="true"
            >
              {CATEGORY_EMOJI[job.category_slug] ?? '🛠️'}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 font-display text-[15px] font-medium leading-snug sm:text-base">
                {job.title}
              </h3>

              {onToggleSave && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onToggleSave(job.id, !saved)
                  }}
                  aria-label={saved ? 'Remove from saved jobs' : 'Save this job'}
                  aria-pressed={saved}
                  className="relative z-10 -mr-1.5 -mt-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Bookmark className={cn('size-[18px]', saved && 'fill-primary text-primary')} />
                </button>
              )}
            </div>

            <p className="mt-2 font-label text-lg font-semibold leading-none tabular-nums text-money">
              {budget}
            </p>

            {/*
             * One line for everything situational: where, when, and how many
             * people are already in. These were a metadata row plus two badges;
             * they are the same three facts either way, and as sentence-cased
             * text they read in one pass instead of three.
             */}
            <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {isRemote ? (
                  <Wifi className="size-3.5" aria-hidden="true" />
                ) : (
                  <MapPin className="size-3.5" aria-hidden="true" />
                )}
                {locationLabel || 'Location on request'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{scheduleLabel}</span>
              {job.application_count > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{countLabel(job.application_count, 'applicant')}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/*
         * Two badges at most, and the second only when it is actually saying
         * something. This row used to run to four: category, urgency, an
         * applicant count, and a "Be the first to apply" nudge. The count moved
         * into the line above, and the nudge went entirely — it fired on every
         * job with no applicants, which on a quiet board is most of them, so it
         * marked nothing out. A badge that is always on is decoration.
         */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral" size="sm">
            {job.category_name}
          </Badge>
          <UrgencyBadge urgency={job.urgency} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar
              src={job.poster_avatar}
              name={job.poster_name}
              seed={job.poster_id}
              size="xs"
            />
            <span className="truncate text-xs font-medium">{job.poster_name}</span>
            {job.poster_identity_verified && (
              <span className="text-money" title="Identity verified" aria-label="Identity verified">
                ✓
              </span>
            )}
            <RatingDisplay
              rating={job.poster_rating}
              count={job.poster_jobs_posted}
              size="sm"
              showCount={false}
              className="shrink-0"
            />
          </div>
          <JobContactActions jobId={job.id} posterName={job.poster_name} />
        </div>
      </div>
    </article>
  )
}

/**
 * Category emoji fallbacks.
 *
 * Deliberately emoji rather than icons: they render instantly with no extra
 * request, they carry colour, and they read as friendly rather than corporate —
 * which is the whole point of the brand.
 */
export const CATEGORY_EMOJI: Record<string, string> = {
  cleaning: '🧹',
  repairs: '🔧',
  moving: '📦',
  delivery: '🛵',
  design: '🎨',
  photography: '📸',
  beauty: '💅',
  tech: '💻',
  events: '🎉',
  tutoring: '📚',
  construction: '🏗️',
  'home-services': '🏠',
  errands: '🛒',
  'digital-services': '🌐',
  other: '🛠️',
}
