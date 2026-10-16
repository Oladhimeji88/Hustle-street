'use client'

import * as React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRating } from '@/lib/format'

/**
 * Star rating — display and input.
 *
 * The input variant is a real radio group, so it is keyboard operable and
 * announces "3 of 5 stars" rather than being a row of unlabelled buttons.
 */

const SIZES = { sm: 'size-3.5', md: 'size-4', lg: 'size-5', xl: 'size-7' } as const

function Stars({
  value,
  size = 'md',
  className,
}: {
  value: number
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, value - index))
        return (
          <span key={index} className="relative inline-block">
            <Star className={cn(SIZES[size], 'text-border')} />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className={cn(SIZES[size], 'fill-warning text-warning')} />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

/**
 * The compact rating shown on cards: ★ 4.9 (127).
 *
 * A hustler with no reviews shows "New" rather than a zero — a 0.0 next to a
 * new person's name is both wrong and discouraging.
 */
function RatingDisplay({
  rating,
  count,
  size = 'md',
  showCount = true,
  className,
}: {
  rating: number | null | undefined
  count?: number | null
  size?: keyof typeof SIZES
  showCount?: boolean
  className?: string
}) {
  const hasRating = Boolean(rating && rating > 0 && count && count > 0)

  if (!hasRating) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm text-muted-foreground', className)}>
        <Star className={cn(SIZES[size], 'text-border')} aria-hidden="true" />
        New
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Star className={cn(SIZES[size], 'fill-warning text-warning')} aria-hidden="true" />
      <span className="text-sm font-semibold tabular-nums">{formatRating(rating)}</span>
      {showCount && count ? (
        <span className="text-sm text-muted-foreground">({count})</span>
      ) : null}
      <span className="sr-only">
        Rated {formatRating(rating)} out of 5{count ? ` from ${count} reviews` : ''}
      </span>
    </span>
  )
}

const RATING_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent']

function RatingInput({
  value,
  onChange,
  name,
  size = 'xl',
  showLabel = true,
  className,
}: {
  value: number
  onChange: (value: number) => void
  name: string
  size?: keyof typeof SIZES
  showLabel?: boolean
  className?: string
}) {
  const [hovered, setHovered] = React.useState<number | null>(null)
  const display = hovered ?? value

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        role="radiogroup"
        aria-label="Rating"
        className="inline-flex items-center gap-1"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((score) => (
          <label
            key={score}
            className="cursor-pointer rounded-md p-1 transition-transform hover:scale-110 focus-within:ring-2 focus-within:ring-ring"
            onMouseEnter={() => setHovered(score)}
          >
            <input
              type="radio"
              name={name}
              value={score}
              checked={value === score}
              onChange={() => onChange(score)}
              className="sr-only"
            />
            <Star
              className={cn(
                SIZES[size],
                'transition-colors',
                score <= display ? 'fill-warning text-warning' : 'text-border',
              )}
              aria-hidden="true"
            />
            <span className="sr-only">
              {score} {score === 1 ? 'star' : 'stars'} — {RATING_LABELS[score - 1]}
            </span>
          </label>
        ))}
      </div>

      {showLabel && (
        <p className="h-5 text-sm font-medium text-muted-foreground" aria-live="polite">
          {display > 0 ? RATING_LABELS[display - 1] : 'Tap a star to rate'}
        </p>
      )}
    </div>
  )
}

/** Per-category score bar used on profile review breakdowns. */
function RatingBar({ label, value }: { label: string; value: number | null }) {
  const percent = value ? (value / 5) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-warning transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">
        {value ? value.toFixed(1) : '—'}
      </span>
    </div>
  )
}

export { Stars, RatingDisplay, RatingInput, RatingBar, RATING_LABELS }
