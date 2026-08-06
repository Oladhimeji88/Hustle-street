import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Reveal, RevealOnMount, RevealItem } from '@/components/motion/reveal'

/**
 * Shared furniture for the public marketing pages.
 *
 * These started as local helpers inside the landing page. Pulling them out is
 * what keeps six separate pages looking like one site: the vertical rhythm, the
 * eyebrow treatment and the heading scale are defined once here rather than
 * re-typed (and quietly drifting) on every new page.
 */

/** Standard section: shared horizontal container, shared vertical rhythm. */
export function Section({ children, className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section className={cn('container py-20 sm:py-28', className)} {...props}>
      <Reveal effect="up">{children}</Reveal>
    </section>
  )
}

/** Eyebrow + heading + optional lede, at the standard spacing. */
export function SectionHead({
  eyebrow,
  title,
  lede,
  id,
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: string
  lede?: string
  id?: string
  align?: 'left' | 'center'
  className?: string
}) {
  const centered = align === 'center'
  return (
    <div className={cn(centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 id={id} className={cn('text-display-md', eyebrow && 'mt-4')}>
        {title}
      </h2>
      {lede ? (
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">{lede}</p>
      ) : null}
    </div>
  )
}

/**
 * The masthead every non-landing public page opens with.
 *
 * Carries the same ruled-paper grid as the landing hero so arriving on
 * /safety from / does not feel like arriving at a different product.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  image,
  imageAlt,
  children,
}: {
  eyebrow: string
  title: string
  lede?: string
  /** Photograph beneath the masthead. Omit for pages that do not want one. */
  image?: string
  imageAlt?: string
  children?: React.ReactNode
}) {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div
        className="grid-lines pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem]"
        aria-hidden="true"
      />
      <div className="container py-16 sm:py-24">
        {/* Blur-in on the masthead: the heading resolves into focus rather than
            sliding, which is the one place on a page worth spending that on. */}
        <RevealOnMount className="max-w-3xl">
          <RevealItem effect="fade" as="p" className="eyebrow">
            {eyebrow}
          </RevealItem>
          <RevealItem effect="blur" duration={1} className="mt-4">
            <h1 className="text-display-lg">{title}</h1>
          </RevealItem>
          {lede ? (
            <RevealItem
              as="p"
              className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground"
            >
              {lede}
            </RevealItem>
          ) : null}
          {children ? <RevealItem className="mt-8">{children}</RevealItem> : null}
        </RevealOnMount>

        {image ? (
          <Reveal effect="scale" duration={1} className="mt-14 sm:mt-16">
            {/* `priority` because this sits at the top of the page and is the
                largest contentful paint on every route that uses it. Left to
                lazy-load it would be fetched after the JS, which is exactly
                backwards for the one image the user is waiting on. */}
            <div className="relative aspect-[16/7] overflow-hidden rounded-3xl bg-muted">
              <Image
                src={image}
                alt={imageAlt ?? ''}
                fill
                priority
                sizes="(max-width: 1360px) 100vw, 1360px"
                className="object-cover"
              />
            </div>
          </Reveal>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Numbered editorial step. Shared by /how-it-works and the landing page so the
 * two descriptions of the same process cannot drift apart visually.
 */
export function Step({
  index,
  title,
  children,
}: {
  index: number
  title: string
  children: React.ReactNode
}) {
  // RevealItem rather than a plain `li`: inside a RevealGroup this picks up the
  // stagger through Motion's context (which follows the React tree, so passing
  // through this non-motion component costs nothing). Outside one it has no
  // animating parent to trigger the variant, so it simply renders as-is.
  return (
    <RevealItem as="li" className="border-t border-border pt-5">
      <span className="font-display text-sm tabular-nums text-muted-foreground/60">
        {String(index).padStart(2, '0')}
      </span>
      <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </RevealItem>
  )
}

/** Closing call to action. One ink panel, repeated verbatim across pages. */
export function ClosingCta({
  title = 'Need it done? Ready to hustle?',
  body = 'One account does both. Posting is free, and you only pay when someone actually does the work.',
  children,
}: {
  title?: string
  body?: string
  children: React.ReactNode
}) {
  return (
    <section className="container pb-24 pt-4 sm:pb-32">
      <Reveal effect="scale" duration={1} className="panel-ink px-6 py-20 text-center sm:px-12 sm:py-28">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-display-lg text-white">{title}</h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-lg leading-relaxed text-white/60">
            {body}
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">{children}</div>
        </div>
      </Reveal>
    </section>
  )
}
