import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Logo } from './logo'

const NAV_LINKS = [
  { href: '/explore', label: 'Find work' },
  { href: '/hustlers', label: 'Find hustlers' },
  { href: '/categories', label: 'Categories' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/safety', label: 'Safety' },
]

/** Marketing header. The app itself uses `AppShell` and the bottom nav instead. */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/home">Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <SheetBody>
                <nav aria-label="Mobile" className="flex flex-col gap-1 pt-2">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-xl px-3 py-3.5 text-base font-medium transition-colors hover:bg-secondary"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="my-2 h-px bg-border" />
                  <Link
                    href="/faq"
                    className="rounded-xl px-3 py-3.5 text-base font-medium transition-colors hover:bg-secondary"
                  >
                    FAQ
                  </Link>
                  <Link
                    href="/about"
                    className="rounded-xl px-3 py-3.5 text-base font-medium transition-colors hover:bg-secondary"
                  >
                    About
                  </Link>
                </nav>
              </SheetBody>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
