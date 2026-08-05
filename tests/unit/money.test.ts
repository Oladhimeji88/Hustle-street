import { describe, expect, it } from 'vitest'
import {
  computeCommission,
  formatBudget,
  formatMoney,
  formatRate,
  parseMoneyInput,
  splitEvenly,
  toMajor,
  toMinor,
} from '@/lib/money'

/**
 * Money is the part of this product where a bug costs somebody real naira.
 * These tests exist to pin down the exact arithmetic — especially rounding,
 * which is where marketplaces quietly steal from their own users.
 */

describe('minor/major conversion', () => {
  it('converts major to minor units without floating-point drift', () => {
    expect(toMinor(15_000)).toBe(1_500_000)
    expect(toMinor(19.99)).toBe(1999)
    // 0.1 + 0.2 territory: naive `* 100` gives 1998.9999999999998.
    expect(toMinor(19.98)).toBe(1998)
    expect(toMinor(0.01)).toBe(1)
    expect(toMinor(0)).toBe(0)
  })

  it('round-trips', () => {
    for (const amount of [1, 99.99, 15_000, 1_250_000.5]) {
      expect(toMajor(toMinor(amount))).toBeCloseTo(amount, 2)
    }
  })

  it('rejects non-finite input', () => {
    expect(() => toMinor(Number.NaN)).toThrow(TypeError)
    expect(() => toMinor(Number.POSITIVE_INFINITY)).toThrow(TypeError)
  })
})

describe('computeCommission', () => {
  it('matches the worked example from the product brief', () => {
    // ₦20,000 job at 10% → ₦2,000 fee, ₦18,000 to the hustler.
    const result = computeCommission(2_000_000, 1000)
    expect(result.feeMinor).toBe(200_000)
    expect(result.netMinor).toBe(1_800_000)
    expect(result.ratePercent).toBe(10)
  })

  it('always sums back to the gross', () => {
    for (const gross of [1, 99, 100, 12_345, 1_500_000, 999_999_999]) {
      for (const bps of [0, 1, 250, 1000, 1750, 5000]) {
        const { feeMinor, netMinor } = computeCommission(gross, bps)
        expect(feeMinor + netMinor).toBe(gross)
      }
    }
  })

  it('rounds the fee DOWN, so any sub-kobo remainder goes to the hustler', () => {
    // 333 kobo at 10% is 33.3 kobo. The platform takes 33, not 34.
    expect(computeCommission(333, 1000).feeMinor).toBe(33)
    expect(computeCommission(333, 1000).netMinor).toBe(300)

    // 1 kobo at 10% rounds the fee to zero rather than taking the whole unit.
    expect(computeCommission(1, 1000).feeMinor).toBe(0)
    expect(computeCommission(1, 1000).netMinor).toBe(1)
  })

  it('supports a zero-commission configuration', () => {
    const result = computeCommission(1_000_000, 0)
    expect(result.feeMinor).toBe(0)
    expect(result.netMinor).toBe(1_000_000)
  })

  it('refuses impossible inputs rather than silently coping', () => {
    expect(() => computeCommission(0, 1000)).toThrow(RangeError)
    expect(() => computeCommission(-100, 1000)).toThrow(RangeError)
    expect(() => computeCommission(100.5, 1000)).toThrow(RangeError)
    expect(() => computeCommission(1000, -1)).toThrow(RangeError)
    // 50% is the hard ceiling; anything above is a configuration mistake.
    expect(() => computeCommission(1000, 5001)).toThrow(RangeError)
  })
})

describe('splitEvenly', () => {
  it('never loses or invents a minor unit', () => {
    for (const [total, parts] of [
      [100, 3],
      [1, 4],
      [999_999, 7],
      [0, 5],
    ] as const) {
      const split = splitEvenly(total, parts)
      expect(split).toHaveLength(parts)
      expect(split.reduce((sum, value) => sum + value, 0)).toBe(total)
    }
  })

  it('distributes the remainder to the earliest parts', () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33])
  })
})

describe('formatMoney', () => {
  it('omits decimals for round amounts', () => {
    // Nigerian prices are round; "₦15,000.00" reads like a bank statement.
    expect(formatMoney(1_500_000)).toMatch(/15,000/)
    expect(formatMoney(1_500_000)).not.toMatch(/\.00/)
  })

  it('keeps decimals when the amount actually has them', () => {
    expect(formatMoney(1_500_050)).toMatch(/15,000\.50/)
  })

  it('compacts large amounts for dense surfaces', () => {
    expect(formatMoney(150_000_000, 'NGN', { compact: true })).toMatch(/1\.5M/)
  })

  it('renders an em dash rather than "₦0" for missing values', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
  })
})

describe('formatBudget', () => {
  it('renders a single value, a range and an hourly rate', () => {
    expect(formatBudget(1_500_000, null, 'NGN', 'fixed')).toMatch(/15,000/)
    expect(formatBudget(1_000_000, 2_000_000, 'NGN', 'fixed')).toMatch(/–/)
    expect(formatBudget(500_000, null, 'NGN', 'hourly')).toMatch(/\/hr$/)
    expect(formatBudget(null, null, 'NGN')).toBe('Negotiable')
  })
})

describe('parseMoneyInput', () => {
  it('accepts the ways people actually type prices', () => {
    expect(parseMoneyInput('15000')).toBe(1_500_000)
    expect(parseMoneyInput('15,000')).toBe(1_500_000)
    expect(parseMoneyInput('₦15,000')).toBe(1_500_000)
    expect(parseMoneyInput(' 15 000 ')).toBe(1_500_000)
    // "15k" and "1.5m" are how prices are quoted in conversation here.
    expect(parseMoneyInput('15k')).toBe(1_500_000)
    expect(parseMoneyInput('1.5m')).toBe(150_000_000)
  })

  it('rejects nonsense', () => {
    expect(parseMoneyInput('abc')).toBeNull()
    expect(parseMoneyInput('-500')).toBeNull()
    expect(parseMoneyInput('')).toBeNull()
  })
})

describe('formatRate', () => {
  it('renders basis points as a percentage', () => {
    expect(formatRate(1000)).toBe('10%')
    expect(formatRate(250)).toBe('2.50%')
    expect(formatRate(0)).toBe('0%')
  })
})
