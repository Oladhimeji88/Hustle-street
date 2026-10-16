import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Card surfaces — grid cells, in this system.
 *
 * The change from the previous version is that a card no longer distinguishes
 * itself by being lighter than the page or by casting a shadow. It sits at the
 * same fill as the paper and is defined entirely by its hairline. That is what
 * lets cards butt up against each other into a continuous grid instead of
 * floating as separate objects with gutters between them.
 *
 * `interactive` deepens the fill on hover and settles 1px on press. It is opt-in
 * because a container that reacts to a cursor passing over it is noise unless
 * the whole thing is a link.
 *
 * `flush` now means "no radius" rather than "no shadow" — for cells that are
 * part of a larger grid and must not round away from their neighbours.
 */

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; flush?: boolean }
>(({ className, interactive, flush, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'border border-border bg-card text-card-foreground',
      flush ? 'rounded-none' : 'rounded-md',
      interactive && 'lift cursor-pointer',
      className,
    )}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 p-4 sm:p-5', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4' }
>(({ className, as: Tag = 'h3', ...props }, ref) => (
  // Weight 500, not bold. Nothing in this type system goes past 500 for a
  // heading — see the note on the scale in tailwind.config.ts.
  <Tag ref={ref} className={cn('font-display text-h6 font-medium', className)} {...props} />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-body-sm leading-relaxed text-muted-foreground', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-0 sm:p-5 sm:pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-2 border-t border-border p-4 sm:p-5', className)}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'

/** Section heading with an optional "See all" action. Used all over the home feed. */
function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="font-display text-h5">{title}</h2>
        {subtitle && <p className="mt-0.5 text-body-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, SectionHeader }
