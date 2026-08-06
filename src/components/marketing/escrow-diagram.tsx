import * as React from 'react'
import { CheckCircle2, Lock, Wallet } from 'lucide-react'
import { computeCommission, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * The escrow flow, drawn as real layout rather than an exported image.
 *
 * Three reasons this is markup and not a PNG:
 *  - the numbers are computed from the live commission rate, so the diagram
 *    cannot contradict the fee stated elsewhere on the page
 *  - it reads correctly at any zoom
 *  - a screen reader gets an ordered list of steps instead of alt text trying
 *    to describe a picture of a flow
 *
 * Presentation note: the steps used to be three differently tinted cards —
 * neutral, orange, green — joined by arrow glyphs. Money UI is the last place
 * that should look playful, and the tints implied a status difference the three
 * steps do not have. They are now one uniform treatment on a single rail, with
 * the stage carried by a numeral and the figures set in tabular numerals so the
 * columns line up the way a statement's would.
 */
export function EscrowDiagram({
  commissionPercent,
  exampleMinor,
  className,
}: {
  commissionPercent: number
  /** Worked example, in minor units. Defaults to a NGN 20,000 job. */
  exampleMinor: number
  className?: string
}) {
  const { feeMinor, netMinor } = computeCommission(
    exampleMinor,
    Math.round(commissionPercent * 100),
  )

  const steps = [
    {
      icon: Wallet,
      label: 'You pay',
      amount: formatMoney(exampleMinor),
      detail: 'Before any work starts.',
    },
    {
      icon: Lock,
      label: 'Held securely',
      amount: formatMoney(exampleMinor),
      detail: 'Not with us, not with them.',
    },
    {
      icon: CheckCircle2,
      label: 'Released',
      amount: formatMoney(netMinor),
      detail: `To the hustler, after the ${commissionPercent}% fee.`,
    },
  ]

  return (
    <div className={cn('mx-auto max-w-4xl', className)}>
      {/* The rail. One hairline runs behind all three markers on desktop, which
          says "one continuous process" far more plainly than arrows between
          separate boxes did. */}
      <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
        <div
          className="pointer-events-none absolute left-0 right-0 top-[15px] hidden h-px bg-border md:block"
          aria-hidden="true"
        />

        {steps.map((step, index) => {
          const Icon = step.icon
          const last = index === steps.length - 1
          return (
            <li key={step.label} className="relative">
              {/* Marker sits on the rail; the background gap is what makes the
                  line appear to pass behind it rather than through it. */}
              <div className="flex items-center gap-3 md:block">
                <span
                  className={cn(
                    'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background',
                    last ? 'border-money/40 text-money' : 'border-border text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </div>

              <div className="mt-0 md:mt-6">
                <p className="eyebrow">
                  Step {index + 1} — {step.label}
                </p>
                <p
                  className={cn(
                    'mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight',
                    last && 'text-money',
                  )}
                >
                  {step.amount}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          )
        })}
      </ol>

      {/* The worked example, set as a statement: labels left, figures right,
          aligned on a tabular column, total separated by a rule. */}
      <div className="panel mt-14 overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <p className="eyebrow">Worked example</p>
        </div>

        <dl className="divide-y divide-border">
          <div className="flex items-baseline justify-between gap-4 px-6 py-3.5">
            <dt className="text-sm text-muted-foreground">Job price</dt>
            <dd className="text-sm tabular-nums">{formatMoney(exampleMinor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-6 py-3.5">
            <dt className="text-sm text-muted-foreground">
              Platform fee
              <span className="ml-1.5 tabular-nums text-muted-foreground/70">
                ({commissionPercent}%)
              </span>
            </dt>
            <dd className="text-sm tabular-nums text-muted-foreground">−{formatMoney(feeMinor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 bg-surface-muted px-6 py-4">
            <dt className="text-sm font-medium">Hustler receives</dt>
            <dd className="font-display text-lg font-semibold tabular-nums text-money">
              {formatMoney(netMinor)}
            </dd>
          </div>
        </dl>

        <p className="border-t border-border px-6 py-4 text-xs leading-relaxed text-muted-foreground">
          Hustle Street holds no customer funds and is not a bank. Payments are held by a licensed
          payment provider until the job is confirmed complete.
        </p>
      </div>
    </div>
  )
}
