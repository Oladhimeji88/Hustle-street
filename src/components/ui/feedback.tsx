import * as React from 'react'
import { AlertTriangle, Loader2, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

/**
 * Loading, empty and error states.
 *
 * §41 of the product brief: never leave a user staring at a blank screen. These
 * are the three states every list, page and panel must handle, so they are
 * primitives rather than something each screen improvises.
 */

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shimmer rounded-lg', className)} aria-hidden="true" {...props} />
}

/** Matches the real job card's geometry so the layout does not jump on load. */
function JobCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex gap-3">
        <Skeleton className="size-14 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

function HustlerCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
    </div>
  )
}

function ListSkeleton({ count = 4, variant = 'job' }: { count?: number; variant?: 'job' | 'hustler' }) {
  const Item = variant === 'job' ? JobCardSkeleton : HustlerCardSkeleton
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Item key={i} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </span>
  )
}

/** Full-width loading state with the product's own copy, not "Loading…". */
function LoadingState({ message = 'Finding nearby jobs…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="status">
      <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
  secondaryAction?: { label: string; href?: string; onClick?: () => void }
  className?: string
}

function EmptyState({ icon, title, description, action, secondaryAction, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div
          className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary [&_svg]:size-6"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
      {description && (
        <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action &&
            (action.href ? (
              <Button asChild size="sm">
                <a href={action.href}>{action.label}</a>
              </Button>
            ) : (
              <Button size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          {secondaryAction &&
            (secondaryAction.href ? (
              <Button asChild size="sm" variant="ghost">
                <a href={secondaryAction.href}>{secondaryAction.label}</a>
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  )
}

function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this right now. Please try again.',
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/25 bg-destructive-soft px-6 py-12 text-center',
        className,
      )}
    >
      <AlertTriangle className="size-7 text-destructive" aria-hidden="true" />
      <h3 className="font-display text-base font-bold">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  )
}

function OfflineState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      <WifiOff className="size-7 text-muted-foreground" aria-hidden="true" />
      <h3 className="font-display text-base font-bold">You&rsquo;re offline</h3>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Some things still work. Anything you send will go out as soon as you&rsquo;re back on.
      </p>
    </div>
  )
}

export {
  Skeleton,
  JobCardSkeleton,
  HustlerCardSkeleton,
  ListSkeleton,
  Spinner,
  LoadingState,
  EmptyState,
  ErrorState,
  OfflineState,
}
