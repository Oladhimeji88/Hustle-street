import type { Config } from 'tailwindcss'

/**
 * Hustle Street design tokens.
 *
 * The system follows Mistral's: a warm paper canvas, a 1px hairline grid doing
 * all the structural work, near-square geometry, and brand colour arriving as a
 * flat plane rather than a tint. See the header comment in `globals.css` for the
 * four principles and the colour roles.
 *
 * Everything resolves through CSS custom properties, so light/dark needs no
 * duplicated class names.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    /* Kept for the app screens, which are a contained product UI rather than a
       ruled marketing page. Marketing routes use `.ruled` + `.gutter` from
       globals.css instead, which run to 1728px and carry the vertical rules. */
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2.5rem' },
      screens: { '2xl': '1360px' },
    },
    extend: {
      screens: {
        xs: '380px',
        /* The width at which the ruled column stops growing and the page starts
           adding margin instead. Sections that bleed to the viewport edge use
           this to pull back in. */
        ruled: '1728px',
      },
      colors: {
        border: {
          DEFAULT: 'hsl(var(--border))',
          strong: 'hsl(var(--border-strong))',
          invert: 'hsl(var(--border-invert))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          foreground: 'hsl(var(--ink-foreground))',
        },
        foreground: 'hsl(var(--foreground))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          muted: 'hsl(var(--surface-muted))',
          raised: 'hsl(var(--surface-raised))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          soft: 'hsl(var(--primary-soft))',
          /* The readable cut of the orange. Use for orange type and links on a
             light ground — `primary` itself is a plane, not a text colour. */
          text: 'hsl(var(--primary-text))',
          /* The same job on a dark ground: scrims, ink panels, photo overlays.
             10.66:1 on ink, and fixed across both themes. */
          invert: 'hsl(var(--primary-invert))',
        },
        /* Secondary brand planes, for block sequences that need more than one
           colour. Flat fills only — none of these are text colours. */
        tangerine: 'hsl(var(--tangerine))',
        sun: 'hsl(var(--sun))',
        sky: 'hsl(var(--sky))',
        azure: 'hsl(var(--azure))',
        money: {
          DEFAULT: 'hsl(var(--money))',
          foreground: 'hsl(var(--money-foreground))',
          soft: 'hsl(var(--money-soft))',
          /* Saturated cut, for fills. `money` itself is dark enough to set type. */
          block: 'hsl(var(--money-block))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          soft: 'hsl(var(--destructive-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          soft: 'hsl(var(--warning-soft))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      /* --radius is 8px. Panels get `lg` (8), controls get `md` (6), and cells in
         the grid get none at all. The whole scale tops out at 24px, where the old
         one started — tight corners are what let the hairlines actually meet. */
      borderRadius: {
        xs: 'calc(var(--radius) - 6px)', /*  2px */
        sm: 'calc(var(--radius) - 4px)', /*  4px */
        md: 'calc(var(--radius) - 2px)', /*  6px */
        lg: 'var(--radius)', /*  8px */
        xl: 'calc(var(--radius) + 4px)', /* 12px */
        '2xl': 'calc(var(--radius) + 8px)', /* 16px */
        '3xl': 'calc(var(--radius) + 16px)', /* 24px */
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        label: ['var(--font-label)'],
      },
      /**
       * The type scale, lifted from Mistral's own tokens.
       *
       * Two things make it what it is. First, every step is weight 500 — there is
       * no 700 or 800 anywhere. A heading gets loud through size and tight
       * tracking, not through weight. Second, tracking flips sign by role:
       * display and body copy pull in (negative), while buttons and labels push
       * out (positive). That is what keeps a 96px headline dense and a 14px
       * button label legible.
       *
       * Sizes clamp between Mistral's own mobile and desktop endpoints rather
       * than duplicating the scale in a media query.
       */
      fontSize: {
        /* Hero only. 40px on a phone, 96px on a desktop. */
        display: [
          'clamp(2.5rem, 7vw, 6rem)',
          { lineHeight: '1.02', letterSpacing: '-0.02em', fontWeight: '500' },
        ],
        h1: [
          'clamp(2.5rem, 6vw, 4.5rem)',
          { lineHeight: '1.04', letterSpacing: '-0.02em', fontWeight: '500' },
        ],
        h2: [
          'clamp(1.75rem, 4.5vw, 3.5rem)',
          { lineHeight: '1.08', letterSpacing: '-0.01em', fontWeight: '500' },
        ],
        h3: [
          'clamp(1.5rem, 3.5vw, 2.75rem)',
          { lineHeight: '1.18', letterSpacing: '-0.01em', fontWeight: '500' },
        ],
        h4: [
          'clamp(1.25rem, 2.5vw, 2rem)',
          { lineHeight: '1.25', letterSpacing: '0em', fontWeight: '500' },
        ],
        h5: [
          'clamp(1.125rem, 1.8vw, 1.5rem)',
          { lineHeight: '1.33', letterSpacing: '0em', fontWeight: '500' },
        ],
        h6: ['1rem', { lineHeight: '1.5', letterSpacing: '0em', fontWeight: '500' }],

        /* Body. The negative tracking is what makes Inter look set rather than
           defaulted; `body` in globals.css carries -0.01em as the baseline. */
        'body-lg': ['1.25rem', { lineHeight: '1.6', letterSpacing: '-0.02em', fontWeight: '400' }],
        'body-base': ['1rem', { lineHeight: '1.5', letterSpacing: '-0.01em', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.54', letterSpacing: '0em', fontWeight: '400' }],

        /* Buttons push tracking out. Small labels need it most, so they get more. */
        'button-lg': ['1rem', { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '500' }],
        'button-sm': ['0.875rem', { lineHeight: '1.43', letterSpacing: '0.02em', fontWeight: '500' }],

        /* Mono labels. */
        eyebrow: ['0.8125rem', { lineHeight: '1.54', letterSpacing: '0em', fontWeight: '400' }],
        'eyebrow-sm': ['0.6875rem', { lineHeight: '1.45', letterSpacing: '0em', fontWeight: '400' }],
      },
      /**
       * Elevation is nearly gone. In a system where surfaces are told apart by
       * fill and hairline, a shadow is only correct for something that genuinely
       * floats above the page — a dropdown, a dialog, a toast.
       *
       * `nav` is Mistral's own: four stacked shadows at 2% opacity, which reads
       * as a hairline of depth rather than as a drop shadow.
       */
      boxShadow: {
        none: 'none',
        nav: [
          '0 4px 8px 0 hsl(var(--shadow-color) / 0.02)',
          '0 2px 4px 0 hsl(var(--shadow-color) / 0.02)',
          '0 1px 2px 0 hsl(var(--shadow-color) / 0.02)',
          '0 0 1px 0 hsl(var(--shadow-color) / 0.02)',
        ].join(', '),
        /* For genuinely floating layers only. */
        pop: '0 16px 40px -20px hsl(var(--shadow-color) / 0.14), 0 2px 8px -4px hsl(var(--shadow-color) / 0.06)',
        /* Legacy names, all resolved down to the nav whisper so existing
           `shadow-sm`/`shadow-md` call sites stop adding depth this system
           doesn't have. */
        xs: '0 1px 2px 0 hsl(var(--shadow-color) / 0.02)',
        sm: '0 1px 2px 0 hsl(var(--shadow-color) / 0.02)',
        md: '0 4px 8px 0 hsl(var(--shadow-color) / 0.02), 0 1px 2px 0 hsl(var(--shadow-color) / 0.02)',
        lg: '0 16px 40px -20px hsl(var(--shadow-color) / 0.14)',
        street: '0 0 0 1px hsl(var(--primary) / 0.28)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        reveal: 'cubic-bezier(0.51, -0.01, 0.49, 1)',
      },
      /**
       * Motion vocabulary.
       *
       * The distinctive one is `fall`: a block drops in from above and settles
       * with a squash — scaleY 1 → 0.95 → 1.02 → 1. That overshoot is what makes
       * the grid feel like it has physical weight rather than like it faded in.
       * Staggered at 60ms across a sequence it is the single most recognisable
       * piece of motion on Mistral's site.
       *
       * `dot-pulse` expands a square ring rather than a circular one, matching
       * the corner-mark language. `reveal` wipes with a clip-path instead of
       * translating, which is how the editorial blocks arrive.
       */
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },

        /* The signature. Drop from above, land, squash, settle. */
        fall: {
          '0%': { opacity: '0', transform: 'translateY(-200px)' },
          '50%': { opacity: '1', transform: 'translateY(0) scaleY(1)' },
          '65%': { opacity: '1', transform: 'translateY(0) scaleY(0.95)' },
          '80%': { opacity: '1', transform: 'translateY(0) scaleY(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scaleY(1)' },
        },
        /* A 4px lift, for text arriving inside a cell that has already landed. */
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /* Directional entrances for the brand planes. 60px, matching Mistral. */
        'from-left': {
          from: { opacity: '0', transform: 'translateX(-60px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'from-right': {
          from: { opacity: '0', transform: 'translateX(60px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'from-top': {
          from: { opacity: '0', transform: 'translateY(-60px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0)' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
        /* Clip-path wipe. Reveals left-to-right while rising 20px. */
        reveal: {
          '0%': { clipPath: 'polygon(0 0, 0 0, 0 0, 0 0)', transform: 'translateY(20px)' },
          '100%': {
            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
            transform: 'translateY(0)',
          },
        },
        /* An unrolling panel, for accordions and disclosures. */
        unroll: {
          '0%': { opacity: '0', maxHeight: '0' },
          '30%': { opacity: '1' },
          '100%': { opacity: '1', maxHeight: '100%' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        /* Square ring, expanding and fading. */
        'dot-pulse': {
          '0%': { opacity: '1', borderWidth: '0' },
          '50%, 100%': { opacity: '0', borderWidth: '0.75rem' },
        },
        /* A run of these staggered reads as movement along a track. */
        'dot-lane': {
          '0%': { opacity: '0.1' },
          '30%': { opacity: '1' },
          '60%, 100%': { opacity: '0.1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.5s linear',
        fall: 'fall 0.5s ease-in both',
        'slide-up': 'slide-up 0.2s ease-in-out both',
        'from-left': 'from-left 0.7s ease-out both',
        'from-right': 'from-right 0.7s ease-out both',
        'from-top': 'from-top 0.7s ease-out both',
        'pop-in': 'pop-in 0.3s ease-in-out both',
        reveal: 'reveal 1s cubic-bezier(0.51, -0.01, 0.49, 1) both',
        unroll: 'unroll 0.5s ease-in-out both',
        shimmer: 'shimmer 1.6s infinite',
        'dot-pulse': 'dot-pulse 2s linear infinite',
        'dot-lane': 'dot-lane 1.6s linear infinite',
        blink: 'blink 2s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
