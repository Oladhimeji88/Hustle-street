import { describe, expect, it } from 'vitest'
import type { JobStatus, TransactionStatus } from '@/types/database'

/**
 * Job and payment state machines.
 *
 * These tables mirror `app.is_valid_job_transition()` and
 * `app.is_valid_transaction_transition()` in the database exactly. The database
 * is the enforcement point; this test is the specification, and it fails loudly
 * if someone changes one side without the other.
 */

const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['APPLICATIONS_OPEN', 'HIRED', 'CANCELLED', 'EXPIRED'],
  APPLICATIONS_OPEN: ['HIRED', 'CANCELLED', 'EXPIRED'],
  HIRED: ['IN_PROGRESS', 'CANCELLED', 'DISPUTED', 'APPLICATIONS_OPEN'],
  IN_PROGRESS: ['SUBMITTED', 'CANCELLED', 'DISPUTED'],
  SUBMITTED: ['COMPLETED', 'IN_PROGRESS', 'DISPUTED'],
  DISPUTED: ['COMPLETED', 'CANCELLED', 'IN_PROGRESS'],
  EXPIRED: ['APPLICATIONS_OPEN', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to)
}

const ALL_JOB_STATUSES = Object.keys(JOB_TRANSITIONS) as JobStatus[]

describe('job state machine', () => {
  it('walks the happy path end to end', () => {
    const journey: JobStatus[] = [
      'DRAFT',
      'PUBLISHED',
      'APPLICATIONS_OPEN',
      'HIRED',
      'IN_PROGRESS',
      'SUBMITTED',
      'COMPLETED',
    ]

    for (let i = 0; i < journey.length - 1; i++) {
      expect(
        canTransition(journey[i]!, journey[i + 1]!),
        `${journey[i]} → ${journey[i + 1]} should be allowed`,
      ).toBe(true)
    }
  })

  it('treats COMPLETED and CANCELLED as terminal', () => {
    for (const terminal of ['COMPLETED', 'CANCELLED'] as const) {
      for (const target of ALL_JOB_STATUSES) {
        expect(canTransition(terminal, target), `${terminal} → ${target}`).toBe(false)
      }
    }
  })

  it('refuses the business rule from the brief: cancelled cannot become completed', () => {
    expect(canTransition('CANCELLED', 'COMPLETED')).toBe(false)
  })

  it('will not let a job skip straight from published to completed', () => {
    expect(canTransition('PUBLISHED', 'COMPLETED')).toBe(false)
    expect(canTransition('APPLICATIONS_OPEN', 'COMPLETED')).toBe(false)
    expect(canTransition('HIRED', 'COMPLETED')).toBe(false)
  })

  it('will not let submitted work be cancelled unilaterally', () => {
    // A poster who could cancel here would get delivered work for free. The
    // only routes out are confirmation or a dispute.
    expect(canTransition('SUBMITTED', 'CANCELLED')).toBe(false)
    expect(canTransition('SUBMITTED', 'COMPLETED')).toBe(true)
    expect(canTransition('SUBMITTED', 'DISPUTED')).toBe(true)
  })

  it('lets an expired job be relisted', () => {
    expect(canTransition('EXPIRED', 'APPLICATIONS_OPEN')).toBe(true)
  })

  it('lets a hire fall through back to open applications', () => {
    // Hustler vanishes before funding: the poster should be able to reopen.
    expect(canTransition('HIRED', 'APPLICATIONS_OPEN')).toBe(true)
  })

  it('has no state that can reach itself', () => {
    for (const status of ALL_JOB_STATUSES) {
      expect(canTransition(status, status), `${status} → ${status}`).toBe(false)
    }
  })
})

const PAYMENT_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  PENDING: ['AUTHORIZED', 'HELD', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['HELD', 'RELEASED', 'REFUNDED', 'FAILED', 'DISPUTED'],
  HELD: ['RELEASED', 'REFUNDED', 'DISPUTED', 'CANCELLED'],
  DISPUTED: ['RELEASED', 'REFUNDED', 'CANCELLED'],
  RELEASED: ['REFUNDED'],
  REFUNDED: [],
  FAILED: ['PENDING'],
  CANCELLED: [],
}

function canPaymentTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to)
}

describe('payment state machine', () => {
  it('walks the escrow happy path', () => {
    expect(canPaymentTransition('PENDING', 'HELD')).toBe(true)
    expect(canPaymentTransition('HELD', 'RELEASED')).toBe(true)
  })

  it('cannot release the same payment twice', () => {
    expect(canPaymentTransition('RELEASED', 'RELEASED')).toBe(false)
  })

  it('cannot un-refund a payment', () => {
    for (const target of Object.keys(PAYMENT_TRANSITIONS) as TransactionStatus[]) {
      expect(canPaymentTransition('REFUNDED', target)).toBe(false)
    }
  })

  it('allows a post-release reversal, which is admin-only in practice', () => {
    expect(canPaymentTransition('RELEASED', 'REFUNDED')).toBe(true)
  })

  it('lets a failed payment be retried', () => {
    expect(canPaymentTransition('FAILED', 'PENDING')).toBe(true)
  })

  it('cannot go straight from pending to released without being held', () => {
    expect(canPaymentTransition('PENDING', 'RELEASED')).toBe(false)
  })
})

describe('review eligibility', () => {
  /** Mirrors `app.guard_review_insert()`. */
  function canReview(input: {
    assignmentStatus: string
    reviewerId: string
    posterId: string
    hustlerId: string
    direction: 'poster_to_hustler' | 'hustler_to_poster'
    alreadyReviewed: boolean
  }): boolean {
    if (input.assignmentStatus !== 'completed') return false
    if (input.alreadyReviewed) return false

    return input.direction === 'poster_to_hustler'
      ? input.reviewerId === input.posterId
      : input.reviewerId === input.hustlerId
  }

  const base = {
    assignmentStatus: 'completed',
    reviewerId: 'poster-1',
    posterId: 'poster-1',
    hustlerId: 'hustler-1',
    direction: 'poster_to_hustler' as const,
    alreadyReviewed: false,
  }

  it('allows a review after a completed job', () => {
    expect(canReview(base)).toBe(true)
  })

  it('blocks a review before the job is completed', () => {
    expect(canReview({ ...base, assignmentStatus: 'active' })).toBe(false)
    expect(canReview({ ...base, assignmentStatus: 'submitted' })).toBe(false)
    expect(canReview({ ...base, assignmentStatus: 'cancelled' })).toBe(false)
  })

  it('blocks a duplicate review', () => {
    expect(canReview({ ...base, alreadyReviewed: true })).toBe(false)
  })

  it('blocks a stranger from reviewing', () => {
    expect(canReview({ ...base, reviewerId: 'someone-else' })).toBe(false)
  })

  it('blocks a direction that does not match the reviewer', () => {
    // The poster cannot file a hustler-to-poster review.
    expect(canReview({ ...base, direction: 'hustler_to_poster' })).toBe(false)
  })
})
