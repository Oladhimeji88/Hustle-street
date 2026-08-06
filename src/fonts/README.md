# Fonts

## Body — Figtree
Loaded from Google Fonts by `src/app/fonts.ts`. Nothing to do.

## Display — GRIFTER (not included)

GRIFTER is a **commercial typeface**. It is not on Google Fonts and is not
bundled here, because shipping an unlicensed commercial font is a genuine legal
exposure — not merely a technical gap.

### To activate it

1. **Buy a webfont licence** covering your expected monthly pageviews.
2. Place the files in this folder under `grifter/`:

   ```
   src/fonts/grifter/GRIFTERBold.woff2     ← weight 700, required
   src/fonts/grifter/GRIFTERBlack.woff2    ← weight 900, optional
   ```

3. In `src/app/fonts.ts`, uncomment the `grifter` block and change the last
   export from `displayFallback` to `grifter`.

`next/font/local` self-hosts the files, so they are served from your own domain
with no third-party request and no layout shift.

### Until then

**Archivo** (heaviest cuts) ships as the fallback. It sits in the same
territory — heavy, squarish, compact, sign-painted — so swapping GRIFTER in
later changes the texture without breaking any layout.
