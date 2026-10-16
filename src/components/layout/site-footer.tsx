import Link from 'next/link'
import { Logo } from './logo'

const FOOTER_SECTIONS = [
  {
    title: 'Get things done',
    links: [
      { href: '/post', label: 'Post a job' },
      { href: '/hustlers', label: 'Browse hustlers' },
      { href: '/categories', label: 'Categories' },
      { href: '/how-it-works', label: 'How it works' },
    ],
  },
  {
    title: 'Start hustling',
    links: [
      { href: '/explore', label: 'Find work' },
      { href: '/signup?intent=hustle', label: 'Become a hustler' },
      { href: '/how-it-works#getting-paid', label: 'How you get paid' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { href: '/safety', label: 'Safety' },
      { href: '/how-it-works#payments', label: 'Secure payments' },
      { href: '/help', label: 'Help & support' },
      { href: '/safety#report', label: 'Report a problem' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/cookies', label: 'Cookies' },
    ],
  },
]

/**
 * Footer.
 *
 * The last four rows of the page's grid, and it stays in the grid: the brand cell
 * and the four link columns are divided by the same vertical hairlines the header
 * uses, so the rules run unbroken from the top of the page to the bottom.
 *
 * Column headings are set in the label face. On a footer this matters more than it
 * sounds — it separates "category of link" from "link" without needing a weight
 * change or a colour change, which is what keeps twenty small links legible as
 * four groups rather than as one list.
 *
 * The brand ramp closes the page: five flat bands running the full width, the
 * mark from the logo scaled up. It is the only ornament in the footer and it
 * costs nothing, being five divs.
 */
export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background">
      <div className="ruled">
        {/* Brand cell + link columns. `lg:divide-x` rather than `divide-x` so the
            stacked mobile layout doesn't grow rules between full-width blocks. */}
        <div className="grid border-b border-border sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-border">
          <div className="border-b border-border px-4 py-8 sm:col-span-2 sm:px-6 lg:col-span-1 lg:border-b-0 lg:px-10">
            <Logo />
            <p className="mt-4 max-w-xs text-pretty text-body-sm leading-relaxed text-muted-foreground">
              The digital street where people who need things done meet people ready to hustle.
            </p>
            <p className="mt-5 font-label text-eyebrow-sm uppercase tracking-[0.12em] text-muted-foreground">
              Built in Lagos
            </p>
          </div>

          {FOOTER_SECTIONS.map((section, index) => (
            <nav
              key={section.title}
              aria-label={section.title}
              className={[
                'px-4 py-8 sm:px-6 lg:px-6',
                // Horizontal rules only where a column has another below it in
                // the 2-up mobile grid.
                index < 2 ? 'border-b border-border lg:border-b-0' : '',
              ].join(' ')}
            >
              <h2 className="font-label text-eyebrow-sm uppercase tracking-[0.12em] text-muted-foreground">
                {section.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="link-underline text-body-sm text-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Legal row. */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p className="font-label text-eyebrow-sm text-muted-foreground">
            © {year} Hustle Street
          </p>
          <p className="max-w-xl text-pretty text-eyebrow-sm leading-relaxed text-muted-foreground">
            Payments are processed by a licensed payment provider. Hustle Street holds no customer
            funds and is not a bank.
          </p>
        </div>
      </div>

      {/* The brand ramp. Full-bleed, flat, no radius — the page signs off in
          colour after four screens of paper and hairlines. */}
      <div className="flex h-2 w-full" aria-hidden="true">
        <div className="h-full flex-1 bg-sun" />
        <div className="h-full flex-1 bg-sun" />
        <div className="h-full flex-1 bg-tangerine" />
        <div className="h-full flex-1 bg-primary" />
        <div className="h-full flex-1 bg-primary" />
      </div>
    </footer>
  )
}
