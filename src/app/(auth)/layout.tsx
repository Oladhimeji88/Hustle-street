import Link from 'next/link'
import Image from 'next/image'
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
       * The dark half, now a single full-bleed photograph rather than a headline
       * and three feature rows.
       *
       * Losing the copy loses the argument it was making, and that is the point:
       * the three claims it made — posting takes two minutes, money is held until
       * the job is done, reviews are earned — are the same three the rest of the
       * site makes at length. Repeating them beside a login form was re-selling
       * someone who has already decided. A photograph of the work does the one
       * job left worth doing here, which is to say what this is.
       *
       * The brand ramp stays. It is the element that ties the panel to the grid
       * on every other page, and it now doubles as the edge that stops the image
       * bleeding into the form column.
       */}
      <aside
        className="relative hidden overflow-hidden border-l border-border-invert bg-ink lg:block"
        aria-label="Hustle Street"
      >
        <Image
          src="/media/scene-hustlers.jpg"
          alt=""
          fill
          sizes="50vw"
          priority
          className="object-cover"
        />

        {/*
         * A flat scrim, not a gradient. The image is uncontrolled — it can be
         * swapped for a lighter one — and the ramp is a set of saturated bands
         * that need a consistent ground to read against. A wash at a fixed
         * opacity keeps that stable; a gradient would leave the top band on bare
         * photograph.
         */}
        <div className="absolute inset-0 bg-ink/25" aria-hidden="true" />

        {/* The ramp. Five flat bands, full height, 12px wide. */}
        <div className="absolute inset-y-0 left-0 flex w-3 flex-col" aria-hidden="true">
          <div className="w-full flex-1 bg-sun" />
          <div className="w-full flex-1 bg-tangerine" />
          <div className="w-full flex-1 bg-primary" />
          <div className="w-full flex-1 bg-primary" />
          <div className="w-full flex-1 bg-money-block" />
        </div>
      </aside>
    </div>
  )
}
