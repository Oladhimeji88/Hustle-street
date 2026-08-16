'use client'

import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, MapPin, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { formatDistanceShort } from '@/lib/geo'
import { formatResponseTime } from '@/lib/format'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { RatingDisplay } from '@/components/ui/rating'
import type { HustlerSearchResult } from '@/types/database'

/**
 * The hustler card.
 *
 * Mirrors the job card's job: answer "can this person do it, are they near me,
 * are they available, can I trust them, what do they cost" without a tap.
 *
 * Trust signals are given real weight here — for a poster inviting a stranger
 * into their home, "127 jobs completed" and "ID verified" matter more than the
 * price.
 */

export interface HustlerCardProps {
  hustler: HustlerSearchResult
  /** Shown when recommending hustlers for a specific job. */
  reason?: string
  onInvite?: (hustlerId: string) => void
  variant?: 'default' | 'compact'
  className?: string
}

export function HustlerCard({ hustler, reason, onInvite, variant = 'default', className }: HustlerCardProps) {
  const price = hustler.starting_price_minor ?? hustler.hourly_rate_minor
  const priceLabel = price
    ? `${formatMoney(price, hustler.currency, { compact: true })}${hustler.starting_price_minor ? '' : '/hr'}`
    : null

  const locationLabel =
    hustler.distance_m != null
      ? [formatDistanceShort(hustler.distance_m), hustler.area ?? hustler.city].filter(Boolean).join(' · ')
      : (hustler.area ?? hustler.city ?? null)

  if (variant === 'compact') {
    return (
      <Link
        href={`/hustlers/${hustler.username}`}
        className="street-card flex w-[180px] shrink-0 flex-col items-center gap-2 p-4 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Avatar
          src={hustler.avatar_url}
          name={hustler.display_name}
          seed={hustler.id}
          size="lg"
          online={hustler.available_now}
        />
        <div className="min-w-0">
          <p className="truncate font-display text-body-base font-medium">{hustler.display_name}</p>
          {hustler.headline && (
            <p className="truncate text-xs text-muted-foreground">{hustler.headline}</p>
          )}
        </div>
        <RatingDisplay rating={hustler.rating_avg} count={hustler.rating_count} size="sm" />
        {priceLabel && <p className="text-xs font-semibold text-money">from {priceLabel}</p>}
      </Link>
    )
  }

  return (
    <article className={cn('street-card relative overflow-hidden', className)}>
      <Link
        href={`/hustlers/${hustler.username}`}
        className="absolute inset-0 z-0"
        aria-label={`View ${hustler.display_name}'s profile`}
      />

      <div className="relative p-4">
        <div className="flex gap-3.5">
          <Avatar
            src={hustler.avatar_url}
            name={hustler.display_name}
            seed={hustler.id}
            size="lg"
            online={hustler.available_now}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-display text-base font-medium leading-tight">
                {hustler.display_name}
              </h3>
              {hustler.identity_verified && (
                <CheckCircle2
                  className="size-4 shrink-0 fill-money text-money-foreground"
                  aria-label="Identity verified"
                />
              )}
            </div>

            {hustler.headline && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{hustler.headline}</p>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <RatingDisplay rating={hustler.rating_avg} count={hustler.rating_count} size="sm" />
              {hustler.jobs_completed > 0 && (
                <>
                  <span className="text-xs text-muted-foreground" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {hustler.jobs_completed} jobs done
                  </span>
                </>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
              {locationLabel && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {locationLabel}
                </span>
              )}
              {hustler.accepts_remote && (
                <span className="inline-flex items-center gap-1">
                  <Wifi className="size-3.5" aria-hidden="true" />
                  Works remotely
                </span>
              )}
            </div>
          </div>

          {priceLabel && (
            <div className="shrink-0 text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">From</p>
              <p className="font-label text-base font-semibold tabular-nums text-money">{priceLabel}</p>
            </div>
          )}
        </div>

        {hustler.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {hustler.skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="neutral" size="sm">
                {skill}
              </Badge>
            ))}
            {hustler.skills.length > 4 && (
              <Badge variant="outline" size="sm">
                +{hustler.skills.length - 4}
              </Badge>
            )}
          </div>
        )}

        {(hustler.available_now || hustler.response_time_secs || reason) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
            {hustler.available_now && (
              <span className="inline-flex items-center gap-1.5 font-medium text-money">
                <span className="live-dot" aria-hidden="true" />
                Available now
              </span>
            )}
            {hustler.response_time_secs ? (
              <span className="text-muted-foreground">
                {formatResponseTime(hustler.response_time_secs)}
              </span>
            ) : null}
            {reason && <span className="text-muted-foreground">· {reason}</span>}

            {onInvite && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onInvite(hustler.id)
                }}
                /* At rest the label is the readable orange on the soft fill
                   (4.55:1); on hover the fill becomes the full-strength brand
                   plane and the label flips to ink (6.15:1). Bare `text-primary`
                   on `bg-primary-soft` measures 2.91:1 and fails outright. */
                className="relative z-10 ml-auto rounded-md bg-primary-soft px-3 py-1.5 font-display text-button-sm text-primary-text transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Invite
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
