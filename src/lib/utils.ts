import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The type scale's custom `text-*` steps, declared so tailwind-merge can tell a
 * size from a colour.
 *
 * This is load-bearing, not housekeeping. tailwind-merge resolves conflicts by
 * class group, and `text-*` is ambiguous — it is the prefix for both font size
 * and text colour. Out of the box it only recognises Tailwind's own size names
 * (`text-sm`, `text-lg`, …), so a custom step like `text-button-sm` fell through
 * to the colour group. Two classes then landed in the same group:
 *
 *   text-ink-foreground   (from a button's `variant`)
 *   text-button-sm        (from its `size`)
 *
 * and the later one silently won — which is how every ink-filled button ended up
 * with an invisible label, ink text on an ink fill.
 *
 * Listing the scale here puts the sizes in `font-size` where they belong, leaving
 * everything else under `text-` to resolve as a colour. Any new step added to
 * `fontSize` in tailwind.config.ts must be added here too.
 */
const FONT_SIZES = [
  'display',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'body-lg',
  'body-base',
  'body-sm',
  'button-lg',
  'button-sm',
  'eyebrow',
  'eyebrow-sm',
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZES }],
    },
  },
})

/** Tailwind-aware class merge used by every component in the design system. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Stable, URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    // Strip combining diacritics left behind by NFKD.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

/** Pluralise without pulling in a library. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

export function countLabel(count: number, singular: string, plural?: string): string {
  return `${count.toLocaleString()} ${pluralize(count, singular, plural)}`
}

/**
 * Nigerian phone normalisation to E.164.
 *
 * Accepts 08012345678, 8012345678, +2348012345678, 2348012345678.
 * Returns null when the input cannot be a valid NG mobile number.
 */
export function normalizeNigerianPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')

  let local: string
  if (digits.startsWith('+234')) local = digits.slice(4)
  else if (digits.startsWith('234')) local = digits.slice(3)
  else if (digits.startsWith('0')) local = digits.slice(1)
  else local = digits

  // NG mobile numbers are 10 digits after the country code and start with 7/8/9.
  if (!/^[789]\d{9}$/.test(local)) return null
  return `+234${local}`
}

/** Formats E.164 back into the readable local form. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  if (e164.startsWith('+234') && e164.length === 14) {
    const local = e164.slice(4)
    return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }
  return e164
}

/** Masks contact details for surfaces where they should not be fully visible. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return '•••'
  const visible = user.slice(0, Math.min(2, user.length))
  return `${visible}${'•'.repeat(Math.max(3, user.length - 2))}@${domain}`
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return '•••'
  return `${'•'.repeat(phone.length - 4)}${phone.slice(-4)}`
}

/** Deterministic avatar background from a user id — no network, no flicker. */
export function avatarTint(seed: string): string {
  const palette = [
    'bg-[#FFE1CC] text-[#8A3A00]',
    'bg-[#D9F5E6] text-[#0B5138]',
    'bg-[#DCE8FF] text-[#1B3A7A]',
    'bg-[#F6E0FF] text-[#5B1C72]',
    'bg-[#FFF0C2] text-[#6B4E00]',
    'bg-[#FFD9DE] text-[#8A1027]',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Coerces unknown thrown values into a message safe to show a user. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof error === 'string' && error.trim()) return error
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

/** Builds a query string, dropping empty values. */
export function toSearchParams(input: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      params.set(key, value.join(','))
    } else if (typeof value === 'boolean') {
      if (value) params.set(key, 'true')
    } else {
      params.set(key, String(value))
    }
  }
  return params.toString()
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
