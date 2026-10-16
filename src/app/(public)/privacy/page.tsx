import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHero } from '@/components/marketing/page-primitives'
import { LegalDoc } from '@/components/marketing/legal-doc'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What Hustle Street collects, why, who can see it, how long it is kept, and the rights you have over it under the Nigeria Data Protection Act.',
  alternates: { canonical: '/privacy' },
}

export const revalidate = 86400

const UPDATED = '6 August 2026'

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy policy"
        lede="What we collect, why we need it, and who can see it. The short version: your address and phone number are the two things people most fear exposing, and neither is public."
      />

      <LegalDoc
        updated={UPDATED}
        intro={
          <>
            <p>
              This policy explains what Hustle Street does with your personal data. It is written to
              be understood, and it covers our obligations under the Nigeria Data Protection Act
              2023.
            </p>
            <p className="mt-4">
              If you want the practical version of who sees what, the table on the{' '}
              <Link href="/safety">trust and safety</Link> page answers that in one screen.
            </p>
          </>
        }
        sections={[
          {
            heading: 'What we collect',
            body: (
              <>
                <p>
                  <strong>What you give us.</strong> Your name, phone number, email address, and
                  password. If you hustle, also your skills, rates, service area and the identity
                  document used for verification. If you post, the details of your jobs, including
                  the address where work happens.
                </p>
                <p>
                  <strong>What you create by using the platform.</strong> Messages, applications,
                  reviews, disputes, and the record of jobs you have posted or completed.
                </p>
                <p>
                  <strong>What we collect automatically.</strong> Approximate location if you grant
                  it, device and browser information, and the pages you visit. Location is used to
                  rank jobs by distance. You can decline it and set an area manually instead.
                </p>
                <p>
                  <strong>What we never see.</strong> Card numbers and bank credentials. Those go
                  directly to our licensed payment provider. Hustle Street never receives them.
                </p>
              </>
            ),
          },
          {
            heading: 'Why we use it',
            body: (
              <>
                <ul>
                  <li>
                    <strong>To run the marketplace.</strong> Matching jobs to nearby hustlers,
                    delivering messages, processing payments and payouts.
                  </li>
                  <li>
                    <strong>To keep people safe.</strong> Verifying identity, detecting fraud, and
                    reviewing disputes. This is the reason messages are retained.
                  </li>
                  <li>
                    <strong>To meet legal obligations.</strong> Tax records, and responding to
                    lawful requests from Nigerian authorities.
                  </li>
                  <li>
                    <strong>To tell you things you asked for.</strong> Job alerts and status
                    notifications. You control these in settings.
                  </li>
                </ul>
                <p>
                  We do not sell your personal data. We do not share it with advertisers. We do not
                  build profiles of you for anyone else&rsquo;s benefit.
                </p>
              </>
            ),
          },
          {
            heading: 'Who can see what',
            body: (
              <>
                <p>
                  <strong>Public on your profile:</strong> your first name and last initial, your
                  photo if you add one, your rating, your completed-job count, your verification
                  badges, and your reviews.
                </p>
                <p>
                  <strong>Shown on a job listing:</strong> an approximate area and distance. Never a
                  street address.
                </p>
                <p>
                  <strong>Shared only with the person you hire, only once hired:</strong> the exact
                  address of the job.
                </p>
                <p>
                  <strong>Shared only after a live assignment:</strong> phone numbers, and only
                  between the poster and the hired hustler. A phone number is never shown on a
                  public listing and is never given to an applicant who has not been accepted.
                </p>
                <p>
                  <strong>Never shown to other users:</strong> your email address, your identity
                  document, your bank details, and your exact coordinates.
                </p>
              </>
            ),
          },
          {
            heading: 'Who we share it with',
            body: (
              <>
                <p>Only the parties we need to operate:</p>
                <ul>
                  <li>our payment provider, to hold and release payments and pay out earnings</li>
                  <li>our identity verification provider, to confirm documents</li>
                  <li>our hosting and database providers, which store the data</li>
                  <li>
                    Nigerian authorities, where we are legally required to respond to a lawful
                    request
                  </li>
                </ul>
                <p>
                  Each is bound to use the data only to provide that service. Some process data
                  outside Nigeria; where they do, we require safeguards consistent with the Nigeria
                  Data Protection Act.
                </p>
              </>
            ),
          },
          {
            heading: 'How long we keep it',
            body: (
              <>
                <ul>
                  <li>
                    <strong>Your account:</strong> while it is open, and for 90 days after you close
                    it so it can be restored if closure was a mistake.
                  </li>
                  <li>
                    <strong>Job and message history:</strong> seven years. This is deliberate.
                    Disputes and tax obligations both reach back, and a deleted thread is a poster
                    or hustler with no evidence.
                  </li>
                  <li>
                    <strong>Identity documents:</strong> kept only as long as needed to verify, then
                    deleted. The verified status remains.
                  </li>
                  <li>
                    <strong>Reviews:</strong> retained after account closure, anonymised, because
                    removing them would distort the other party&rsquo;s rating.
                  </li>
                </ul>
              </>
            ),
          },
          {
            heading: 'Your rights',
            body: (
              <>
                <p>Under the Nigeria Data Protection Act you can:</p>
                <ul>
                  <li>ask for a copy of the personal data we hold about you</li>
                  <li>correct anything inaccurate, most of which you can edit yourself</li>
                  <li>ask us to delete your data, subject to the retention periods above</li>
                  <li>object to processing, or ask us to restrict it</li>
                  <li>withdraw consent for notifications and location at any time</li>
                  <li>complain to the Nigeria Data Protection Commission</li>
                </ul>
                <p>
                  Email <a href="mailto:privacy@hustlestreet.ng">privacy@hustlestreet.ng</a> to
                  exercise any of these. We respond within 30 days.
                </p>
              </>
            ),
          },
          {
            heading: 'Security',
            body: (
              <>
                <p>
                  Data is encrypted in transit and at rest. Access by our staff is restricted to
                  those who need it, and dispute reviewers see only the job in question.
                </p>
                <p>
                  No system is perfectly secure. If a breach affects your personal data we will tell
                  you and the Nigeria Data Protection Commission as required by law.
                </p>
                <p>
                  The most effective thing you can do is keep the conversation and the payment on
                  the platform. Off-platform arrangements are outside the protections described
                  here.
                </p>
              </>
            ),
          },
          {
            heading: 'Contact',
            body: (
              <p>
                Privacy questions go to{' '}
                <a href="mailto:privacy@hustlestreet.ng">privacy@hustlestreet.ng</a>. General
                questions are answered faster through <Link href="/help">help and support</Link>.
              </p>
            ),
          },
        ]}
      />
    </>
  )
}
