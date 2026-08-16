'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Chip — the selection primitive that carries the marketplace feel.
 *
 * Used for categories, filters, skills and quick actions. Deliberately chunky:
 * these are the main way people navigate on a phone, so they are sized for
 * thumbs, not cursors.
 *
 * Now a small square cell rather than a pill. A row of pills reads as tags
 * scattered on the page; a row of 6px-cornered cells reads as a set of switches
 * belonging to the grid, which is what a filter row actually is. Selection is
 * ink rather than orange — orange is a brand plane in this system, and a filter
 * being on is a state, not a brand moment.
 */

export interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  selected?: boolean
  icon?: React.ReactNode
  count?: number
  size?: 'sm' | 'md' | 'lg'
  onRemove?: () => void
}

const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, selected, icon, count, size = 'md', onRemove, children, ...props }, ref) => {
    const sizes = {
      sm: 'h-8 px-3 text-button-sm gap-1.5 [&_svg]:size-3.5',
      md: 'h-10 px-4 text-button-sm gap-2 [&_svg]:size-4',
      lg: 'h-12 px-5 text-button-lg gap-2 [&_svg]:size-4',
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={selected}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md border font-display transition-colors duration-150',
          'focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
          sizes[size],
          selected
            ? 'border-ink bg-ink text-ink-foreground'
            : 'border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-muted',
          className,
        )}
        {...props}
      >
        {icon}
        <span className="truncate">{children}</span>
        {count !== undefined && count > 0 && (
          <span
            className={cn(
              'rounded-sm px-1.5 py-0.5 font-mono text-eyebrow-sm tabular-nums',
              selected ? 'bg-ink-foreground/20' : 'bg-surface-muted text-muted-foreground',
            )}
          >
            {count}
          </span>
        )}
        {onRemove && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Remove"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            className="-mr-1 ml-0.5 rounded-sm p-0.5 opacity-70 transition-opacity hover:opacity-100"
          >
            <X aria-hidden="true" />
          </span>
        )}
      </button>
    )
  },
)
Chip.displayName = 'Chip'

/**
 * Horizontally scrolling chip rail with edge fades so it is obvious there is
 * more to scroll — a very common mobile discoverability failure.
 */
function ChipRail({
  children,
  className,
  ariaLabel,
}: {
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <div className="rail bleed py-0.5" role="group" aria-label={ariaLabel}>
        {children}
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden"
        aria-hidden="true"
      />
    </div>
  )
}

export { Chip, ChipRail }
