import type { Metadata } from 'next'
import Link from 'next/link'
import { WifiOff } from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
}

/**
 * Offline fallback.
 *
 * Precached by the service worker, so it renders with no network. Deliberately
 * useful rather than apologetic: it says what still works and links to the
 * cached surfaces, instead of just announcing failure.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo size="lg" />

      <div
        className="mt-10 flex size-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
        aria-hidden="true"
      >
        <WifiOff className="size-8" />
      </div>

      <h1 className="mt-5 text-h4">
        You&rsquo;re offline
      </h1>

      <p className="mt-2 max-w-sm text-pretty leading-relaxed text-muted-foreground">
        No connection right now. Jobs you&rsquo;ve already opened and your saved list still work, and
        anything you write will send as soon as you&rsquo;re back on.
      </p>

      <div className="mt-7 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/home">Try again</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/saved">Saved jobs</Link>
        </Button>
      </div>

      <p className="mt-10 max-w-sm text-xs leading-relaxed text-muted-foreground">
        For your safety, payments and withdrawals are never available offline — balances always come
        straight from the server.
      </p>
    </div>
  )
}
