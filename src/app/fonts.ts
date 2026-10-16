import { Figtree, Inter, Inter_Tight } from 'next/font/google'

/**
 * Typography — three faces, three jobs.
 *
 * A tight neo-grotesque for every piece of chrome (headings, nav, buttons), a
 * neutral workhorse for body copy, and a third face reserved for labels and
 * numerals. The separation is the point: the display face never sets a
 * paragraph, and the body face never sets a heading, so the two never blur into
 * one texture.
 *
 * ── Display: Inter Tight ───────────────────────────────────────────────────
 * Mistral sets its chrome in ALTMistral, a commissioned face that is not
 * licensable. Inter Tight is the honest substitute rather than an approximation
 * of convenience: it is a true neo-grotesque with the same narrowed advance
 * widths, and it holds the -0.02em tracking at 500 weight that gives Mistral's
 * headings their density. Crucially it is a *sibling* of the body face below,
 * so the pairing stays in the same skeleton instead of reading as two brands.
 *
 * Everything here is set at 500. The type scale has no 700 or 800 anywhere —
 * weight is not how it makes a heading loud; size and tracking are. Shipping the
 * 400/500/600 cuts only is deliberate, not an oversight.
 *
 * ── Body: Inter ────────────────────────────────────────────────────────────
 * The face Mistral actually sets its body copy in. Nothing to substitute.
 *
 * ── Label: Figtree ─────────────────────────────────────────────────────────
 * The eyebrow / metadata / numeral face, exposed as `--font-label` and reached
 * through Tailwind's `font-label`.
 *
 * This slot held Space Mono, which was Mistral's own choice and gave labels a
 * deliberately mechanical voice. Figtree is a geometric sans instead, so the
 * register it carries is different — warmer and rounder rather than technical,
 * which suits a marketplace about people more than a research lab. Two knock-on
 * adjustments were required and are worth knowing about:
 *
 *  - **Tracking went up.** Space Mono is naturally wide, so uppercase labels at
 *    11px needed almost none. Figtree sets at a normal width, so the eyebrow
 *    tracking in `globals.css` moved from 0.08em to 0.12em to stay legible at
 *    that size.
 *  - **Money dropped from 700 to 600.** The old weight was justified by Space
 *    Mono shipping only 400/700; Figtree has the full range, so amounts now use
 *    the 600 that the rest of the system caps at.
 *
 * Note this is no longer a monospace. Nothing in the app renders code, so no
 * character-cell alignment is lost — but `tabular-nums` is now doing the work
 * that fixed advance widths used to, keeping columns of prices from wobbling.
 */

/** Body copy. Mistral's own body face. */
export const body = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600'],
})

/**
 * Headings, nav, buttons — all chrome.
 *
 * 400 exists for the rare large-but-quiet line; 500 is the default every step of
 * the scale resolves to; 600 is the ceiling, used only where a label has to
 * separate from an adjacent one at the same size.
 */
export const display = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600'],
})

/** Eyebrows, metadata, numerals. */
export const label = Figtree({
  subsets: ['latin'],
  variable: '--font-label',
  display: 'swap',
  weight: ['400', '500', '600'],
})
