import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Clock,
  Download,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Wifi,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { CATEGORY_EMOJI } from '@/components/job/job-card'
import { NearbyJobsPreview } from '@/components/marketing/nearby-jobs-preview'
import { FaqAccordion } from '@/components/marketing/faq-accordion'
import { EscrowDiagram } from '@/components/marketing/escrow-diagram'
import { VideoPlayer } from '@/components/media/video-player'
import { MediaFrame, PhoneMockup, StoryCard } from '@/components/media/media-frame'
import { APP_SHOTS, ESCROW_VIDEO, HERO_VIDEO, HUSTLER_STORIES, SCENES } from '@/lib/config/media'
import { formatMoney } from '@/lib/money'
import type { Category } from '@/types/database'

export const metadata: Metadata = {
  title: 'Get things done. Find people who can.',
  description:
    'Hustle Street connects you with skilled people nearby who are ready to get the job done. Post a job in minutes, or find work near you in Lagos. Payment is held securely until the work is confirmed.',
  alternates: { canonical: '/' },
}

// Mostly static content over reference data, so it is prerendered and
// revalidated hourly rather than rebuilt per request.
export const revalidate = 3600

const HOW_IT_WORKS = [
  {
    icon: Sparkles,
    title: 'Say what you need',
    body: 'Describe the job, set your budget, pick a time. About two minutes on a phone.',
  },
  {
    icon: MapPin,
    title: 'Hustlers nearby see it',
    body: 'People with the right skills in your area get notified straight away.',
  },
  {
    icon: MessageSquare,
    title: 'Compare and chat',
    body: 'Ratings, past work, prices and distance side by side. Message before you commit.',
  },
  {
    icon: ShieldCheck,
    title: 'Pay when it’s done',
    body: 'Money is held securely and released only when you confirm the work.',
  },
]

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: 'Money held until you’re happy',
    body: 'Payment is secured the moment you hire and released only when you confirm. If something goes wrong, open a dispute and a real person reviews it.',
  },
  {
    icon: BadgeCheck,
    title: 'Verified people, honest reviews',
    body: 'Phone and ID verification, and reviews that can only come from completed jobs. Neither side sees the other’s review until both have submitted.',
  },
  {
    icon: MapPin,
    title: 'Your address stays yours',
    body: 'Jobs show an area and a distance — never your street. Exact details reach only the hustler you actually hire.',
  },
]

export default async function LandingPage() {
  const supabase = await createClient()

  const [{ data: categories }, commissionSetting] = await Promise.all([
    supabase
      .from('categories')
      .select('id, slug, name, icon, job_count')
      .eq('is_active', true)
      .is('parent_id', null)
      .order('position')
      .limit(15),
    supabase.from('platform_settings').select('value').eq('key', 'commission_rate_bps').maybeSingle(),
  ])

  const commissionPercent = commissionSetting.data ? Number(commissionSetting.data.value) / 100 : 10
  const categoryList = (categories ?? []) as Pick<
    Category,
    'id' | 'slug' | 'name' | 'icon' | 'job_count'
  >[]

  return (
    <>
      {/* ═══ Hero ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(58rem 32rem at 10% -10%, hsl(var(--primary) / 0.18), transparent 62%), radial-gradient(42rem 26rem at 95% 4%, hsl(var(--money) / 0.13), transparent 60%)',
          }}
        />

        <div className="container py-14 sm:py-20 lg:py-24">
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

              {/* Search is the primary affordance, not a decorative box. */}
              <form action="/explore" method="get" className="mt-7 max-w-lg">
                <label htmlFor="hero-search" className="sr-only">
                  Search for a job, service or skill
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="hero-search"
                    name="q"
                    type="search"
                    placeholder="Plumber, cleaner…"
                    className="h-14 w-full rounded-2xl border border-input bg-surface py-4 pl-12 pr-32 text-[15px] shadow-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                  <Button type="submit" className="absolute right-2 top-1/2 h-11 -translate-y-1/2">
                    Search
                  </Button>
                </div>
              </form>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="xl">
                  <Link href="/post">
                    Post a Job
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="xl" variant="outline">
                  <Link href="/signup?intent=hustle">Start hustling</Link>
                </Button>
              </div>

              <dl className="mt-9 flex flex-wrap gap-x-9 gap-y-4">
                {[
                  { label: 'Costs to post', value: 'Free', tone: 'text-money' },
                  { label: 'Platform fee', value: `${commissionPercent}%` },
                  { label: 'Payment held', value: 'Until done' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </dt>
                    <dd className={`font-display text-2xl font-extrabold ${stat.tone ?? ''}`}>
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* The product itself, plus live marketplace data. */}
            <div className="relative">
              <PhoneMockup
                src={APP_SHOTS.home}
                alt="The Hustle Street home screen showing jobs near you in Lekki Phase 1"
                priority
                tilt="right"
              />

              <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-lg lg:absolute lg:-left-8 lg:bottom-6 lg:mt-0 lg:w-72 xl:-left-16">
                <NearbyJobsPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Featured video ═════════════════════════════════════════════════ */}
      <section
        className="border-y border-border bg-surface-muted py-14 sm:py-20"
        aria-labelledby="watch-heading"
      >
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <VideoPlayer
              sources={HERO_VIDEO.sources}
              poster={HERO_VIDEO.poster}
              title={HERO_VIDEO.title}
              description={HERO_VIDEO.description}
              duration={HERO_VIDEO.duration}
              transcript={HERO_VIDEO.transcript}
            />

            <div>
              <Badge variant="neutral" size="lg" className="mb-4">
                Watch
              </Badge>
              <h2 id="watch-heading" className="text-display-md">
                One job, start to finish
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                A sofa that needed moving in Lekki. Posted at 1:14pm, three applications by 1:23pm,
                done and paid for by six.
              </p>

              <ul className="mt-6 space-y-3">
                {[
                  { icon: Clock, label: 'Posted in under two minutes' },
                  { icon: MapPin, label: '12 hustlers nearby notified instantly' },
                  { icon: ShieldCheck, label: 'Payment released on confirmation' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.label} className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </li>
                  )
                })}
              </ul>

              <Button asChild variant="outline" className="mt-7">
                <Link href="/how-it-works">See how it works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Categories ═════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20" aria-labelledby="categories-heading">
        <div className="container">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 id="categories-heading" className="text-display-sm">
                Whatever it is, someone nearby does it
              </h2>
              <p className="mt-1.5 text-muted-foreground">
                Fifteen categories, from a leaking tap to a brand identity.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/categories">
                See all
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categoryList.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/explore?categories=${category.id}`}
                  className="street-card flex h-full flex-col gap-2 p-4"
                >
                  <span className="text-3xl" aria-hidden="true">
                    {CATEGORY_EMOJI[category.slug] ?? '🛠️'}
                  </span>
                  <span className="font-display text-sm font-bold leading-snug">{category.name}</span>
                  <span className="mt-auto text-xs text-muted-foreground">
                    {category.job_count > 0
                      ? `${category.job_count.toLocaleString()} ${category.job_count === 1 ? 'job' : 'jobs'}`
                      : 'Be the first'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══ How it works ═══════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="border-y border-border bg-surface-muted py-14 sm:py-20"
        aria-labelledby="how-heading"
      >
        <div className="container">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 id="how-heading" className="text-display-md">
              How Hustle Street works
            </h2>
            <p className="mt-3 text-pretty text-lg text-muted-foreground">
              Someone needs something done. Someone nearby knows how to do it. We connect them — and
              hold the money until everyone&rsquo;s happy.
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

      {/* ═══ For posters ════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20" aria-labelledby="posters-heading">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <MediaFrame
              src={SCENES.post}
              alt="A job being posted and picked up by hustlers nearby"
              aspect="wide"
              tint="primary"
              rounded="3xl"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />

            <div>
              <Badge variant="primary" size="lg" className="mb-4">
                For anyone who needs something done
              </Badge>
              <h2 id="posters-heading" className="text-display-md">
                Stop asking around
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                No more calling three people who know a guy. Describe the job once, and people who
                actually do it — and who are actually near you — come to you.
              </p>

              <ul className="mt-6 space-y-3.5">
                {[
                  'Free to post, no listing fees, no subscription',
                  'Compare ratings, completed jobs and prices side by side',
                  'Message before you commit to anyone',
                  'Your money is held until you confirm the work is done',
                ].map((point) => (
                  <li key={point} className="flex gap-3">
                    <BadgeCheck className="mt-0.5 size-5 shrink-0 text-money" aria-hidden="true" />
                    <span className="text-sm leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>

              <Button asChild size="lg" className="mt-7">
                <Link href="/post">
                  Post a Job
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ For hustlers ═══════════════════════════════════════════════════ */}
      <section
        className="border-y border-border bg-surface-muted py-14 sm:py-20"
        aria-labelledby="hustlers-heading"
      >
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="lg:order-2">
              <MediaFrame
                src={SCENES.hustlers}
                alt="Skilled workers available for jobs in nearby areas"
                aspect="wide"
                tint="money"
                rounded="3xl"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>

            <div className="lg:order-1">
              <Badge variant="money" size="lg" className="mb-4">
                For anyone with a skill
              </Badge>
              <h2 id="hustlers-heading" className="text-display-md">
                Turn your skill into income
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                Set your rates, choose how far you&rsquo;ll travel, and get alerted the moment a job
                lands near you. No bidding wars, no paying to apply.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Banknote, title: 'Paid on completion', body: 'Money is secured before you start work.' },
                  { icon: MapPin, title: 'Work near you', body: 'You set your own service radius.' },
                  { icon: Star, title: 'Build a reputation', body: 'Real reviews from real completed jobs.' },
                  { icon: Wifi, title: 'Or work remotely', body: 'Design, writing and development, anywhere.' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="rounded-2xl border border-border bg-surface p-4">
                      <Icon className="size-5 text-money" aria-hidden="true" />
                      <p className="mt-2.5 font-display text-sm font-bold">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                  )
                })}
              </div>

              <Button asChild size="lg" variant="money" className="mt-7">
                <Link href="/signup?intent=hustle">
                  Become a hustler
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Escrow explainer + video ═══════════════════════════════════════ */}
      <section id="payments" className="py-14 sm:py-20" aria-labelledby="escrow-heading">
        <div className="container">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <Badge variant="money" size="lg" className="mb-4">
              <ShieldCheck aria-hidden="true" />
              Secure payments
            </Badge>
            <h2 id="escrow-heading" className="text-display-md">
              Money that moves when the work is done
            </h2>
            <p className="mt-3 text-pretty text-lg text-muted-foreground">
              Neither side has to go first. The money is secured up front and released on
              confirmation.
            </p>
          </div>

          <EscrowDiagram commissionPercent={commissionPercent} exampleMinor={2_000_000} />

          <div className="mt-12 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <h3 className="font-display text-xl font-bold">What if something goes wrong?</h3>
              <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
                Don&rsquo;t confirm. Open a dispute instead and the money stays held while a real
                person reviews the messages, photos and evidence from both sides. They can refund
                you fully, release fully, or split it.
              </p>
              <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
                And if a poster simply goes quiet, payment releases to the hustler automatically
                after 72 hours — nobody&rsquo;s earnings get held hostage.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link href="/safety">Read about trust &amp; safety</Link>
              </Button>
            </div>

            <VideoPlayer
              sources={ESCROW_VIDEO.sources}
              poster={ESCROW_VIDEO.poster}
              title={ESCROW_VIDEO.title}
              description={ESCROW_VIDEO.description}
              duration={ESCROW_VIDEO.duration}
              transcript={ESCROW_VIDEO.transcript}
            />
          </div>
        </div>
      </section>

      {/* ═══ Hustler stories ════════════════════════════════════════════════ */}
      <section
        className="border-y border-border bg-surface-muted py-14 sm:py-20"
        aria-labelledby="stories-heading"
      >
        <div className="container">
          <div className="mb-9 max-w-2xl">
            <h2 id="stories-heading" className="text-display-md">
              People already hustling
            </h2>
            <p className="mt-3 text-pretty text-lg text-muted-foreground">
              Short films from three of the people earning on Hustle Street across Lagos.
            </p>
          </div>

          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HUSTLER_STORIES.map((story) => (
              <li key={story.id}>
                <StoryCard
                  poster={story.poster}
                  name={story.name}
                  trade={story.trade}
                  area={story.area}
                  quote={story.quote}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══ The app ════════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20" aria-labelledby="app-heading">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Badge variant="primary" size="lg" className="mb-4">
              <Download aria-hidden="true" />
              Installs like an app
            </Badge>
            <h2 id="app-heading" className="text-display-md">
              Built for the phone in your hand
            </h2>
            <p className="mt-3 text-pretty text-lg text-muted-foreground">
              Add it to your home screen — no app store, no 80MB download. It works on a weak
              connection and keeps your saved jobs available offline.
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-3 lg:gap-6">
            {[
              {
                src: APP_SHOTS.home,
                alt: 'Home screen showing jobs near you with prices and distances',
                title: 'Everything near you',
                body: 'Jobs ranked by distance, urgency and how well they match your skills.',
                tilt: 'left' as const,
              },
              {
                src: APP_SHOTS.discover,
                alt: 'Discover screen with a map of nearby jobs and filter chips',
                title: 'Find it on the map',
                body: 'Filter by distance, budget and category. Approximate pins only — never an address.',
                tilt: undefined,
              },
              {
                src: APP_SHOTS.chat,
                alt: 'Chat screen showing a job conversation with payment secured and a confirm button',
                title: 'Chat, agree, get paid',
                body: 'Every conversation is tied to its job, its agreement and its payment.',
                tilt: 'right' as const,
              },
            ].map((shot) => (
              <div key={shot.title} className="text-center">
                <PhoneMockup src={shot.src} alt={shot.alt} tilt={shot.tilt} />
                <h3 className="mt-8 font-display text-lg font-bold">{shot.title}</h3>
                <p className="mx-auto mt-1.5 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
                  {shot.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Coverage ═══════════════════════════════════════════════════════ */}
      <section
        className="border-y border-border bg-surface-muted py-14 sm:py-20"
        aria-labelledby="coverage-heading"
      >
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Badge variant="neutral" size="lg" className="mb-4">
                <MapPin aria-hidden="true" />
                Where we are
              </Badge>
              <h2 id="coverage-heading" className="text-display-md">
                Live across Lagos
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                Island and mainland, from Ajah to Festac. Abuja, Port Harcourt and Ibadan are next —
                and remote work has no location requirement at all.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  'Lekki', 'Victoria Island', 'Ikoyi', 'Ajah', 'Ikeja', 'Yaba',
                  'Surulere', 'Gbagada', 'Magodo', 'Festac', 'Ikorodu', 'Agege',
                ].map((area) => (
                  <span
                    key={area}
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium"
                  >
                    {area}
                  </span>
                ))}
              </div>

              <p className="mt-5 text-sm text-muted-foreground">
                Not in your area yet?{' '}
                <Link href="/signup" className="font-semibold text-primary hover:underline">
                  Sign up anyway
                </Link>{' '}
                — we open new areas where demand shows up.
              </p>
            </div>

            <MediaFrame
              src={SCENES.coverage}
              alt="Map of Lagos showing Hustle Street coverage across Ikeja, Yaba, Surulere, Ikoyi, Victoria Island, Lekki, Ajah and Festac"
              aspect="wide"
              tint="money"
              rounded="3xl"
              sizes="(max-width: 1024px) 100vw, 55vw"
            />
          </div>
        </div>
      </section>

      {/* ═══ Trust ══════════════════════════════════════════════════════════ */}
      <section id="trust" className="py-14 sm:py-20" aria-labelledby="trust-heading">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Badge variant="money" size="lg" className="mb-4">
                <ShieldCheck aria-hidden="true" />
                Trust &amp; safety
              </Badge>
              <h2 id="trust-heading" className="text-display-md">
                Built for hiring a stranger
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
                The hardest part of this is trust. So it is the part we built the platform around —
                not a policy page bolted on afterwards.
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

      {/* ═══ FAQ ════════════════════════════════════════════════════════════ */}
      <section
        id="faq"
        className="border-t border-border bg-surface-muted py-14 sm:py-20"
        aria-labelledby="faq-heading"
      >
        <div className="container max-w-3xl">
          <h2 id="faq-heading" className="text-display-sm text-center">
            Questions people actually ask
          </h2>
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

      {/* ═══ Final CTA ══════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center sm:px-12 sm:py-20">
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
              style={{
                background:
                  'radial-gradient(36rem 22rem at 20% 0%, hsl(var(--primary) / 0.32), transparent 62%), radial-gradient(30rem 20rem at 85% 100%, hsl(var(--money) / 0.22), transparent 60%)',
              }}
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-display-lg text-white">
                Need it done? Ready to hustle?
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-white/70">
                One account does both. Posting is free, and you only pay when someone actually does
                the work.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="xl">
                  <Link href="/post">
                    Post a Job
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="xl"
                  variant="outline"
                  className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/explore">Find Work</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

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
