/**
 * Money.
 *
 * Every amount in Hustle Street is an integer in the currency's MINOR unit
 * (kobo for NGN, cents for USD). There is no `number` holding ₦1,500.50 —
 * it is `150050`. Floating point never touches a balance.
 *
 * This module is pure and dependency-free so it can be unit tested exhaustively
 * and reused on both the server and the client.
 */

export const CURRENCIES = {
  NGN: { code: 'NGN', symbol: '₦', minorUnits: 2, locale: 'en-NG', name: 'Nigerian Naira' },
  USD: { code: 'USD', symbol: '$', minorUnits: 2, locale: 'en-US', name: 'US Dollar' },
  GBP: { code: 'GBP', symbol: '£', minorUnits: 2, locale: 'en-GB', name: 'British Pound' },
  EUR: { code: 'EUR', symbol: '€', minorUnits: 2, locale: 'en-IE', name: 'Euro' },
  GHS: { code: 'GHS', symbol: '₵', minorUnits: 2, locale: 'en-GH', name: 'Ghanaian Cedi' },
  KES: { code: 'KES', symbol: 'KSh', minorUnits: 2, locale: 'en-KE', name: 'Kenyan Shilling' },
} as const

export type CurrencyCode = keyof typeof CURRENCIES

export const DEFAULT_CURRENCY: CurrencyCode = 'NGN'

/** Basis points → percentage. 1000 bps = 10%. */
export const BPS_DIVISOR = 10_000

function currencyMeta(currency: CurrencyCode) {
  return CURRENCIES[currency] ?? CURRENCIES[DEFAULT_CURRENCY]
}

function minorFactor(currency: CurrencyCode): number {
  return 10 ** currencyMeta(currency).minorUnits
}

/** Converts a human-entered major amount (1500.5) to minor units (150050). */
export function toMinor(major: number, currency: CurrencyCode = DEFAULT_CURRENCY): number {
  if (!Number.isFinite(major)) throw new TypeError('Amount must be a finite number')
  // Round rather than truncate so 19.99 * 100 = 1998.9999... becomes 1999.
  return Math.round(major * minorFactor(currency))
}

/** Converts minor units to a major-unit number. Display only — never for maths. */
export function toMajor(minor: number, currency: CurrencyCode = DEFAULT_CURRENCY): number {
  return minor / minorFactor(currency)
}

/**
 * Formats an amount for display.
 *
 * `compact` renders ₦1.5M for dense surfaces like map pins and job cards.
 */
export function formatMoney(
  minor: number | null | undefined,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  options: { compact?: boolean; showDecimals?: boolean; locale?: string } = {},
): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return '—'

  const meta = currencyMeta(currency)
  const major = toMajor(minor, currency)
  const locale = options.locale ?? meta.locale

  // Show decimals only when the amount actually has them, or when asked. Nigerian
  // prices are overwhelmingly round numbers; "₦15,000.00" reads like a bank
  // statement, "₦15,000" reads like a price.
  const hasFraction = Math.abs(major % 1) > Number.EPSILON
  const showDecimals = options.showDecimals ?? hasFraction

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: meta.code,
      currencyDisplay: 'narrowSymbol',
      notation: options.compact && Math.abs(major) >= 10_000 ? 'compact' : 'standard',
      maximumFractionDigits: options.compact ? 1 : showDecimals ? meta.minorUnits : 0,
      minimumFractionDigits: showDecimals && !options.compact ? meta.minorUnits : 0,
    }).format(major)
  } catch {
    // Older runtimes may not know a currency or `narrowSymbol`.
    return `${meta.symbol}${major.toLocaleString(locale, {
      maximumFractionDigits: showDecimals ? meta.minorUnits : 0,
    })}`
  }
}

/** Renders a budget as a single value or a range. */
export function formatBudget(
  minMinor: number | null | undefined,
  maxMinor: number | null | undefined,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  kind?: 'fixed' | 'negotiable' | 'hourly',
): string {
  const suffix = kind === 'hourly' ? '/hr' : ''

  if (minMinor != null && maxMinor != null && maxMinor !== minMinor) {
    return `${formatMoney(minMinor, currency, { compact: true })} – ${formatMoney(maxMinor, currency, { compact: true })}${suffix}`
  }

  const value = minMinor ?? maxMinor
  if (value == null) return 'Negotiable'

  const formatted = `${formatMoney(value, currency)}${suffix}`
  return kind === 'negotiable' ? `${formatted} (negotiable)` : formatted
}

export interface CommissionBreakdown {
  /** What the poster pays. */
  grossMinor: number
  /** What the platform keeps. */
  feeMinor: number
  /** What the hustler receives. */
  netMinor: number
  rateBps: number
  ratePercent: number
}

/**
 * The single commission calculation in the product.
 *
 * `Math.floor` on the fee means any sub-kobo remainder goes to the hustler, not
 * the platform. Mirrors `app.compute_commission()` in the database exactly —
 * the two are cross-checked in `tests/unit/money.test.ts`.
 */
export function computeCommission(grossMinor: number, rateBps: number): CommissionBreakdown {
  if (!Number.isInteger(grossMinor) || grossMinor <= 0) {
    throw new RangeError('Gross amount must be a positive integer in minor units')
  }
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 5000) {
    throw new RangeError('Commission rate must be between 0 and 5000 basis points')
  }

  const feeMinor = Math.floor((grossMinor * rateBps) / BPS_DIVISOR)

  return {
    grossMinor,
    feeMinor,
    netMinor: grossMinor - feeMinor,
    rateBps,
    ratePercent: rateBps / 100,
  }
}

/** Splits an amount into whole minor units without losing a single unit. */
export function splitEvenly(totalMinor: number, parts: number): number[] {
  if (parts <= 0) throw new RangeError('parts must be positive')
  const base = Math.floor(totalMinor / parts)
  const remainder = totalMinor - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0))
}

/** Parses user input ("15,000", "₦15000", "15k") into minor units. */
export function parseMoneyInput(
  input: string,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): number | null {
  if (!input) return null

  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[₦$£€,\s]/g, '')

  // "15k" / "1.5m" shorthand — very common in Nigerian price conversation.
  const shorthand = cleaned.match(/^(\d+(?:\.\d+)?)(k|m)$/)
  if (shorthand) {
    const value = Number(shorthand[1]) * (shorthand[2] === 'k' ? 1_000 : 1_000_000)
    return toMinor(value, currency)
  }

  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return null

  return toMinor(value, currency)
}

/** Human-readable rate, e.g. 1000 bps → "10%". */
export function formatRate(bps: number): string {
  const percent = bps / 100
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`
}
