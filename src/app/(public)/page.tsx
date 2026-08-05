import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { CATEGORY_EMOJI } from '@/components/job/job-card'
import { NearbyJobsPreview } from '@/components/marketing/nearby-jobs-preview'
import { FaqAccordion } from '@/components/marketing/faq-accordion'
import { formatMoney } from '@/lib/money'
import type { Category } from '@/types/database'

export const metadata: Metadata = {
  title: 'Get things done. Find people who can.',
  description:
    'Hustle Street connects you with skilled people nearby who are ready to get the job done. Post a job in minutes, or find work near you in Lagos.',
  alternates: { canonical: '/' },
}

// The landing page is mostly static content over reference data, so it is
// rendered ahead of time and revalidated hourly rather than per request.
export const revalidate = 3600

const HOW_IT_WORKS = [
  {
    icon: Sparkles,
    title: 'Say what you need',
    body: 'Describe the job, set your budget, pick a time. Takes about two minutes.',
  },
  {
    icon: MapPin,
    title: 'Hustlers nearby see it',
    body: 'People with the right skills in your area get notified straight away.',
  },
  {
    icon: MessageSquare,
    title: 'Compare and chat',
    body: 'Look at ratings, past work and prices. Message before you commit.',
  },
  {
    icon: ShieldCheck,
    title: 'Pay when it’s done',
    body: 'Your money is held securely and only released when you confirm the work.',
  },
]

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: 'Money held until you’re happy',
    body: 'Payment is secured the moment you hire and released only when you confirm the job is done. If something goes wrong, open a dispute and a real person reviews it.',
  },
  {
    icon: BadgeCheck,
    title: 'Verified people, real reviews',
    body: 'Phone and ID verification, plus reviews that only come from completed jobs. Both sides review each other, and neither sees the other’s until both have submitted.',
  },
  {
    icon: MapPin,
    title: 'Your address stays yours',
    body: 'Jobs show an area and a distance — never your street address. Exact details are shared only with the hustler you actually hire.',
  },
]

export default async function LandingPage() {
  const supabase = await createClient()

  // Real reference data, not a hardcoded array. Categories are managed from the
  // admin dashboard and this page reflects them within the hour.
  const { data: categories } = await supabase
    .from('categories')
    .select('id, slug, name, icon, job_count')
    .eq('is_active', true)
    .is('parent_id', null)
    .order('position')
    .limit(15)

  const commissionSetting = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'commission_rate_bps')
    .maybeSingle()

  const commissionPercent = commissionSetting.data
    ? Number(commissionSetting.data.value) / 100
    : 10

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Warm radial wash behind the hero, evoking street light rather than a gradient banner. */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(60rem 32rem at 12% -8%, hsl(var(--primary) / 0.16), transparent 62%), radial-gradient(44rem 26rem at 92% 6%, hsl(var(--money) / 0.12), transparent 60%)',
          }}
        />

        <div className="container py-16 sm:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Badge variant="primary" size="lg" className="mb-5">
                <Zap aria-hidden="true" />
                Now live in Lagos
              </Badge>

              <h1 className="text-display-xl">
                Get things done.
                <br />
                <span className="text-primary">Find people who can.</span>
              </h1>

              <p className="mt-5 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
                Hustle Street connects you with skilled people nearby who are ready to get the job
                done — from moving a sofa to designing a flyer.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="xl" className="sm:w-auto">
                  <Link href="/post">
                    Post a Job
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="xl" variant="outline">
                  <Link href="/explore">Find Work</Link>
                </Button>
              </div>

              <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Platform fee
                  </dt>
                  <dd className="font-display text-2xl font-extrabold">{commissionPercent}%</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Costs to post
                  </dt>
                  <dd className="font-display text-2xl font-extrabold text-money">Free</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Payment held
                  </dt>
                  <dd className="font-display text-2xl font-extrabold">Until done</dd>
                </div>
              </dl>
            </div>

            {/* Product preview: a real search box and live nearby jobs, not a mockup image. */}
            <div className="relative">
              <div className="rounded-3xl border border-border bg-surface p-5 shadow-pop sm:p-6">
                <p className="font-display text-lg font-bold">What do you need done?</p>

                <form action="/explore" method="get" className="mt-3">
                  <label htmlFor="hero-search" className="sr-only">
                    Search for a job, service or skill
                  </label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      id="hero-search"
                      name="q"
                      type="search"
                      placeholder="Search for a job, service or skill…"
                      className="h-14 w-full rounded-2xl border border-input bg-background pl-11 pr-28 text-[15px] placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                    <Button type="submit" size="sm" className="absolute right-2 top-2 h-10">
                      Search
                    </Button>
                  </div>
                </form>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Popular right now
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Plumber', 'Cleaner', 'Dispatch rider', 'Makeup artist', 'Graphic designer'].map(
                      (term) => (
                        <Link
                          key={term}
                          href={`/explore?q=${encodeURIComponent(term)}`}
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
                        >
                          {term}
                        </Link>
                      ),
                    )}
                  </div>
                </div>

                <div className="mt-5 border-t border-border pt-4">
                  <NearbyJobsPreview />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-surface-muted py-14 sm:py-20">
        <div className="container">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-display-sm">Popular categories</h2>
              <p className="mt-1.5 text-muted-foreground">Whatever it is, someone nearby does it.</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/categories">
                See all
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(categories as Pick<Category, 'id' | 'slug' | 'name' | 'icon' | 'job_count'>[] | null)?.map(
              (category) => (
                <li key={category.id}>
                  <Link
                    href={`/explore?categories=${category.id}`}
                    className="street-card flex h-full flex-col gap-2 p-4"
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {CATEGORY_EMOJI[category.slug] ?? '🛠️'}
                    </span>
                    <span className="font-display text-sm font-bold leading-snug">
                      {category.name}
                    </span>
                    <span className="mt-auto text-xs text-muted-foreground">
                      {category.job_count > 0
                        ? `${category.job_count.toLocaleString()} ${category.job_count === 1 ? 'job' : 'jobs'}`
                        : 'Be the first'}
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-14 sm:py-20">
        <div className="container">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-display-md">How Hustle Street works</h2>
            <p className="mt-3 text-pretty text-lg text-muted-foreground">
              Someone needs something done. Someone nearby knows how to do it. We connect them —
              and hold the money until everyone&rsquo;s happy.
            </p>
          </div>

          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, index) => {
              const Icon = step.icon
              return (
                <li key={step.title} className="street-card relative p-5">
                  <span
                    className="absolute right-4 top-4 font-display text-4xl font-extrabold text-primary/10"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3.5 font-display text-base font-bold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* ── Trust ─────────────────────────────────────────────────────────── */}
      <section id="trust" className="border-y border-border bg-surface-muted py-14 sm:py-20">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Badge variant="money" size="lg" className="mb-4">
                <ShieldCheck aria-hidden="true" />
                Trust &amp; safety
              </Badge>
              <h2 className="text-display-md">Money that moves when the work is done</h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                The hardest part of hiring a stranger is trust. So we built the platform around it:
                payment is secured up front, released on confirmation, and every naira is tracked in
                an auditable ledger.
              </p>
              <Button asChild variant="outline" size="lg" className="mt-6">
                <Link href="/safety">How we keep you safe</Link>
              </Button>
            </div>

            <ul className="space-y-4">
              {TRUST_POINTS.map((point) => {
                const Icon = point.icon
                return (
                  <li key={point.title} className="street-card flex gap-4 p-5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-money-soft text-money">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold">{point.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {point.body}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Become a hustler ──────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-12 text-background sm:px-12 sm:py-16">
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
              style={{
                background:
                  'radial-gradient(40rem 24rem at 88% 10%, hsl(var(--primary) / 0.28), transparent 62%)',
              }}
            />
            <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <h2 className="text-display-md text-background">Ready to hustle?</h2>
                <p className="mt-4 max-w-lg text-pretty text-lg leading-relaxed text-background/75">
                  Turn your skills into income. Set your rates, choose how far you&rsquo;ll travel,
                  and get notified the moment a job lands near you.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <Link href="/signup?intent=hustle">Become a hustler</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background"
                  >
                    <Link href="/explore">See jobs near you</Link>
                  </Button>
                </div>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  { icon: Banknote, label: 'Get paid on completion', detail: 'Money is secured before you start.' },
                  { icon: MapPin, label: 'Work near you', detail: 'Set your own service radius.' },
                  { icon: Star, label: 'Build a reputation', detail: 'Real reviews from real jobs.' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <li
                      key={item.label}
                      className="flex items-center gap-3 rounded-2xl bg-background/10 p-4 backdrop-blur-sm"
                    >
                      <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-bold">{item.label}</p>
                        <p className="text-xs text-background/65">{item.detail}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="border-t border-border py-14 sm:py-20">
        <div className="container max-w-3xl">
          <h2 className="text-display-sm text-center">Questions people actually ask</h2>
          <div className="mt-8">
            <FaqAccordion
              commissionPercent={commissionPercent}
              exampleFee={formatMoney(200_000, 'NGN')}
              exampleNet={formatMoney(200_000 - (200_000 * commissionPercent) / 100, 'NGN')}
            />
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Still stuck?{' '}
            <Link href="/help" className="font-semibold text-primary hover:underline">
              Talk to us
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Structured data so the marketplace can surface in search. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Hustle Street',
            description:
              'A location-based marketplace connecting people who need things done with skilled people nearby.',
            url: process.env.NEXT_PUBLIC_APP_URL,
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `${process.env.NEXT_PUBLIC_APP_URL}/explore?q={search_term_string}`,
              },
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
    </>
  )
}
