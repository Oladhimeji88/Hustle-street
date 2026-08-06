import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHero } from '@/components/marketing/page-primitives'
import { LegalDoc } from '@/components/marketing/legal-doc'

export const metadata: Metadata = {
  title: 'Cookies',
  description:
    'What Hustle Street stores on your device, why each item is there, and what happens if you clear it.',
  alternates: { canonical: '/cookies' },
}

export const revalidate = 86400

const UPDATED = '6 August 2026'

/**
 * Cookie policy.
 *
 * Written as a table of what is actually stored rather than the usual four
 * paragraphs about "enhancing your experience". Anyone who opens this page
 * wants to know what is on their device and whether they can delete it.
 */
const STORED = [
  {
    name: 'Session token',
    kind: 'Cookie',
    purpose: 'Keeps you logged in between visits.',
    life: 'Until you log out, or 30 days idle',
  },
  {
    name: 'Theme and display settings',
    kind: 'Local storage',
    purpose: 'Remembers your interface preferences.',
    life: 'Until you clear it',
  },
  {
    name: 'Saved location',
    kind: 'Local storage',
    purpose:
      'The area you chose or the position you granted, so jobs can be ranked by distance without asking on every visit.',
    life: 'A device fix expires after a day. A manual choice does not.',
  },
  {
    name: 'Draft job',
    kind: 'Local storage',
    purpose: 'Keeps a half-written job post if your connection drops mid-form.',
    life: 'Until posted or discarded',
  },
  {
    name: 'Offline cache',
    kind: 'Service worker',
    purpose:
      'Stores pages and saved jobs so the app opens on a weak connection. This is what makes it work offline.',
    life: 'Refreshed as you browse',
  },
]

export default function CookiesPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Cookies and local storage"
        lede="Everything Hustle Street puts on your device, and why. There is no advertising tracker in this list, because there is no advertising tracker."
      />

      <div className="container pb-4">
        <div className="mx-auto max-w-3xl">
          <div className="panel overflow-hidden">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                What Hustle Street stores on your device, its purpose and how long it lasts
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="px-5 py-4 font-medium">
                    What
                  </th>
                  <th scope="col" className="hidden px-5 py-4 font-medium sm:table-cell">
                    Where
                  </th>
                  <th scope="col" className="px-5 py-4 font-medium">
                    Why
                  </th>
                  <th scope="col" className="hidden px-5 py-4 font-medium md:table-cell">
                    How long
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {STORED.map((row) => (
                  <tr key={row.name}>
                    <th scope="row" className="px-5 py-4 align-top font-medium">
                      {row.name}
                      <span className="mt-1 block text-xs font-normal text-muted-foreground sm:hidden">
                        {row.kind}
                      </span>
                    </th>
                    <td className="hidden px-5 py-4 align-top text-muted-foreground sm:table-cell">
                      {row.kind}
                    </td>
                    <td className="px-5 py-4 align-top leading-relaxed text-muted-foreground">
                      {row.purpose}
                      <span className="mt-1 block text-xs md:hidden">{row.life}</span>
                    </td>
                    <td className="hidden px-5 py-4 align-top text-muted-foreground md:table-cell">
                      {row.life}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <LegalDoc
        updated={UPDATED}
        intro={
          <p>
            The table above is the complete list. Below is what it means for you in practice.
          </p>
        }
        sections={[
          {
            heading: 'There is no advertising or cross-site tracking',
            body: (
              <>
                <p>
                  Hustle Street sets no advertising cookies, runs no third-party ad pixels, and does
                  not track you across other websites. Nothing in the table is shared with an
                  advertiser or a data broker.
                </p>
                <p>
                  This is why you are not greeted by a consent banner asking you to accept
                  everything. There is nothing to consent to beyond what makes the site work.
                </p>
              </>
            ),
          },
          {
            heading: 'Analytics',
            body: (
              <>
                <p>
                  We measure how the product is used in aggregate, such as which pages are visited
                  and where people abandon posting a job. This tells us what is broken.
                </p>
                <p>
                  Analytics are tied to your account for logged-in use, so we can support you when
                  something goes wrong. They are never sold and never used to target advertising.
                </p>
              </>
            ),
          },
          {
            heading: 'Turning things off',
            body: (
              <>
                <p>
                  Every browser lets you block or clear cookies and site data. There is no setting
                  to preserve here, because none of what we store is optional decoration.
                </p>
                <p>What actually breaks if you clear it:</p>
                <ul>
                  <li>
                    <strong>Session token:</strong> you are logged out. Log back in and it returns.
                  </li>
                  <li>
                    <strong>Saved location:</strong> jobs stop being ranked by distance until you
                    set an area again.
                  </li>
                  <li>
                    <strong>Draft job:</strong> an unfinished job post is lost.
                  </li>
                  <li>
                    <strong>Offline cache:</strong> the app stops opening without a connection until
                    it rebuilds.
                  </li>
                </ul>
                <p>
                  Blocking cookies entirely means you cannot stay logged in, so posting a job or
                  applying for work will not be possible.
                </p>
              </>
            ),
          },
          {
            heading: 'Contact',
            body: (
              <p>
                Questions about this page go to{' '}
                <a href="mailto:privacy@hustlestreet.ng">privacy@hustlestreet.ng</a>. What we do
                with the data itself is covered in the{' '}
                <Link href="/privacy">privacy policy</Link>.
              </p>
            ),
          },
        ]}
      />
    </>
  )
}
