import * as React from 'react'
import { ArrowRight, CheckCircle2, Lock, Wallet } from 'lucide-react'
import { computeCommission, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * The escrow flow, drawn as real layout rather than an exported image.
 *
 * Three reasons this is markup and not a PNG:
 *  - the numbers are computed from the live commission rate, so the diagram
 *    cannot contradict the fee stated elsewhere on the page
 *  - it reads correctly in light and dark, and at any zoom
 *  - a screen reader gets an ordered list of steps instead of alt text trying
 *    to describe a picture of a flow
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
      detail: 'Before any work starts',
      tone: 'bg-surface text-foreground border-border',
    },
    {
      icon: Lock,
      label: 'Held securely',
      amount: formatMoney(exampleMinor),
      detail: 'Not with us, not with them',
      tone: 'bg-primary-soft text-primary border-primary/25',
    },
    {
      icon: CheckCircle2,
      label: 'Released on confirmation',
      amount: formatMoney(netMinor),
      detail: `to the hustler, after the ${commissionPercent}% fee`,
      tone: 'bg-money-soft text-money border-money/25',
    },
  ]

  return (
    <div className={cn('mx-auto max-w-4xl', className)}>
      <ol className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <React.Fragment key={step.label}>
              <li className={cn('rounded-2xl border p-5 text-center', step.tone)}>
                <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-current/10">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <p className="mt-3 font-display text-xl font-extrabold tabular-nums">
                  {step.amount}
                </p>
                <p className="mt-1 text-sm font-semibold">{step.label}</p>
                <p className="mt-0.5 text-xs opacity-70">{step.detail}</p>
              </li>

              {index < steps.length - 1 && (
                <li
                  aria-hidden="true"
                  className="flex items-center justify-center py-1 md:py-0"
                >
                  <ArrowRight className="size-5 rotate-90 text-muted-foreground md:rotate-0" />
                </li>
              )}
            </React.Fragment>
          )
        })}
      </ol>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-semibold">The worked example</p>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Job price</dt>
            <dd className="font-medium tabular-nums">{formatMoney(exampleMinor)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Platform fee ({commissionPercent}%)</dt>
            <dd className="font-medium tabular-nums">−{formatMoney(feeMinor)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-1.5">
            <dt className="font-semibold">Hustler receives</dt>
            <dd className="font-display font-extrabold tabular-nums text-money">
              {formatMoney(netMinor)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Hustle Street holds no customer funds and is not a bank. Payments are held by a licensed
          payment provider until the job is confirmed complete.
        </p>
      </div>
    </div>
  )
}
