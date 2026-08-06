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
 * marketing page too, with no stale "we take 10%" claim left behind.
 *
 * The escrow mechanics and the dispute process used to occupy two full sections
 * of the landing page, complete with a diagram and a video. Both were answers to
 * questions, and answers belong where people go looking for them. They are now
 * items here, which also gets them into the FAQPage structured data below —
 * where the diagram could never have gone.
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
      q: 'How does the payment actually work?',
      a: `Neither side has to go first. The poster pays the agreed price before any work starts, and it is held by a licensed payment provider. Hustle Street holds no customer funds and is not a bank, so the money is neither spendable by us nor still sitting with the poster. On a ${exampleFee} job, ${exampleFee} is secured up front, ${commissionPercent}% comes off as the platform fee on completion, and ${exampleNet} reaches the hustler.`,
    },
    {
      q: 'How do I know I will actually get paid?',
      a: 'Because the money is already secured before you start. Once the job is confirmed complete it is released to your wallet. If the poster simply goes quiet, it releases to you automatically 72 hours after you mark the job done, so nobody can hold your earnings hostage by ignoring you.',
    },
    {
      q: 'What if the work is not done properly?',
      a: 'Do not confirm the job. Confirming is what releases the money, so the single most important thing is to hold off. Open a dispute instead and the money stays held while a real person reads the messages, photos and evidence from both sides. They can refund you fully, release fully, or split it, and you are told the reasoning rather than just the outcome.',
    },
    {
      q: 'Will people see my home address?',
      a: 'No. Jobs show an approximate area and distance, like "1.8 km away · Lekki Phase 1". Your exact address is shared only with the one hustler you hire, and only once the job is active.',
    },
    {
      q: 'Can I do both, post jobs and hustle?',
      a: 'Yes, and most people do. One account, one profile, and a switch between the two modes. Your reputation as a poster and as a hustler are tracked separately so they never get mixed up.',
    },
    {
      q: 'How do I get my money out?',
      a: 'Earnings land in your wallet after a short clearing period, then withdraw to any Nigerian bank account. Transfers usually arrive within minutes.',
    },
    {
      q: 'Do I need to be in Lagos?',
      a: 'Lagos is where we started and where the most jobs are, but the platform works anywhere in Nigeria. Remote and digital jobs such as design, writing and development have no location requirement at all.',
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
