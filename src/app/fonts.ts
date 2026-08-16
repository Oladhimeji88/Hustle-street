import { Inter, Inter_Tight, Space_Mono } from 'next/font/google'

/**
 * Typography — three faces, three jobs.
 *
 * This mirrors the type system Mistral ships: a tight neo-grotesque for every
 * piece of chrome (headings, nav, buttons), a neutral workhorse for body copy,
 * and a monospace reserved for labels and numerals. The separation is the point:
 * the display face never sets a paragraph, and the body face never sets a
 * heading, so the two never blur into one texture.
 *
 * ── Display: Inter Tight ───────────────────────────────────────────────────
 * Mistral sets its chrome in ALTMistral, a commissioned face that is not
 * licensable. Inter Tight is the honest substitute rather than an approximation
 * of convenience: it is a true neo-grotesque with the same narrowed advance
 * widths, and it holds the -0.02em tracking at 500 weight that gives Mistral's
 * headings their density. Crucially it is a *sibling* of the body face below,
 * so the pairing stays in the same skeleton instead of reading as two brands.
 *
 * Everything here is set at 500. Mistral has no 700 or 800 anywhere in its type
 * scale — weight is not how it makes a heading loud; size and tracking are.
 * Shipping the 400/500/600 cuts only is deliberate, not an oversight.
 *
 * ── Body: Inter ────────────────────────────────────────────────────────────
 * The face Mistral actually sets its body copy in. Nothing to substitute.
 *
 * ── Mono: Space Mono ───────────────────────────────────────────────────────
 * Also Mistral's own choice. Used for eyebrows, metadata and tabular numerals —
 * the places where a slightly mechanical voice signals "this is data, not prose".
 * Grotesque-flavoured rather than typewriter, so it sits beside Inter without
 * the jarring shift a Courier-lineage mono would introduce.
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
export const mono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '700'],
})
