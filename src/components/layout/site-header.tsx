import Link from 'next/link'
import { ArrowUpRight, Menu } from 'lucide-react'
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

const SECONDARY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/help', label: 'Help' },
]

/**
 * Marketing header. The app itself uses `AppShell` and the bottom nav instead.
 *
 * This is the clearest statement of the whole design language, so it is worth
 * being explicit about what it is doing.
 *
 * The header is not a bar containing buttons — it is a **row of cells**, divided
 * by the same hairline that structures every other section. Each nav item is a
 * full-height cell with a vertical rule on one side, and hovering fills the cell
 * rather than drawing a pill inside it. The result is that the header reads as
 * the top row of the page's grid and lines up with the rules running down the
 * ruled column beneath it.
 *
 * Two details that follow from that:
 *
 * No backdrop blur. The previous version was translucent with `backdrop-blur-lg`,
 * which is the opposite instinct — it makes the header a pane of glass hovering
 * over the content. Here it is opaque paper, and the 1px bottom rule is the only
 * thing separating it from the page. A blur would also soften the vertical rules
 * as content scrolled behind them, which is the one thing that must stay crisp.
 *
 * No radius anywhere. Cells that round can't tile.
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      {/* The ruled column. `divide-x` is what makes the row a set of cells —
          one rule between each pair of children, none on the outer edges, which
          is exactly right since the column's own border-x closes those. */}
      <div className="ruled flex items-stretch justify-between divide-x divide-border">
        {/* Logo cell. Padded to the gutter so the wordmark starts on the same
            vertical as every heading below it. */}
        <div className="flex shrink-0 items-center px-4 sm:px-6 lg:px-10">
          <Logo />
        </div>

        {/* Primary nav. Each link is its own cell with a leading rule. */}
        <nav aria-label="Main" className="hidden items-stretch divide-x divide-border lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex h-14 items-center px-4 font-display text-button-sm text-foreground transition-colors hover:bg-surface-muted"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Everything after this is pushed right by the nav's `flex-1`-less
            layout: the wrapper below takes the remaining space. */}
        <div className="flex flex-1 items-stretch justify-end divide-x divide-border">
          {signedIn ? (
            <Button asChild size="cell" variant="primary" className="group">
              <Link href="/home">
                Open app
                <ArrowUpRight className="icon-hover" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <>
              {/* Log in is a plain cell, not a button. It is a destination, and
                  giving it a fill would put two competing actions side by side. */}
              <Link
                href="/login"
                className="hidden h-14 items-center px-5 font-display text-button-sm text-foreground transition-colors hover:bg-surface-muted sm:flex"
              >
                Log in
              </Link>
              <Button asChild size="cell" variant="primary" className="group">
                <Link href="/signup">
                  Get started
                  <ArrowUpRight className="icon-hover" aria-hidden="true" />
                </Link>
              </Button>
            </>
          )}

          {/* Menu trigger is a square cell, matching the header's height exactly
              so the grid never breaks at the right edge. */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="flex size-14 shrink-0 items-center justify-center text-foreground transition-colors hover:bg-surface-muted lg:hidden"
              >
                <Menu className="size-5" aria-hidden="true" />
              </button>
            </SheetTrigger>

            {/* Mobile nav: stacked full-width rows separated by the hairline.
                Same cell logic as the desktop row, rotated 90°. */}
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <SheetBody className="px-0">
                <nav aria-label="Mobile" className="flex flex-col border-t border-border">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group flex items-center justify-between border-b border-border px-4 py-4 font-display text-button-lg transition-colors hover:bg-surface-muted"
                    >
                      {link.label}
                      <ArrowUpRight
                        className="icon-hover size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}

                  {SECONDARY_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="border-b border-border px-4 py-3.5 text-body-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <div className="flex flex-col gap-2 p-4">
                  <Button asChild size="lg" variant="brand" block>
                    <Link href="/post">Post a job</Link>
                  </Button>
                  {!signedIn && (
                    <Button asChild size="lg" variant="outline" block>
                      <Link href="/login">Log in</Link>
                    </Button>
                  )}
                </div>
              </SheetBody>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
