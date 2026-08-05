import type { Config } from 'tailwindcss'

/**
 * Hustle Street design tokens.
 *
 * The palette is deliberately not "SaaS blue". It is built around three ideas:
 *  - `street`  — hustle orange, the energy / primary action colour
 *  - `ink`     — near-black urban neutrals, the structural colour
 *  - `money`   — a confident green reserved for value, earnings and success
 *
 * All colours resolve through CSS custom properties (see `globals.css`) so the
 * whole system supports light/dark without duplicating class names.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1360px' },
    },
    extend: {
      screens: {
        xs: '380px',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
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
        },
        money: {
          DEFAULT: 'hsl(var(--money))',
          foreground: 'hsl(var(--money-foreground))',
          soft: 'hsl(var(--money-soft))',
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
      borderRadius: {
        xs: 'calc(var(--radius) - 6px)',
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 10px)',
        '3xl': 'calc(var(--radius) + 18px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        'display-xl': ['clamp(2.75rem, 7vw, 4.5rem)', { lineHeight: '0.98', letterSpacing: '-0.035em', fontWeight: '800' }],
        'display-lg': ['clamp(2.25rem, 5.5vw, 3.5rem)', { lineHeight: '1.02', letterSpacing: '-0.03em', fontWeight: '800' }],
        'display-md': ['clamp(1.75rem, 4vw, 2.5rem)', { lineHeight: '1.08', letterSpacing: '-0.025em', fontWeight: '750' }],
        'display-sm': ['clamp(1.375rem, 3vw, 1.75rem)', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 hsl(var(--shadow-color) / 0.05)',
        sm: '0 1px 3px 0 hsl(var(--shadow-color) / 0.08), 0 1px 2px -1px hsl(var(--shadow-color) / 0.06)',
        md: '0 4px 12px -2px hsl(var(--shadow-color) / 0.10), 0 2px 6px -2px hsl(var(--shadow-color) / 0.06)',
        lg: '0 12px 28px -8px hsl(var(--shadow-color) / 0.16), 0 4px 10px -4px hsl(var(--shadow-color) / 0.08)',
        pop: '0 20px 48px -16px hsl(var(--shadow-color) / 0.24)',
        'street': '0 8px 24px -8px hsl(var(--primary) / 0.45)',
      },
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
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '60%': { opacity: '1', transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        'pop-in': 'pop-in 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
