import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  BadgeCheck,
  Eye,
  Lock,
  MapPin,
  MessageSquare,
  Scale,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClosingCta, PageHero, Section, SectionHead } from '@/components/marketing/page-primitives'
import { RevealGroup } from '@/components/motion/reveal'

export const metadata: Metadata = {
  title: 'Trust & safety',
  description:
    'How Hustle Street handles verification, payments, privacy and disputes, and what to do when something goes wrong.',
  alternates: { canonical: '/safety' },
}

export const revalidate = 3600

const PILLARS = [
  {
    icon: Lock,
    title: 'The money is never with us',
    body: 'Payments are held by a licensed payment provider, not in a Hustle Street account. We are not a bank and we do not hold customer funds. The money leaves that hold only when you confirm the work, when a dispute is decided, or automatically 72 hours after the hustler marks the job done.',
  },
  {
    icon: BadgeCheck,
    title: 'People are verified before they can earn',
    body: 'Phone verification is required to apply for work. ID verification is required before a payout can be withdrawn. A profile that has neither is visibly marked as unverified, so you always know what you are looking at.',
  },
  {
    icon: MapPin,
    title: 'Your address is not public',
    body: 'A posted job advertises an area and an approximate distance, never a street address. The exact location is released to one person: the hustler you actually hire, at the moment you hire them.',
  },
  {
    icon: Star,
    title: 'Reviews cannot be gamed',
    body: 'Only a completed, paid job produces a reviewable event, so there is nothing to farm. Neither side sees the other’s review until both have submitted or the window closes, which removes the incentive to write a retaliatory one.',
  },
  {
    icon: MessageSquare,
    title: 'Conversations stay on the record',
    body: 'Every message is attached to its job. If a dispute is opened, that thread, with its photos, prices and timestamps, is the evidence. Moving a negotiation off-platform is the single most common way people get burned.',
  },
  {
    icon: Scale,
    title: 'Disputes go to a human',
    body: 'Not a form letter and not an algorithm. A reviewer reads both sides, looks at the evidence, and can refund fully, release fully, or split the amount. The money stays held for the duration.',
  },
]

const POSTER_RULES = [
  'Keep the conversation in the app until you have hired someone.',
  'Never pay outside Hustle Street. A request to do so is the clearest warning sign there is.',
  'Read the reviews, not just the star count. Check that past jobs resemble yours.',
  'Agree the price and the scope in writing before work starts.',
  'Do not confirm completion until you have actually seen the finished work.',
]

const HUSTLER_RULES = [
  'Do not start work before the job shows as secured. That status is your guarantee of payment.',
  'Keep quotes and revisions in the thread so there is a record of what was agreed.',
  'Photograph completed work before you mark the job done.',
  'Decline jobs that ask you to meet somewhere you are not comfortable going.',
  'Report a poster who asks you to take payment off-platform.',
]

export default function SafetyPage() {
  return (
    <>
      <PageHero
        eyebrow="Trust & safety"
        title="Built for hiring a stranger"
        lede="The hardest part of a marketplace like this is trust between two people who have never met. It is the thing the platform is designed around, not a policy page written afterwards."
              image="/media/hero-safety.jpg"
        imageAlt="A worker in a safety vest and helmet on site"
      />

      {/* ═══ Pillars ════════════════════════════════════════════════════════ */}
      <Section aria-labelledby="pillars-heading">
        <SectionHead
          eyebrow="How it works"
          id="pillars-heading"
          title="Six things that protect both sides"
        />
        <RevealGroup as="ul" className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon
            return (
              <li key={pillar.title} className="border-t border-border pt-5">
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="mt-3 font-display text-lg font-semibold">{pillar.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
              </li>
            )
          })}
        </RevealGroup>
      </Section>

      {/* ═══ Practical rules ════════════════════════════════════════════════ */}
      <Section aria-labelledby="rules-heading">
        <SectionHead
          eyebrow="Practical"
          id="rules-heading"
          title="What to actually do"
          lede="Most problems on marketplaces like this one come from the same handful of mistakes. These are they."
        />

        <RevealGroup as="div" className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="panel bg-surface-muted p-7">
            <p className="eyebrow">If you are posting</p>
            <ul className="mt-5 space-y-3.5">
              {POSTER_RULES.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-sm leading-relaxed">{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel-ink p-7">
            <p className="eyebrow text-white/50">If you are hustling</p>
            <ul className="mt-5 space-y-3.5">
              {HUSTLER_RULES.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden="true" />
                  <span className="text-sm leading-relaxed text-white/80">{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </RevealGroup>
      </Section>

      {/* ═══ When it goes wrong ═════════════════════════════════════════════ */}
      <Section id="report" aria-labelledby="wrong-heading">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <SectionHead
            eyebrow="When it goes wrong"
            id="wrong-heading"
            title="Do not confirm. Open a dispute."
          />

          <div>
            <p className="text-pretty text-lg leading-relaxed">
              Confirming completion releases the money. If the work is not right, the single most
              important thing is not to confirm.
            </p>
            <ol className="mt-8 space-y-6">
              {[
                { title: 'Open the dispute from the job', body: 'The money stays held the moment a dispute is raised. Nothing moves while it is open.' },
                { title: 'Add your evidence', body: 'Photos, messages and the agreed scope. Both sides submit; both sides see what the reviewer sees.' },
                { title: 'A reviewer decides', body: 'Full refund, full release, or a split. You are told the reasoning, not just the outcome.' },
              ].map((stage, index) => (
                <li key={stage.title} className="flex gap-5 border-t border-border pt-5">
                  <span className="font-display text-sm tabular-nums text-muted-foreground/60">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-display text-base font-semibold">{stage.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {stage.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-10 flex items-start gap-3 rounded-[8px] border border-border bg-surface-muted p-5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm leading-relaxed">
                <strong className="font-semibold">In immediate danger, contact the police first.</strong>{' '}
                Hustle Street is a marketplace, not an emergency service. Report it to us afterwards
                and we will act on the account.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ Privacy ════════════════════════════════════════════════════════ */}
      <Section aria-labelledby="privacy-heading">
        <SectionHead
          eyebrow="Privacy"
          id="privacy-heading"
          title="What other people can see about you"
          align="center"
        />

        <div className="mx-auto mt-12 max-w-3xl">
          <dl className="panel divide-y divide-border overflow-hidden">
            {[
              { term: 'Your name', value: 'First name and last initial, publicly.' },
              { term: 'Your exact address', value: 'Only the hustler you hire, only once hired.' },
              { term: 'Your phone number', value: 'Never shown. Contact runs through in-app messaging.' },
              { term: 'Your location', value: 'An area and an approximate distance. Never a pin on your door.' },
              { term: 'Your reviews', value: 'Public, and only from jobs that actually completed.' },
              { term: 'Your payment details', value: 'Held by the payment provider. Hustle Street never sees a card number.' },
            ].map((row) => (
              <div
                key={row.term}
                className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <dt className="flex items-center gap-2.5 text-sm font-medium">
                  <Eye className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {row.term}
                </dt>
                <dd className="text-sm text-muted-foreground sm:text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <ClosingCta
        title="Questions we have not answered?"
        body="If something here is unclear, ask. A person reads every message that comes through the help channel."
      >
        <Button asChild size="lg">
          <Link href="/help">Talk to us</Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="invert-outline"
        >
          <Link href="/how-it-works">How it works</Link>
        </Button>
      </ClosingCta>
    </>
  )
}
