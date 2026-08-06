import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Banknote, MapPin, MessageSquare, ShieldCheck, Sparkles, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { EscrowDiagram } from '@/components/marketing/escrow-diagram'
import { ClosingCta, PageHero, Section, SectionHead, Step } from '@/components/marketing/page-primitives'
import { RevealGroup } from '@/components/motion/reveal'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Post a job in about two minutes, compare the people who apply, and pay only when the work is confirmed done. Here is the whole process, both sides of it.',
  alternates: { canonical: '/how-it-works' },
}

export const revalidate = 3600

const POSTER_STEPS = [
  {
    title: 'Say what you need',
    body: 'Describe the job, set a budget, pick a time and a location. Roughly two minutes on a phone. Posting costs nothing.',
  },
  {
    title: 'Hustlers nearby see it',
    body: 'People with the right skills inside your area are notified straight away. You do not chase anyone.',
  },
  {
    title: 'Compare and chat',
    body: 'Ratings, completed jobs, prices and distance side by side. Message anyone before you commit to them.',
  },
  {
    title: 'Pay when it is done',
    body: 'Your payment is secured when you hire and released only once you confirm the work is finished.',
  },
]

const HUSTLER_STEPS = [
  {
    title: 'Create your profile',
    body: 'List your skills, set your rates, and choose how far you are willing to travel. Verification takes a few minutes.',
  },
  {
    title: 'Get matched to jobs',
    body: 'Jobs near you that match your skills arrive as notifications. No trawling a board, no paying to apply.',
  },
  {
    title: 'Apply and agree',
    body: 'Send a price and a message. Once the poster accepts, their payment is secured before you lift a finger.',
  },
  {
    title: 'Do the work, get paid',
    body: 'Mark it done. The poster confirms and the money moves. If they go quiet, it releases automatically after 72 hours.',
  },
]

export default async function HowItWorksPage() {
  const supabase = await createClient()
  const { data: commissionSetting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'commission_rate_bps')
    .maybeSingle()

  const commissionPercent = commissionSetting ? Number(commissionSetting.value) / 100 : 10

  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="Someone needs it done. Someone nearby can do it."
        lede="Hustle Street's whole job is connecting those two people and holding the money in between, so neither side has to trust the other on faith."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="rounded-full px-7">
            <Link href="/post">
              Post a Job
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ink" className="rounded-full px-7">
            <Link href="/signup?intent=hustle">Start hustling</Link>
          </Button>
        </div>
      </PageHero>

      {/* ═══ For posters ════════════════════════════════════════════════════ */}
      <Section aria-labelledby="posters-heading">
        <SectionHead
          eyebrow="If you need something done"
          id="posters-heading"
          title="Posting a job"
          lede="Free, and about two minutes on a phone."
        />
        <RevealGroup as="ol" className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {POSTER_STEPS.map((step, index) => (
            <Step key={step.title} index={index + 1} title={step.title}>
              {step.body}
            </Step>
          ))}
        </RevealGroup>
      </Section>

      {/* ═══ For hustlers ═══════════════════════════════════════════════════ */}
      <Section aria-labelledby="hustlers-heading">
        <SectionHead
          eyebrow="If you have a skill"
          id="hustlers-heading"
          title="Finding work"
          lede="No bidding wars, no subscription, and nothing to pay before you have earned anything."
        />
        <RevealGroup as="ol" className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {HUSTLER_STEPS.map((step, index) => (
            <Step key={step.title} index={index + 1} title={step.title}>
              {step.body}
            </Step>
          ))}
        </RevealGroup>
      </Section>

      {/* ═══ The money ══════════════════════════════════════════════════════ */}
      <Section id="payments" aria-labelledby="money-heading">
        <SectionHead
          eyebrow="The money"
          id="money-heading"
          title="Neither side has to go first"
          lede="The payment is secured before work starts and released on confirmation. We take a percentage only when a job actually completes."
          align="center"
        />
        <div className="mt-12">
          <EscrowDiagram commissionPercent={commissionPercent} exampleMinor={2_000_000} />
        </div>
      </Section>

      {/* ═══ What you get ═══════════════════════════════════════════════════ */}
      <Section aria-labelledby="both-heading">
        <SectionHead
          eyebrow="Both sides"
          id="both-heading"
          title="What holds it together"
        />
        <RevealGroup as="ul" className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'Secured payments', body: 'Money is held by a licensed payment provider — not by us — until the job is confirmed.' },
            { icon: Star, title: 'Reviews that mean something', body: 'Only completed jobs can be reviewed, and neither side sees the other’s until both have submitted.' },
            { icon: MapPin, title: 'Location without exposure', body: 'Jobs advertise an area and a distance. Your street address reaches only the person you hire.' },
            { icon: MessageSquare, title: 'Everything on the record', body: 'Every conversation is attached to its job, its agreement and its payment.' },
            { icon: Banknote, title: 'No fee to try', body: `Free to post, free to apply. We take ${commissionPercent}% on completion and nothing otherwise.` },
            { icon: Sparkles, title: 'Disputes go to a person', body: 'If something goes wrong the money stays put while a real human reviews the evidence from both sides.' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <li key={item.title} className="border-t border-border pt-5">
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            )
          })}
        </RevealGroup>
      </Section>

      <ClosingCta>
        <Button asChild size="lg" className="rounded-full px-7">
          <Link href="/post">
            Post a Job
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="rounded-full border-white/20 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
        >
          <Link href="/explore">Find Work</Link>
        </Button>
      </ClosingCta>
    </>
  )
}
