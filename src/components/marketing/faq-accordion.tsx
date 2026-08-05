'use client'

import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * FAQ accordion.
 *
 * The commission numbers are passed in from platform settings rather than
 * written into the copy, so changing the fee in the admin dashboard updates the
 * marketing page too — no stale "we take 10%" claim left behind.
 */
export function FaqAccordion({
  commissionPercent,
  exampleFee,
  exampleNet,
}: {
  commissionPercent: number
  exampleFee: string
  exampleNet: string
}) {
  const items = [
    {
      q: 'What does it cost?',
      a: `Posting a job is free. When a job is completed, Hustle Street takes ${commissionPercent}% of the agreed price from the hustler's payout. On a ${exampleFee} job the hustler receives ${exampleNet}. There are no listing fees, no subscriptions and no charge for messaging.`,
    },
    {
      q: 'How do I know I will actually get paid?',
      a: "The poster pays before you start, and the money is held securely by our licensed payment provider — not by the poster and not spendable by us. When the job is confirmed complete, it is released to your wallet. If the poster goes quiet, it releases automatically after the confirmation window.",
    },
    {
      q: 'What if the work is not done properly?',
      a: 'Do not confirm the job. Open a dispute instead and the money stays held while a real person reviews the messages, photos and evidence from both sides. They can refund you fully, release fully, or split it.',
    },
    {
      q: 'Will people see my home address?',
      a: 'No. Jobs show an approximate area and distance, like "1.8 km away · Lekki Phase 1". Your exact address is shared only with the one hustler you hire, and only once the job is active.',
    },
    {
      q: 'Can I do both — post jobs and hustle?',
      a: 'Yes, and most people do. One account, one profile, and a switch between the two modes. Your reputation as a poster and as a hustler are tracked separately so they never get mixed up.',
    },
    {
      q: 'How do I get my money out?',
      a: 'Earnings land in your wallet after a short clearing period, then withdraw to any Nigerian bank account. Transfers usually arrive within minutes.',
    },
    {
      q: 'Do I need to be in Lagos?',
      a: 'Lagos is where we started and where the most jobs are, but the platform works anywhere in Nigeria. Remote and digital jobs — design, writing, development — have no location requirement at all.',
    },
  ]

  return (
    <>
      <AccordionPrimitive.Root type="single" collapsible className="divide-y divide-border">
        {items.map((item, index) => (
          <AccordionPrimitive.Item key={item.q} value={`item-${index}`}>
            <AccordionPrimitive.Header>
              <AccordionPrimitive.Trigger
                className={cn(
                  'group flex w-full items-center justify-between gap-4 py-5 text-left',
                  'font-display text-base font-bold transition-colors hover:text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                {item.q}
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
            <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <p className="pb-5 pr-8 text-pretty leading-relaxed text-muted-foreground">{item.a}</p>
            </AccordionPrimitive.Content>
          </AccordionPrimitive.Item>
        ))}
      </AccordionPrimitive.Root>

      {/* FAQPage structured data, generated from the same source as the UI. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: items.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
    </>
  )
}
