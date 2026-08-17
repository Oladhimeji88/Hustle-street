import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Reveal, RevealOnMount, RevealItem } from '@/components/motion/reveal'

/**
 * Shared furniture for the public marketing pages.
 *
 * These are what keep ten separate pages looking like one site. The redesign
 * changed what they are made of rather than what they are called, so every page
 * that already used them picks up the new system without being touched.
 *
 * ── The band replaces the container ─────────────────────────────────────────
 *
 * Previously a section was a centred 1360px column with 80–112px of vertical
 * padding, floating on the page with whitespace doing the separating. Now it is a
 * **band**: full-bleed, bounded top and bottom by the 1px hairline, with its
 * content held inside the ruled column that runs the whole height of the site.
 *
 * That is why the padding came down (56/80px from 80/112px). When a rule marks
 * where a section ends, the section no longer has to prove it with air. The old
 * spacing would now read as a gap rather than as rhythm.
 *
 * The ruled column itself lives on `<main>` in the public layout, so these only
 * supply the band and the gutter.
 */

/** Standard section: a band, with the shared gutter and vertical rhythm. */
export function Section({ children, className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section className={cn('band', className)} {...props}>
      <div className="gutter py-14 sm:py-20">
        <Reveal effect="up">{children}</Reveal>
      </div>
    </section>
  )
}

/**
 * A band with no padding of its own, for sections that manage their own interior
 * grid — a row of cells that must reach the ruled column's edges, for instance.
 */
export function Band({ children, className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section className={cn('band', className)} {...props}>
      {children}
    </section>
  )
}

/**
 * Eyebrow + heading + optional lede.
 *
 * The eyebrow is uppercase and set in the label face. That single choice carries
 * most of the register: it reads as a field label rather than as a marketing
 * kicker, which is what lets the heading beneath it be a plain sentence.
 */
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
    <div className={cn(centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl', className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 id={id} className={cn('text-h2', eyebrow && 'mt-4')}>
        {title}
      </h2>
      {lede ? (
        <p
          className={cn(
            'mt-5 max-w-2xl text-pretty text-body-lg text-muted-foreground',
            centered && 'mx-auto',
          )}
        >
          {lede}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The masthead every non-landing public page opens with.
 *
 * Carries the same ruled paper as the landing hero, so arriving on /safety from /
 * does not feel like arriving at a different product. The photograph below it is
 * a grid cell — square corners, hairline border — and wipes in with the clip-path
 * reveal rather than scaling up.
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
    <section className="band relative overflow-hidden">
      {/* Its own absolutely positioned layer rather than a class on the section:
          the mask that fades the grid out would otherwise clip the content
          painted on top of it. */}
      <div
        className="grid-lines pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem]"
        aria-hidden="true"
      />
      <div className="gutter py-14 sm:py-20">
        <RevealOnMount className="max-w-4xl">
          <RevealItem effect="fade" as="p" className="eyebrow">
            {eyebrow}
          </RevealItem>
          <RevealItem effect="up" className="mt-4">
            <h1 className="text-h1">{title}</h1>
          </RevealItem>
          {lede ? (
            <RevealItem
              as="p"
              className="mt-6 max-w-2xl text-pretty text-body-lg text-muted-foreground"
            >
              {lede}
            </RevealItem>
          ) : null}
          {children ? <RevealItem className="mt-8">{children}</RevealItem> : null}
        </RevealOnMount>

        {image ? (
          <Reveal effect="reveal" className="mt-12 sm:mt-16">
            {/* `priority` because this sits at the top of the page and is the
                largest contentful paint on every route that uses it. Left to
                lazy-load it would be fetched after the JS, which is exactly
                backwards for the one image the user is waiting on. */}
            <div className="relative aspect-[16/7] overflow-hidden border border-border bg-surface-muted">
              <Image
                src={image}
                alt={imageAlt ?? ''}
                fill
                priority
                sizes="(max-width: 1728px) 100vw, 1728px"
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
 *
 * The index is set in the label face at full contrast rather than as a faded
 * display numeral. A step number is data — a position in a sequence — and giving
 * it the label face rather than the display one says so.
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
      <span className="font-label text-eyebrow-sm tabular-nums text-primary-text">
        {String(index).padStart(2, '0')}
      </span>
      <h3 className="mt-3 font-display text-h6">{title}</h3>
      <div className="mt-2 text-body-sm leading-relaxed text-muted-foreground">{children}</div>
    </RevealItem>
  )
}

/**
 * Closing call to action. One ink band, repeated verbatim across pages.
 *
 * Full-bleed navy rather than a rounded panel inset from the page. It is the last
 * band before the footer, and letting it run to the edges is what makes it read
 * as the page closing rather than as one more card on it.
 */
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
    <section className="panel-ink border-t border-border">
      <div className="gutter py-20 sm:py-28">
        <Reveal effect="up" className="mx-auto max-w-3xl text-center">
          <h2 className="text-h2 text-ink-foreground">{title}</h2>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-body-lg text-ink-foreground/60">
            {body}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">{children}</div>
        </Reveal>
      </div>
    </section>
  )
}
