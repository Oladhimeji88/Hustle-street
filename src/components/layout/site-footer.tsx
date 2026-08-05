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

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="container py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
              The digital street where people who need things done meet people ready to hustle.
            </p>
            <p className="mt-4 text-sm font-medium">
              🇳🇬 Built in Lagos
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h2>
              <ul className="mt-3 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/80 transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Hustle Street. All rights reserved.
          </p>
          <p className="max-w-xl text-pretty text-xs leading-relaxed text-muted-foreground">
            Payments are processed by a licensed payment provider. Hustle Street holds no customer
            funds and is not a bank.
          </p>
        </div>
      </div>
    </footer>
  )
}
