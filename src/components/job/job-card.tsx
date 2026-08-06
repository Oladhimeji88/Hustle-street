'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Bookmark, MapPin, Users, Wifi } from 'lucide-react'
import { cn, countLabel } from '@/lib/utils'
import { formatBudget } from '@/lib/money'
import { formatDistanceShort } from '@/lib/geo'
import { formatSchedule, timeAgo } from '@/lib/format'
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
 * Everything else is noise. The layout is deliberately dense: on a 360px screen
 * a user should see three of these without scrolling.
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
        className="street-card block w-[260px] shrink-0 p-4 focus-visible:ring-2 focus-visible:ring-ring"
        data-surface={surface}
      >
        <div className="flex items-start justify-between gap-2">
          <Badge variant="neutral" size="sm">
            {job.category_name}
          </Badge>
          <UrgencyBadge urgency={job.urgency} />
        </div>
        <h3 className="mt-2.5 line-clamp-2 font-display text-[15px] font-bold leading-snug">
          {job.title}
        </h3>
        <p className="mt-2 font-display text-lg font-extrabold text-money">{budget}</p>
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

      <div className="relative p-4">
        <div className="flex gap-3.5">
          {job.cover_image ? (
            <div className="relative size-[68px] shrink-0 overflow-hidden rounded-xl bg-muted">
              <Image
                src={job.cover_image}
                alt=""
                fill
                sizes="68px"
                className="object-cover"
                unoptimized={job.cover_image.startsWith('http') === false}
              />
            </div>
          ) : (
            <div
              className="flex size-[68px] shrink-0 items-center justify-center rounded-xl bg-primary-soft text-2xl"
              aria-hidden="true"
            >
              {CATEGORY_EMOJI[job.category_slug] ?? '🛠️'}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 font-display text-[15px] font-bold leading-snug sm:text-base">
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
                  className="relative z-10 -mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Bookmark className={cn('size-[18px]', saved && 'fill-primary text-primary')} />
                </button>
              )}
            </div>

            <p className="mt-1.5 font-display text-lg font-extrabold leading-none text-money">
              {budget}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral" size="sm">
            {job.category_name}
          </Badge>
          <UrgencyBadge urgency={job.urgency} />
          {job.application_count > 0 && (
            <Badge variant="outline" size="sm">
              <Users aria-hidden="true" />
              {countLabel(job.application_count, 'applicant')}
            </Badge>
          )}
          {job.application_count === 0 && job.published_at && (
            <Badge variant="money" size="sm">
              Be the first to apply
            </Badge>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
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

        <time
          className="mt-2 block text-xs text-muted-foreground"
          dateTime={job.published_at ?? undefined}
        >
          {timeAgo(job.published_at)}
        </time>
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
