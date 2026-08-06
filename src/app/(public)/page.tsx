import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Clock,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Wifi,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { NearbyJobsPreview } from '@/components/marketing/nearby-jobs-preview'
import { CategoryMarquee } from '@/components/marketing/category-marquee'
import { FaqAccordion } from '@/components/marketing/faq-accordion'
import { EscrowDiagram } from '@/components/marketing/escrow-diagram'
import { VideoPlayer } from '@/components/media/video-player'
import { MediaFrame, PhoneMockup, StoryCard } from '@/components/media/media-frame'
import { APP_SHOTS, ESCROW_VIDEO, HERO_VIDEO, HUSTLER_STORIES, SCENES } from '@/lib/config/media'
import { formatMoney } from '@/lib/money'
import { ClosingCta, Section, SectionHead, Step } from '@/components/marketing/page-primitives'
import { RevealGroup, RevealItem, RevealOnMount } from '@/components/motion/reveal'
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

const AREAS = [
  'Lekki', 'Victoria Island', 'Ikoyi', 'Ajah', 'Ikeja', 'Yaba',
  'Surulere', 'Gbagada', 'Magodo', 'Festac', 'Ikorodu', 'Agege',
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
      {/* ═══ Hero ═══════════════════════════════════════════════════════════
          Ruled paper, a headline that resolves into focus, and nothing else.
          The gradient washes and film grain that used to sit here were three
          textures competing with the type; the grid is the one that earns it. */}
      <section className="relative pb-16 pt-14 sm:pb-24 sm:pt-20">
        {/* Its own absolutely positioned layer rather than a class on the
            section: the mask that fades the grid out would otherwise clip the
            content painted on top of it. */}
        <div
          className="grid-lines pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem]"
          aria-hidden="true"
        />

        <div className="container">
          {/* Above the fold, so this plays on mount rather than on scroll. The
              headline gets the blur treatment — worth spending exactly once. */}
          <RevealOnMount className="mx-auto max-w-3xl text-center" stagger={0.14}>
            <RevealItem effect="blur" duration={1.1}>
              <h1 className="text-display-xl">
                Get things done.
                <br />
                Find people who can.
              </h1>
            </RevealItem>

            <RevealItem
              as="p"
              className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground"
            >
              Hustle Street connects you with skilled people nearby who are ready to get the job
              done — from moving a sofa to designing a flyer.
            </RevealItem>

            {/* Search stays the primary affordance. Pill-shaped so it agrees
                with the buttons rather than reading as a form field bolted on. */}
            <RevealItem className="mx-auto mt-9 max-w-md">
              <form action="/explore" method="get">
                <label htmlFor="hero-search" className="sr-only">
                  Search for a job, service or skill
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="hero-search"
                    name="q"
                    type="search"
                    placeholder="Plumber, cleaner…"
                    className="h-14 w-full rounded-full border border-input bg-surface pl-12 pr-28 text-[15px] transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/20 focus:outline-none focus:ring-4 focus:ring-foreground/5"
                  />
                  <Button
                    type="submit"
                    variant="ink"
                    className="absolute right-1.5 top-1/2 h-11 -translate-y-1/2 rounded-full px-5"
                  >
                    Search
                  </Button>
                </div>
              </form>
            </RevealItem>

            <RevealItem className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full px-7">
                <Link href="/post">
                  Post a Job
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="group rounded-full px-6">
                <Link href="/signup?intent=hustle">
                  Start hustling
                  <ArrowUpRight className="arrow-hover" aria-hidden="true" />
                </Link>
              </Button>
            </RevealItem>
          </RevealOnMount>

          {/* Product shot as one wide panel. The live-jobs card overlaps its
              lower-left corner so the composition has one deliberate break. */}
          <RevealItem effect="scale" duration={1} className="relative mt-16 sm:mt-20">
            <div className="panel overflow-hidden px-6 pt-12 sm:px-12 sm:pt-16">
              <div className="mx-auto max-w-[280px] sm:max-w-[320px]">
                <PhoneMockup
                  src={APP_SHOTS.home}
                  alt="The Hustle Street home screen showing jobs near you in Lekki Phase 1"
                  priority
                />
              </div>
            </div>

            <div className="mx-auto -mt-10 max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-lg lg:absolute lg:bottom-10 lg:left-10 lg:mt-0 lg:w-72">
              <NearbyJobsPreview />
            </div>
          </RevealItem>
        </div>
      </section>

      {/* ═══ What this is ═══════════════════════════════════════════════════
          Heading left, answer right — the split that lets a plain statement of
          the product sit on its own without decoration. */}
      <Section aria-labelledby="what-heading">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <h2 id="what-heading" className="text-display-lg">
              What is Hustle Street?
            </h2>
            <Button asChild variant="ink" size="md" className="mt-7 rounded-full px-6">
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
          <div className="lg:pt-2">
            <p className="text-pretty text-xl leading-relaxed sm:text-2xl sm:leading-relaxed">
              A marketplace for getting things done by people who are actually near you. Post what
              you need, compare the people who reply, and pay only when the work is finished.
            </p>
            <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
              Free to post. No subscription, no listing fees, no paying to apply. We take{' '}
              {commissionPercent}% when a job completes — and nothing at all if it doesn’t.
            </p>
          </div>
        </div>

        {/* One light card, two ink. The dark mass gives an otherwise pale page
            somewhere to rest, and marks these three as the load-bearing claims. */}
        <RevealGroup as="ul" className="mt-14 grid gap-4 md:grid-cols-3">
          {TRUST_POINTS.map((point, index) => {
            const Icon = point.icon
            const inverted = index > 0
            return (
              <li
                key={point.title}
                className={`lift group flex flex-col p-7 ${inverted ? 'panel-ink' : 'panel bg-surface-muted'}`}
              >
                <Icon
                  className={`icon-hover size-5 ${inverted ? 'text-white/70' : 'text-primary'}`}
                  aria-hidden="true"
                />
                <h3
                  className={`mt-16 font-display text-lg font-semibold leading-snug ${inverted ? 'text-white' : ''}`}
                >
                  {point.title}
                </h3>
                <p
                  className={`mt-3 text-sm leading-relaxed ${inverted ? 'text-white/60' : 'text-muted-foreground'}`}
                >
                  {point.body}
                </p>
              </li>
            )
          })}
        </RevealGroup>

        {/* Coverage as a quiet strip, where a logo wall would otherwise go. */}
        <div className="mt-14 flex flex-col gap-5 border-t border-border/60 pt-8 lg:flex-row lg:items-start lg:gap-12">
          <p className="max-w-[14rem] shrink-0 text-sm leading-relaxed text-muted-foreground">
            Live across Lagos, island and mainland.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {AREAS.map((area) => (
              <li key={area} className="text-sm text-muted-foreground/70">
                {area}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ═══ Categories ═════════════════════════════════════════════════════ */}
      <Section aria-labelledby="categories-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead
            eyebrow="Categories"
            id="categories-heading"
            title="Whatever it is, someone nearby does it"
            lede="Fifteen categories, from a leaking tap to a brand identity."
          />
          <Button asChild variant="ghost" size="sm" className="group rounded-full">
            <Link href="/categories">
              See all
              <ArrowRight className="arrow-hover" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {/* A moving rail rather than a static grid. Fifteen categories in a
            5-across grid was a wall of equal-weight tiles you had to read; in
            motion they arrive one at a time and the section stops asking for a
            decision up front. Tiles keep the tight 8px corner and the single
            icon colour — the rotating four-way tint was giving each an
            arbitrary meaning the categories don't actually have. */}
        <div className="mt-10">
          <CategoryMarquee categories={categoryList} />
        </div>
      </Section>

      {/* ═══ How it works ═══════════════════════════════════════════════════ */}
      <Section id="how-it-works" aria-labelledby="how-heading">
        <SectionHead
          eyebrow="How it works"
          id="how-heading"
          title="Four steps, about two minutes"
          lede="Someone needs something done. Someone nearby knows how to do it. We connect them — and hold the money until everyone’s happy."
        />

        <RevealGroup as="ol" className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((step, index) => (
            <Step key={step.title} index={index + 1} title={step.title}>
              {step.body}
            </Step>
          ))}
        </RevealGroup>
      </Section>

      {/* ═══ Featured video ═════════════════════════════════════════════════ */}
      <Section aria-labelledby="watch-heading">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
          <VideoPlayer
            sources={HERO_VIDEO.sources}
            poster={HERO_VIDEO.poster}
            title={HERO_VIDEO.title}
            description={HERO_VIDEO.description}
            duration={HERO_VIDEO.duration}
            transcript={HERO_VIDEO.transcript}
          />

          <div>
            <SectionHead
              eyebrow="Watch"
              id="watch-heading"
              title="One job, start to finish"
              lede="A sofa that needed moving in Lekki. Posted at 1:14pm, three applications by 1:23pm, done and paid for by six."
            />

            <ul className="mt-7 space-y-4">
              {[
                { icon: Clock, label: 'Posted in under two minutes' },
                { icon: MapPin, label: '12 hustlers nearby notified instantly' },
                { icon: ShieldCheck, label: 'Payment released on confirmation' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.label} className="flex items-center gap-3">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm">{item.label}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </Section>

      {/* ═══ For posters ════════════════════════════════════════════════════ */}
      <Section aria-labelledby="posters-heading">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <MediaFrame
            src={SCENES.post}
            alt="A job being posted and picked up by hustlers nearby"
            aspect="wide"
            rounded="3xl"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />

          <div>
            <SectionHead
              eyebrow="If you need something done"
              id="posters-heading"
              title="Stop asking around"
              lede="No more calling three people who know a guy. Describe the job once, and people who actually do it — and who are actually near you — come to you."
            />

            <ul className="mt-7 space-y-3.5">
              {[
                'Free to post, no listing fees, no subscription',
                'Compare ratings, completed jobs and prices side by side',
                'Message before you commit to anyone',
                'Your money is held until you confirm the work is done',
              ].map((point) => (
                <li key={point} className="flex gap-3">
                  <BadgeCheck
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-sm leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>

            <Button asChild size="lg" className="group mt-8 rounded-full px-7">
              <Link href="/post">
                Post a Job
                <ArrowRight className="arrow-hover" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* ═══ For hustlers ═══════════════════════════════════════════════════ */}
      <Section aria-labelledby="hustlers-heading">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="lg:order-2">
            <MediaFrame
              src={SCENES.hustlers}
              alt="Skilled workers available for jobs in nearby areas"
              aspect="wide"
              rounded="3xl"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          <div className="lg:order-1">
            <SectionHead
              eyebrow="If you have a skill"
              id="hustlers-heading"
              title="Turn your skill into income"
              lede="Set your rates, choose how far you’ll travel, and get alerted the moment a job lands near you. No bidding wars, no paying to apply."
            />

            <RevealGroup className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {[
                { icon: Banknote, title: 'Paid on completion', body: 'Money is secured before you start work.' },
                { icon: MapPin, title: 'Work near you', body: 'You set your own service radius.' },
                { icon: Star, title: 'Build a reputation', body: 'Real reviews from real completed jobs.' },
                { icon: Wifi, title: 'Or work remotely', body: 'Design, writing and development, anywhere.' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="border-t border-border pt-4">
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-3 font-display text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                )
              })}
            </RevealGroup>

            <Button asChild size="lg" variant="ink" className="group mt-8 rounded-full px-7">
              <Link href="/signup?intent=hustle">
                Become a hustler
                <ArrowRight className="arrow-hover" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* ═══ Escrow explainer + video ═══════════════════════════════════════ */}
      <Section id="payments" aria-labelledby="escrow-heading">
        <SectionHead
          eyebrow="Secure payments"
          id="escrow-heading"
          title="Money that moves when the work is done"
          lede="Neither side has to go first. The money is secured up front and released on confirmation."
          align="center"
        />

        <div className="mt-12">
          <EscrowDiagram commissionPercent={commissionPercent} exampleMinor={2_000_000} />
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
          <div>
            <h3 className="text-display-sm">What if something goes wrong?</h3>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              Don’t confirm. Open a dispute instead and the money stays held while a real person
              reviews the messages, photos and evidence from both sides. They can refund you fully,
              release fully, or split it.
            </p>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              And if a poster simply goes quiet, payment releases to the hustler automatically after
              72 hours — nobody’s earnings get held hostage.
            </p>
            <Button asChild variant="ghost" className="group mt-6 rounded-full px-5">
              <Link href="/safety">
                Trust &amp; safety
                <ArrowUpRight className="arrow-hover" aria-hidden="true" />
              </Link>
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
      </Section>

      {/* ═══ Hustler stories ════════════════════════════════════════════════ */}
      <Section aria-labelledby="stories-heading">
        <SectionHead
          eyebrow="Stories"
          id="stories-heading"
          title="People already hustling"
          lede="Short films from three of the people earning on Hustle Street across Lagos."
        />

        <RevealGroup as="ul" className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
        </RevealGroup>
      </Section>

      {/* ═══ The app ════════════════════════════════════════════════════════ */}
      <Section aria-labelledby="app-heading">
        <SectionHead
          eyebrow="Installs like an app"
          id="app-heading"
          title="Built for the phone in your hand"
          lede="Add it to your home screen — no app store, no 80MB download. It works on a weak connection and keeps your saved jobs available offline."
          align="center"
        />

        <RevealGroup className="mt-14 grid gap-12 lg:grid-cols-3 lg:gap-8">
          {[
            {
              src: APP_SHOTS.home,
              alt: 'Home screen showing jobs near you with prices and distances',
              title: 'Everything near you',
              body: 'Jobs ranked by distance, urgency and how well they match your skills.',
            },
            {
              src: APP_SHOTS.discover,
              alt: 'Discover screen with a map of nearby jobs and filter chips',
              title: 'Find it on the map',
              body: 'Filter by distance, budget and category. Approximate pins only — never an address.',
            },
            {
              src: APP_SHOTS.chat,
              alt: 'Chat screen showing a job conversation with payment secured and a confirm button',
              title: 'Chat, agree, get paid',
              body: 'Every conversation is tied to its job, its agreement and its payment.',
            },
          ].map((shot) => (
            <div key={shot.title} className="text-center">
              <div className="mx-auto max-w-[240px]">
                <PhoneMockup src={shot.src} alt={shot.alt} />
              </div>
              <h3 className="mt-8 font-display text-lg font-semibold">{shot.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
                {shot.body}
              </p>
            </div>
          ))}
        </RevealGroup>
      </Section>

      {/* ═══ FAQ ════════════════════════════════════════════════════════════ */}
      <Section id="faq" aria-labelledby="faq-heading">
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
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Still stuck?{' '}
            <Link href="/help" className="link-underline font-medium text-foreground">
              Talk to us
            </Link>
            .
          </p>
        </div>
      </Section>

      <ClosingCta>
        <Button asChild size="lg" className="group rounded-full px-7">
          <Link href="/post">
            Post a Job
            <ArrowRight className="arrow-hover" aria-hidden="true" />
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
