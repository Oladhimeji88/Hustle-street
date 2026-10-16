import {
  differenceInMinutes,
  differenceInSeconds,
  format,
  formatDistanceToNowStrict,
  isThisYear,
  isToday,
  isTomorrow,
  isYesterday,
} from 'date-fns'

/**
 * Date and time presentation.
 *
 * Nothing here hardcodes a locale or timezone beyond a default — the product is
 * built for Lagos first but must not need a rewrite to launch in Nairobi.
 */

export const DEFAULT_TIMEZONE = 'Africa/Lagos'
export const DEFAULT_LOCALE = 'en-NG'

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "2 min ago", "3 h ago", "5 d ago". Used on job cards and message lists. */
export function timeAgo(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''

  const seconds = differenceInSeconds(new Date(), date)
  if (seconds < 45) return 'Just now'

  return `${formatDistanceToNowStrict(date, { addSuffix: false })} ago`
}

/** Calendar-aware label: "Today, 4:00 PM", "Tomorrow, 9:30 AM", "12 Mar, 2:00 PM". */
export function formatSchedule(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return 'Flexible'

  const time = format(date, 'h:mm a')

  if (isToday(date)) return `Today, ${time}`
  if (isTomorrow(date)) return `Tomorrow, ${time}`
  if (isYesterday(date)) return `Yesterday, ${time}`
  if (isThisYear(date)) return `${format(date, 'd MMM')}, ${time}`
  return `${format(date, 'd MMM yyyy')}, ${time}`
}

/** Date only: "12 March 2026". */
export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''
  return format(date, isThisYear(date) ? 'd MMMM' : 'd MMMM yyyy')
}

/** Compact date for tables and exports. */
export function formatDateShort(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''
  return format(date, 'dd/MM/yyyy')
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''
  return format(date, 'd MMM yyyy, h:mm a')
}

/** Message-list timestamp: time today, weekday this week, date otherwise. */
export function formatMessageTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''

  if (isToday(date)) return format(date, 'h:mm a')
  if (isYesterday(date)) return 'Yesterday'

  const daysAgo = differenceInMinutes(new Date(), date) / (60 * 24)
  if (daysAgo < 7) return format(date, 'EEEE')
  if (isThisYear(date)) return format(date, 'd MMM')
  return format(date, 'dd/MM/yy')
}

/** Day separator inside a conversation. */
export function formatMessageDay(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (isThisYear(date)) return format(date, 'EEEE, d MMMM')
  return format(date, 'd MMMM yyyy')
}

/** Countdown for auto-confirmation and dispute SLAs: "2 days left", "5 h left". */
export function formatCountdown(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''

  const minutes = differenceInMinutes(date, new Date())
  if (minutes <= 0) return 'Overdue'
  if (minutes < 60) return `${minutes} min left`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} left`

  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} left`
}

/** Response-time badge: "Replies in ~15 min". */
export function formatResponseTime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return ''
  if (seconds < 3600) return `Replies in ~${Math.max(1, Math.round(seconds / 60))} min`
  const hours = Math.round(seconds / 3600)
  if (hours < 24) return `Replies in ~${hours} ${hours === 1 ? 'hour' : 'hours'}`
  const days = Math.round(hours / 24)
  return `Replies in ~${days} ${days === 1 ? 'day' : 'days'}`
}

/** Duration in minutes → "2 h 30 min". */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return ''
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** Compact counts for badges: 1200 → "1.2k". */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
  return `${(value / 1_000_000).toFixed(1)}M`
}

/** Rating display: always one decimal, so 5 renders as "5.0". */
export function formatRating(rating: number | null | undefined): string {
  if (!rating || rating <= 0) return 'New'
  return rating.toFixed(1)
}

export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(decimals)}%`
}
