import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Briefcase, LifeBuoy, Mail, MessageSquare, ShieldCheck, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { FaqAccordion } from '@/components/marketing/faq-accordion'
import { PageHero, Section, SectionHead } from '@/components/marketing/page-primitives'
import { RevealGroup } from '@/components/motion/reveal'
import { formatMoney } from '@/lib/money'

export const metadata: Metadata = {
  title: 'Help',
  description:
    'Answers to the questions people actually ask about posting jobs, finding work, payments and disputes on Hustle Street.',
  alternates: { canonical: '/help' },
}

export const revalidate = 3600

const TOPICS = [
  {
    icon: Briefcase,
    title: 'Posting a job',
    body: 'Writing a brief, setting a budget, and choosing between the people who apply.',
    href: '/how-it-works',
    cta: 'How posting works',
  },
  {
    icon: Wallet,
    title: 'Payments and payouts',
    body: 'When money is taken, when it is released, what the fee is, and how withdrawals reach your bank.',
    href: '/how-it-works#payments',
    cta: 'How the money moves',
  },
  {
    icon: ShieldCheck,
    title: 'Safety and disputes',
    body: 'Verification, privacy, what to do when work is not right, and how a dispute is decided.',
    href: '/safety',
    cta: 'Trust & safety',
  },
]

export default async function HelpPage() {
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
        eyebrow="Help"
        title="Stuck on something?"
        lede="Start with the questions below. They cover most of what comes up, and if yours is not here a person will answer it."
      />

      {/* ═══ Topics ═════════════════════════════════════════════════════════ */}
      <Section aria-labelledby="topics-heading">
        <h2 id="topics-heading" className="sr-only">
          Help topics
        </h2>
        <RevealGroup as="ul" className="grid gap-4 md:grid-cols-3">
          {TOPICS.map((topic) => {
            const Icon = topic.icon
            return (
              <li key={topic.title}>
                <Link
                  href={topic.href}
                  className="lift group flex h-full flex-col rounded-[8px] border border-border bg-surface p-6 hover:border-foreground/15"
                >
                  <Icon className="icon-hover size-5 text-muted-foreground" aria-hidden="true" />
                  <h3 className="mt-8 font-display text-lg font-semibold">{topic.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {topic.body}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    {topic.cta}
                    <ArrowUpRight className="arrow-hover size-4" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            )
          })}
        </RevealGroup>
      </Section>

      {/* ═══ FAQ ════════════════════════════════════════════════════════════ */}
      <Section aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl">
          <SectionHead
            eyebrow="FAQ"
            id="faq-heading"
            title="Questions people actually ask"
            align="center"
          />
          <div className="mt-10">
            <FaqAccordion
              commissionPercent={commissionPercent}
              exampleFee={formatMoney(200_000, 'NGN')}
              exampleNet={formatMoney(200_000 - (200_000 * commissionPercent) / 100, 'NGN')}
            />
          </div>
        </div>
      </Section>

      {/* ═══ Contact ════════════════════════════════════════════════════════ */}
      <Section aria-labelledby="contact-heading">
        <div className="panel overflow-hidden">
          <div className="grid gap-px bg-border md:grid-cols-2">
            <div className="bg-surface p-8 sm:p-10">
              <LifeBuoy className="size-5 text-muted-foreground" aria-hidden="true" />
              <h2 id="contact-heading" className="mt-6 text-display-sm">
                Still stuck?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Describe what happened and include the job reference if there is one. Messages are
                read by a person, and disputes are prioritised over general questions.
              </p>
            </div>

            <div className="bg-surface p-8 sm:p-10">
              <ul className="space-y-6">
                <li>
                  <div className="flex items-center gap-2.5">
                    <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm font-medium">In-app messaging</p>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    Fastest route for anything tied to a live job, because the thread comes with it.
                  </p>
                  <Button asChild variant="ghost" size="sm" className="mt-3 rounded-full">
                    <Link href="/login?next=/home">
                      Open the app
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  </Button>
                </li>

                <li className="border-t border-border pt-6">
                  <div className="flex items-center gap-2.5">
                    <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm font-medium">Email</p>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    For account, payout or privacy matters that are not about one specific job.
                  </p>
                  <a
                    href="mailto:help@hustlestreet.ng"
                    className="link-underline mt-3 inline-block text-sm font-medium"
                  >
                    help@hustlestreet.ng
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
