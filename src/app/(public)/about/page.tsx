import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClosingCta, PageHero, Section, SectionHead } from '@/components/marketing/page-primitives'
import { RevealGroup } from '@/components/motion/reveal'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why Hustle Street exists, what we decided to build around, and how the company makes money.',
  alternates: { canonical: '/about' },
}

export const revalidate = 86400

const PRINCIPLES = [
  {
    title: 'Trust is the product',
    body: 'The hard part of hiring a stranger is not discovery, it is believing they will show up and do the work. Everything structural on this platform, from held payments to reviews that only completed jobs can produce, exists to answer that question rather than to add a feature.',
  },
  {
    title: 'Free until it works',
    body: 'Nobody pays to post, apply, or message. We take a percentage only when a job actually completes. If the marketplace fails you, it costs you nothing, which keeps our incentive pointed at jobs finishing rather than at listings accumulating.',
  },
  {
    title: 'Built for the phone people own',
    body: 'Not the newest one. The app installs from the browser with no store download, works on a weak connection, and keeps your saved jobs available offline. Every design decision is checked against a mid-range Android on patchy data.',
  },
  {
    title: 'Location without exposure',
    body: 'Proximity is the whole point of a local marketplace, and a home address is the thing people are most right to guard. Jobs advertise an area and a distance. The exact address reaches exactly one person, at the moment you hire them.',
  },
]

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Why this exists"
        lede="Finding someone reliable to do a job usually means calling three people who know a guy. Hustle Street is an attempt to make that a two-minute problem instead of a two-day one."
      />

      <Section aria-labelledby="story-heading">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <h2 id="story-heading" className="text-display-lg">
            The problem
          </h2>
          <div className="lg:pt-2">
            <p className="text-pretty text-xl leading-relaxed sm:text-2xl sm:leading-relaxed">
              There is no shortage of skilled people in Lagos, and no shortage of work that needs
              doing. The two just have no reliable way to find each other.
            </p>
            <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
              So the plumber waits for a referral that may not come, and the person with a leaking
              tap asks around a WhatsApp group. Both sides lose, and the thing standing between
              them is not distance. It is that neither can verify the other, and neither wants to
              go first on the money.
            </p>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              That is a solvable problem, and solving it is the entire remit of this company.
            </p>
          </div>
        </div>
      </Section>

      <Section aria-labelledby="principles-heading">
        <SectionHead
          eyebrow="How we build"
          id="principles-heading"
          title="Four things we decided up front"
        />
        <RevealGroup as="ul" className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2">
          {PRINCIPLES.map((principle) => (
            <li key={principle.title} className="border-t border-border pt-5">
              <h3 className="font-display text-lg font-semibold">{principle.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {principle.body}
              </p>
            </li>
          ))}
        </RevealGroup>
      </Section>

      <Section aria-labelledby="money-heading">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <SectionHead
            eyebrow="The business"
            id="money-heading"
            title="How we make money"
          />
          <div>
            <p className="text-pretty text-lg leading-relaxed">
              A commission on completed jobs. That is the whole model.
            </p>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              We do not sell advertising, we do not sell placement in search results, and we do not
              sell your data. A hustler cannot pay to appear above someone with better reviews,
              because the moment that is purchasable the ratings stop meaning anything and the
              marketplace stops being worth using.
            </p>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              The current rate, and a worked example of exactly what reaches the hustler, is on the{' '}
              <Link href="/how-it-works#payments" className="link-underline text-foreground">
                how it works
              </Link>{' '}
              page.
            </p>
            <Button asChild variant="ink" className="mt-8 rounded-full px-6">
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section aria-labelledby="where-heading">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <SectionHead eyebrow="Where we are" id="where-heading" title="Lagos first" />
          <div>
            <p className="text-pretty text-lg leading-relaxed">
              Island and mainland, from Ajah to Festac.
            </p>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              A local marketplace is only useful when it is dense, so we would rather be genuinely
              useful in one city than thinly present in six. Abuja, Port Harcourt and Ibadan follow
              once Lagos is properly served.
            </p>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              Remote work is the exception. Design, writing and development have no location
              requirement, and those jobs are open anywhere in Nigeria today.
            </p>
          </div>
        </div>
      </Section>

      <ClosingCta>
        <Button asChild size="lg" className="group rounded-full px-7">
          <Link href="/post">
            Post a Job
            <ArrowRight className="arrow-hover" aria-hidden="true" />
          </Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="rounded-full border-white/20 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
        >
          <Link href="/explore">Find Work</Link>
        </Button>
      </ClosingCta>
    </>
  )
}
