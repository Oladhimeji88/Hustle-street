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
import { VideoPlayer } from '@/components/media/video-player'
import { MediaFrame, PhoneMockup, StoryCard } from '@/components/media/media-frame'
import { APP_SHOTS, HERO_VIDEO, HUSTLER_STORIES, SCENES } from '@/lib/config/media'
import { formatMoney } from '@/lib/money'
import { Band, ClosingCta, Section, SectionHead, Step } from '@/components/marketing/page-primitives'
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

const AREAS = [
  'Lekki', 'Victoria Island', 'Ikoyi', 'Ajah', 'Ikeja', 'Yaba',
  'Surulere', 'Gbagada', 'Magodo', 'Festac', 'Ikorodu', 'Agege',
]

/**
 * The block sequence under the hero.
 *
 * This is the page's one moment of pure brand, and the most direct borrowing from
 * Mistral's design language: a row of flat, saturated planes at irregular widths
 * that drop in from above and settle with a squash, 60ms apart.
 *
 * Everything about it is deliberate. The planes carry no gradient, no shadow and
 * no radius — colour arrives as a solid object. Widths are irregular (`flex`
 * ratios rather than equal columns) so the row reads as composed rather than as a
 * chart. Two of the five are paper rather than colour, which is what stops the
 * band from becoming a stripe. And each one has a corner mark, the 4px ink square
 * that makes a plain rectangle read as a plate on a technical drawing.
 *
 * `grow` is the flex ratio; `tone` is the fill.
 */
const BLOCKS = [
  { tone: 'bg-sun', grow: 'lg:flex-[2]', label: 'Repairs', count: '2.4k' },
  { tone: 'bg-surface-raised', grow: 'lg:flex-[1]', label: 'Cleaning', count: '1.8k' },
  { tone: 'bg-tangerine', grow: 'lg:flex-[3]', label: 'Moving', count: '960' },
  { tone: 'bg-primary', grow: 'lg:flex-[2]', label: 'Design', count: '1.2k' },
  { tone: 'bg-surface-muted', grow: 'lg:flex-[1]', label: 'Errands', count: '3.1k' },
]

/** Divided figures. Tabular numerals, one cell each, vertical rules between them. */
const FIGURES = [
  { value: '12k+', label: 'Jobs completed' },
  { value: '4.8', label: 'Average rating' },
  { value: '18min', label: 'Median first reply' },
  { value: '24', label: 'Areas covered' },
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
          Ruled paper, a headline at the top of the type scale, and a search
          field. Left-aligned rather than centred: the ruled column has a left
          edge, and type that ignores it wastes the strongest line on the page. */}
      <section className="band relative overflow-hidden">
        {/* Its own absolutely positioned layer rather than a class on the
            section: the mask that fades the grid out would otherwise clip the
            content painted on top of it. The 56px cell matches the header's
            height, so the graph paper lines up with the chrome above it. */}
        <div
          className="grid-lines pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem]"
          aria-hidden="true"
        />

        <div className="gutter pb-14 pt-12 sm:pb-20 sm:pt-16">
          {/* Above the fold, so this plays on mount rather than on scroll. */}
          <RevealOnMount className="max-w-4xl" stagger={0.08}>
            <RevealItem effect="fade" as="p" className="eyebrow">
              Live in Lagos · Island and mainland
            </RevealItem>

            <RevealItem effect="up" className="mt-5">
              <h1 className="text-display">
                Get things done.
                <br />
                Find people who can.
              </h1>
            </RevealItem>

            <RevealItem
              as="p"
              className="mt-6 max-w-xl text-pretty text-body-lg text-muted-foreground"
            >
              Hustle Street connects you with skilled people nearby who are ready to get the job
              done, from moving a sofa to designing a flyer.
            </RevealItem>

            {/* Search stays the primary affordance. Squared off and hairlined so
                it reads as a cell in the grid rather than as a pill dropped on
                top of it — and the submit button squares into its right edge
                instead of floating inside with a margin. */}
            <RevealItem className="mt-9 max-w-xl">
              <form action="/explore" method="get">
                <label htmlFor="hero-search" className="sr-only">
                  Search for a job, service or skill
                </label>
                <div className="flex border border-border bg-surface focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ring">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      id="hero-search"
                      name="q"
                      type="search"
                      placeholder="Plumber, cleaner, designer…"
                      className="h-14 w-full bg-transparent pl-12 pr-3 text-body-base placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <Button type="submit" size="cell" variant="primary" className="shrink-0">
                    Search
                  </Button>
                </div>
              </form>
            </RevealItem>

            <RevealItem className="mt-4 flex flex-col gap-3 sm:flex-row">
              {/* The one brand-orange action on the page. Everything else is
                  ink — which is exactly what makes this one register. */}
              <Button asChild size="lg" variant="brand" className="group">
                <Link href="/post">
                  Post a job
                  <ArrowRight className="arrow-hover" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="group">
                <Link href="/signup?intent=hustle">
                  Start hustling
                  <ArrowUpRight className="icon-hover" aria-hidden="true" />
                </Link>
              </Button>
            </RevealItem>
          </RevealOnMount>
        </div>

        {/* The block sequence. Full-bleed to the ruled column's edges — the row
            is part of the grid, not content sitting inside a padded section. */}
        <RevealGroup
          effect="fall"
          stagger={0.06}
          className="flex h-32 border-t border-border sm:h-40 lg:h-48"
        >
          {BLOCKS.map((block) => (
            <div
              key={block.label}
              className={`tech-dot tech-dot-tl relative flex flex-1 flex-col justify-end overflow-hidden p-3 outline outline-1 -outline-offset-1 outline-border sm:p-4 ${block.tone} ${block.grow}`}
            >
              <span className="font-label text-eyebrow-sm uppercase tracking-[0.12em] text-ink/70">
                {block.count}
              </span>
              <span className="font-display text-button-sm text-ink">{block.label}</span>
            </div>
          ))}
        </RevealGroup>
      </section>

      {/* ═══ Figures ════════════════════════════════════════════════════════
          A row of cells divided by vertical rules. Tabular numerals, because these
          are readings rather than headlines. */}
      <Band>
        <RevealGroup className="grid grid-cols-2 divide-x divide-y divide-border lg:grid-cols-4 lg:divide-y-0">
          {FIGURES.map((figure) => (
            <div key={figure.label} className="px-4 py-7 sm:px-6 lg:px-10">
              <p className="font-label text-h4 tabular-nums">{figure.value}</p>
              <p className="mt-1.5 text-body-sm text-muted-foreground">{figure.label}</p>
            </div>
          ))}
        </RevealGroup>
      </Band>

      {/* ═══ What this is ═══════════════════════════════════════════════════
          Heading left, answer right — the split that lets a plain statement of
          the product sit on its own without decoration. */}
      <Section aria-labelledby="what-heading">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="eyebrow">What this is</p>
            <h2 id="what-heading" className="mt-4 text-h2">
              A marketplace for
              <br />
              getting things done
            </h2>
            <Button asChild variant="outline" size="md" className="group mt-8">
              <Link href="/how-it-works">
                How it works
                <ArrowRight className="arrow-hover" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="lg:pt-2">
            <p className="text-pretty text-h5 text-foreground">
              Post what you need, compare the people who reply, and pay only when the work is
              finished. Everyone you see is actually near you.
            </p>
            <p className="mt-6 text-pretty text-body-base leading-relaxed text-muted-foreground">
              Free to post. No subscription, no listing fees, no paying to apply. We take{' '}
              {commissionPercent}% when a job completes, and nothing at all if it doesn’t.
            </p>

            {/* Coverage as a plain list against a rule. A logo wall would be
                dishonest here — these are neighbourhoods, not customers. */}
            <div className="mt-10 border-t border-border pt-6">
              <p className="eyebrow">Where we run</p>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {AREAS.map((area) => (
                  <li key={area} className="text-body-sm text-muted-foreground">
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ Product shot ═══════════════════════════════════════════════════
          Two cells: the phone on paper, the live feed beside it. Divided by the
          same rule as everything else rather than overlapping — an overlap needs
          a shadow to be legible, and this system has none. */}
      <Band>
        <div className="grid lg:grid-cols-[1.4fr_1fr] lg:divide-x lg:divide-border">
          <div className="flex justify-center border-b border-border bg-surface-muted px-6 pt-12 lg:border-b-0 lg:pt-16">
            <div className="w-full max-w-[280px] sm:max-w-[320px]">
              <PhoneMockup
                src={APP_SHOTS.home}
                alt="The Hustle Street home screen showing jobs near you in Lekki Phase 1"
                priority
              />
            </div>
          </div>

          <div className="flex flex-col justify-center px-4 py-10 sm:px-6 lg:px-10">
            <p className="eyebrow">Live right now</p>
            <h2 className="mt-4 text-h3">Jobs near you, as they land</h2>
            <p className="mt-4 text-pretty text-body-base leading-relaxed text-muted-foreground">
              Ranked by distance, urgency and how well they match what you do.
            </p>
            <div className="mt-8 border border-border bg-surface p-4">
              <NearbyJobsPreview />
            </div>
          </div>
        </div>
      </Band>

      {/* ═══ Categories ═════════════════════════════════════════════════════ */}
      <Section aria-labelledby="categories-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead
            eyebrow="Categories"
            id="categories-heading"
            title="Whatever it is, someone nearby does it"
            lede="Fifteen categories, from a leaking tap to a brand identity."
          />
          <Button asChild variant="bare" size="sm" className="group">
            <Link href="/categories">
              See all
              <ArrowRight className="arrow-hover" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {/* A moving rail rather than a static grid. Fifteen categories in a
            5-across grid was a wall of equal-weight tiles you had to read; in
            motion they arrive one at a time and the section stops asking for a
            decision up front. */}
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
          lede="Someone needs something done. Someone nearby knows how to do it. We connect them, and hold the money until everyone’s happy."
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
      <Band>
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] lg:divide-x lg:divide-border">
          <div className="border-b border-border p-4 sm:p-6 lg:border-b-0 lg:p-10">
            <VideoPlayer
              sources={HERO_VIDEO.sources}
              poster={HERO_VIDEO.poster}
              title={HERO_VIDEO.title}
              description={HERO_VIDEO.description}
              duration={HERO_VIDEO.duration}
              transcript={HERO_VIDEO.transcript}
            />
          </div>

          <div className="flex flex-col justify-center px-4 py-10 sm:px-6 lg:px-10">
            <SectionHead
              eyebrow="Watch"
              id="watch-heading"
              title="One job, start to finish"
              lede="A sofa that needed moving in Lekki. Posted at 1:14pm, three applications by 1:23pm, done and paid for by six."
            />

            <ul className="mt-8 divide-y divide-border border-t border-border">
              {[
                { icon: Clock, label: 'Posted in under two minutes' },
                { icon: MapPin, label: '12 hustlers nearby notified instantly' },
                { icon: ShieldCheck, label: 'Payment released on confirmation' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.label} className="flex items-center gap-3 py-3.5">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="text-body-sm">{item.label}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </Band>

      {/* ═══ For posters ════════════════════════════════════════════════════ */}
      <Band aria-labelledby="posters-heading">
        <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-border">
          <div className="border-b border-border lg:border-b-0">
            <MediaFrame
              src={SCENES.post}
              alt="A job being posted and picked up by hustlers nearby"
              aspect="wide"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-10">
            <SectionHead
              eyebrow="If you need something done"
              id="posters-heading"
              title="Stop asking around"
              lede="No more calling three people who know a guy. Describe the job once, and the people who actually do it, and who are actually near you, come to you."
            />

            <ul className="mt-8 divide-y divide-border border-y border-border">
              {[
                'Free to post, no listing fees, no subscription',
                'Compare ratings, completed jobs and prices side by side',
                'Message before you commit to anyone',
                'Your money is held until you confirm the work is done',
              ].map((point) => (
                <li key={point} className="flex gap-3 py-3.5">
                  <BadgeCheck
                    className="mt-0.5 size-4 shrink-0 text-money"
                    aria-hidden="true"
                  />
                  <span className="text-body-sm leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>

            <Button asChild size="lg" variant="primary" className="group mt-8 self-start">
              <Link href="/post">
                Post a job
                <ArrowRight className="arrow-hover" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Band>

      {/* ═══ For hustlers ═══════════════════════════════════════════════════ */}
      <Band aria-labelledby="hustlers-heading">
        <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-border">
          <div className="border-b border-border lg:order-2 lg:border-b-0">
            <MediaFrame
              src={SCENES.hustlers}
              alt="Skilled workers available for jobs in nearby areas"
              aspect="wide"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:order-1 lg:px-10">
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
                    <p className="mt-3 font-display text-button-sm">{item.title}</p>
                    <p className="mt-1.5 text-body-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                )
              })}
            </RevealGroup>

            <Button asChild size="lg" variant="primary" className="group mt-9 self-start">
              <Link href="/signup?intent=hustle">
                Become a hustler
                <ArrowRight className="arrow-hover" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Band>

      {/* ═══ Hustler stories ════════════════════════════════════════════════ */}
      <Section aria-labelledby="stories-heading">
        <SectionHead
          eyebrow="Stories"
          id="stories-heading"
          title="People already hustling"
          lede="Short films from three of the people earning on Hustle Street across Lagos."
        />

        <RevealGroup as="ul" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* ═══ The app ════════════════════════════════════════════════════════
          Three cells, divided. The phones sit on the muted fill so they read as
          plates on a sheet rather than as images floating on the page. */}
      <Band aria-labelledby="app-heading">
        <div className="gutter py-14 sm:py-20">
          <SectionHead
            eyebrow="Installs like an app"
            id="app-heading"
            title="Built for the phone in your hand"
            lede="Add it to your home screen. No app store, no 80MB download. It works on a weak connection and keeps your saved jobs available offline."
          />
        </div>

        <RevealGroup className="grid border-t border-border md:grid-cols-3 md:divide-x md:divide-border">
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
              body: 'Filter by distance, budget and category. Approximate pins only, never an address.',
            },
            {
              src: APP_SHOTS.chat,
              alt: 'Chat screen showing a job conversation with payment secured and a confirm button',
              title: 'Chat, agree, get paid',
              body: 'Every conversation is tied to its job, its agreement and its payment.',
            },
          ].map((shot, index) => (
            <div
              key={shot.title}
              className={`flex flex-col bg-surface-muted px-6 pt-10 ${
                index < 2 ? 'border-b border-border md:border-b-0' : ''
              }`}
            >
              <div className="mx-auto w-full max-w-[240px]">
                <PhoneMockup src={shot.src} alt={shot.alt} />
              </div>
              <div className="mt-10 border-t border-border pb-8 pt-5">
                <h3 className="font-display text-h6">{shot.title}</h3>
                <p className="mt-2 text-pretty text-body-sm leading-relaxed text-muted-foreground">
                  {shot.body}
                </p>
              </div>
            </div>
          ))}
        </RevealGroup>
      </Band>

      {/* ═══ FAQ ════════════════════════════════════════════════════════════ */}
      <Band id="faq" aria-labelledby="faq-heading">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] lg:divide-x lg:divide-border">
          {/* Sticky heading beside a scrolling list — the pattern that lets a
              long accordion keep its context on a tall screen. */}
          <div className="border-b border-border px-4 py-12 sm:px-6 lg:border-b-0 lg:px-10">
            <div className="lg:sticky lg:top-[calc(var(--nav-height)+2.5rem)]">
              <p className="eyebrow">FAQ</p>
              <h2 id="faq-heading" className="mt-4 text-h3">
                Questions people actually ask
              </h2>
              <p className="mt-4 text-body-sm leading-relaxed text-muted-foreground">
                Still stuck?{' '}
                <Link href="/help" className="link-underline text-foreground">
                  Talk to us
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <FaqAccordion
              commissionPercent={commissionPercent}
              exampleFee={formatMoney(200_000, 'NGN')}
              exampleNet={formatMoney(200_000 - (200_000 * commissionPercent) / 100, 'NGN')}
            />
          </div>
        </div>
      </Band>

      <ClosingCta>
        <Button asChild size="lg" variant="brand" className="group">
          <Link href="/post">
            Post a job
            <ArrowRight className="arrow-hover" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="invert-outline">
          <Link href="/explore">Find work</Link>
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
