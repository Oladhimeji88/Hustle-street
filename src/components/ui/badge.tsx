import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { BadgeCheck, Clock, Flame, ShieldCheck, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApplicationStatus, JobStatus, TransactionStatus } from '@/types/database'

/**
 * Status badges — small mono-set cells.
 *
 * Two changes from the pill version. The shape is a 4px-cornered rectangle, so a
 * badge sits inside the grid rather than floating on it. And the label is set in
 * the mono face, which is doing real work here: it marks the text as *state read
 * off a record* rather than as prose someone wrote, which is exactly what a
 * status is. Uppercase with open tracking keeps it legible at 11px.
 *
 * `primary` uses `primary-text` rather than `primary` — the raw orange only
 * clears AA at large sizes, and a badge is the smallest text on the page.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm font-mono uppercase tracking-[0.06em] whitespace-nowrap [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        neutral: 'bg-secondary text-secondary-foreground',
        primary: 'bg-primary-soft text-primary-text',
        money: 'bg-money-soft text-money',
        warning: 'bg-warning-soft text-warning-foreground',
        destructive: 'bg-destructive-soft text-destructive',
        outline: 'border border-border text-muted-foreground',
        solid: 'bg-ink text-ink-foreground',
        /* The brand plane, for the one badge per screen that is a brand moment
           rather than a status. Ink label — see the note in button.tsx. */
        brand: 'bg-primary text-primary-foreground',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-eyebrow-sm [&_svg]:size-3',
        md: 'px-2 py-0.5 text-eyebrow-sm [&_svg]:size-3.5',
        lg: 'px-2.5 py-1 text-eyebrow [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'md' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

/**
 * Job status, in the product's own voice.
 *
 * The database enum is written for engineers ("APPLICATIONS_OPEN"); this is
 * what a person sees.
 */
const JOB_STATUS_META: Record<
  JobStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  PUBLISHED: { label: 'Live', variant: 'money' },
  APPLICATIONS_OPEN: { label: 'Taking applications', variant: 'money' },
  HIRED: { label: 'Awaiting payment', variant: 'warning' },
  IN_PROGRESS: { label: 'In progress', variant: 'primary' },
  SUBMITTED: { label: 'Awaiting your confirmation', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'money' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
  DISPUTED: { label: 'In dispute', variant: 'destructive' },
  EXPIRED: { label: 'Expired', variant: 'neutral' },
}

function JobStatusBadge({
  status,
  size = 'md',
  className,
}: {
  status: JobStatus
  size?: BadgeProps['size']
  className?: string
}) {
  const meta = JOB_STATUS_META[status]
  return (
    <Badge variant={meta.variant} size={size} className={className}>
      {meta.label}
    </Badge>
  )
}

const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  submitted: { label: 'Submitted', variant: 'neutral' },
  shortlisted: { label: 'Shortlisted', variant: 'primary' },
  accepted: { label: 'You got it', variant: 'money' },
  declined: { label: 'Not selected', variant: 'outline' },
  withdrawn: { label: 'Withdrawn', variant: 'outline' },
  expired: { label: 'Expired', variant: 'outline' },
}

function ApplicationStatusBadge({
  status,
  size = 'sm',
}: {
  status: ApplicationStatus
  size?: BadgeProps['size']
}) {
  const meta = APPLICATION_STATUS_META[status]
  return (
    <Badge variant={meta.variant} size={size}>
      {meta.label}
    </Badge>
  )
}

const TRANSACTION_STATUS_META: Record<
  TransactionStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  PENDING: { label: 'Pending', variant: 'outline' },
  AUTHORIZED: { label: 'Authorised', variant: 'primary' },
  HELD: { label: 'Secured', variant: 'money' },
  RELEASED: { label: 'Released', variant: 'money' },
  FAILED: { label: 'Failed', variant: 'destructive' },
  REFUNDED: { label: 'Refunded', variant: 'neutral' },
  DISPUTED: { label: 'Disputed', variant: 'destructive' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
}

function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  const meta = TRANSACTION_STATUS_META[status]
  return (
    <Badge variant={meta.variant} size="sm">
      {meta.label}
    </Badge>
  )
}

/** "Needed now" flag on urgent jobs. */
function UrgencyBadge({ urgency }: { urgency: 'flexible' | 'scheduled' | 'today' | 'asap' }) {
  if (urgency === 'asap') {
    return (
      <Badge variant="destructive" size="sm">
        <Flame aria-hidden="true" />
        ASAP
      </Badge>
    )
  }
  if (urgency === 'today') {
    return (
      <Badge variant="warning" size="sm">
        <Clock aria-hidden="true" />
        Today
      </Badge>
    )
  }
  return null
}

/** Trust indicators shown on profiles and job cards. */
function VerifiedBadge({
  kind,
  size = 'sm',
}: {
  kind: 'identity' | 'phone' | 'email'
  size?: BadgeProps['size']
}) {
  const meta = {
    identity: { icon: ShieldCheck, label: 'ID verified' },
    phone: { icon: BadgeCheck, label: 'Phone verified' },
    email: { icon: BadgeCheck, label: 'Email verified' },
  }[kind]

  const Icon = meta.icon

  return (
    <Badge variant="money" size={size}>
      <Icon aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}

/** Live availability pill with the pulsing dot. */
function AvailableNowBadge({ size = 'sm' }: { size?: BadgeProps['size'] }) {
  return (
    <Badge variant="money" size={size}>
      <span className="live-dot" aria-hidden="true" />
      Available now
    </Badge>
  )
}

function RemoteBadge({ size = 'sm' }: { size?: BadgeProps['size'] }) {
  return (
    <Badge variant="primary" size={size}>
      <Wifi aria-hidden="true" />
      Remote
    </Badge>
  )
}

export {
  Badge,
  badgeVariants,
  JobStatusBadge,
  ApplicationStatusBadge,
  TransactionStatusBadge,
  UrgencyBadge,
  VerifiedBadge,
  AvailableNowBadge,
  RemoteBadge,
  JOB_STATUS_META,
}
