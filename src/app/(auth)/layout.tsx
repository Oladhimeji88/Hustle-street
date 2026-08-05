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

      <aside
        className="relative hidden overflow-hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-center"
        aria-label="Why Hustle Street"
      >
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(38rem 26rem at 78% 14%, hsl(var(--primary) / 0.30), transparent 60%), radial-gradient(30rem 20rem at 12% 88%, hsl(var(--money) / 0.20), transparent 60%)',
          }}
        />

        <div className="relative max-w-md">
          <p className="font-display text-4xl font-extrabold leading-tight tracking-tight">
            Need it done?
            <br />
            Find someone nearby.
            <br />
            <span className="text-primary">Ready to hustle?</span>
            <br />
            Find your next job.
          </p>

          <ul className="mt-10 space-y-5">
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
                <li key={item.title} className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/10">
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-display font-bold">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-background/70">{item.body}</p>
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
