import { Archivo, Figtree } from 'next/font/google'

/**
 * Typography.
 *
 * ── Body: Figtree ──────────────────────────────────────────────────────────
 * Geometric sans with a slightly rounded, friendly axis. Holds up at 12–14px on
 * the cheap Android screens that make up most of this market, and reads warmer
 * than a neutral grotesque — which suits a product about people helping people.
 *
 * ── Display: GRIFTER ───────────────────────────────────────────────────────
 * GRIFTER is a COMMERCIAL typeface. It is not on Google Fonts and cannot be
 * fetched at build time — it must be licensed and self-hosted.
 *
 * To activate it:
 *   1. Buy a webfont licence covering your expected traffic.
 *   2. Drop the files into `src/fonts/grifter/`:
 *        GRIFTERBold.woff2       (weight 700)
 *        GRIFTERBlack.woff2      (weight 900, optional)
 *   3. Swap the export at the bottom of this file from `displayFallback` to
 *      `grifter`.
 *
 * Until then the fallback below ships. It is deliberately chosen to sit in the
 * same territory — heavy, squarish, athletic — so swapping GRIFTER in later
 * shifts the texture without breaking any layout.
 *
 * Shipping an unlicensed commercial font is a real legal exposure, so this is
 * opt-in rather than something wired up on your behalf.
 */

export const body = Figtree({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

/**
 * Stand-in for GRIFTER until the licensed files are present.
 *
 * Archivo's heaviest cut: square-ish terminals, tight apertures and a compact
 * width, which is the closest free approximation of GRIFTER's blocky,
 * sign-painted feel.
 */
const displayFallback = Archivo({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  // 400/500 carry the headlines. Archivo only reads blocky in its heavy cuts —
  // at these weights it is a clean, faintly condensed grotesque, which is what
  // the quiet layout wants. 600/700 stay for the few places that need emphasis.
  weight: ['400', '500', '600', '700'],
})

/*
 * The real thing. Uncomment once `src/fonts/grifter/` contains the licensed
 * files — `next/font/local` throws at build time if a path is missing, which is
 * why this cannot simply be left in place with a runtime check. Restore the
 * import along with it:
 *
 * import localFont from 'next/font/local'
 *
 * const grifter = localFont({
 *   variable: '--font-display',
 *   display: 'swap',
 *   fallback: ['Archivo', 'system-ui', 'sans-serif'],
 *   src: [
 *     { path: '../fonts/grifter/GRIFTERBold.woff2',  weight: '700', style: 'normal' },
 *     { path: '../fonts/grifter/GRIFTERBlack.woff2', weight: '900', style: 'normal' },
 *   ],
 * })
 */

// Swap this to `grifter` after adding the licensed files.
export const display = displayFallback
