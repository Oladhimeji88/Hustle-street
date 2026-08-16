import Link from 'next/link'
import { ShieldCheck, Star, Zap } from 'lucide-react'
import { Logo } from '@/components/layout/logo'

/**
 * Auth layout.
 *
 * Split screen on desktop: the form on the left where the eye lands, a panel of
 * reasons to bother on the right. On mobile the panel disappears entirely —
 * someone on a phone signing up does not need to be re-sold.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      <div className="flex flex-1 flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to site
          </Link>
        </header>

        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{' '}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </footer>
      </div>

      {/*
       * The dark half. Two radial gradients used to bloom behind this copy; they
       * are gone, because a soft glow is the one thing this design language has no
       * vocabulary for. What replaces them is flat: the brand ramp as a vertical
       * band down the left edge, and a border-left hairline tying the panel to the
       * grid. Colour arrives as an object with edges, not as light.
       */}
      <aside
        className="relative hidden overflow-hidden border-l border-border-invert bg-ink text-ink-foreground lg:flex lg:flex-col lg:justify-center"
        aria-label="Why Hustle Street"
      >
        {/* The ramp. Five flat bands, full height, 12px wide. */}
        <div className="absolute inset-y-0 left-0 flex w-3 flex-col" aria-hidden="true">
          <div className="w-full flex-1 bg-sun" />
          <div className="w-full flex-1 bg-tangerine" />
          <div className="w-full flex-1 bg-primary" />
          <div className="w-full flex-1 bg-primary" />
          <div className="w-full flex-1 bg-money-block" />
        </div>

        <div className="relative max-w-md pl-20 pr-12">
          <p className="text-h3">
            Need it done?
            <br />
            Find someone nearby.
            <br />
            {/* Orange on the navy measures 4.98:1 — it can be type here, which it
                cannot be on paper. */}
            <span className="text-primary">Ready to hustle?</span>
            <br />
            Find your next job.
          </p>

          {/* Hairline rows rather than floating list items, matching the bands
              that structure every other page. */}
          <ul className="mt-12 divide-y divide-border-invert border-y border-border-invert">
            {[
              {
                icon: Zap,
                title: 'Post in two minutes',
                body: 'Say what you need. Nearby hustlers get notified straight away.',
              },
              {
                icon: ShieldCheck,
                title: 'Money held until it’s done',
                body: 'Payment is secured up front and released when you confirm.',
              },
              {
                icon: Star,
                title: 'Reviews you can trust',
                body: 'Only people who completed a job together can review each other.',
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <li key={item.title} className="flex gap-4 py-5">
                  <div className="flex size-9 shrink-0 items-center justify-center border border-border-invert">
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-display text-button-sm">{item.title}</p>
                    <p className="mt-1 text-body-sm leading-relaxed text-ink-foreground/60">
                      {item.body}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
    </div>
  )
}
