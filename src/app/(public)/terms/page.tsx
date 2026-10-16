import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHero } from '@/components/marketing/page-primitives'
import { LegalDoc } from '@/components/marketing/legal-doc'

export const metadata: Metadata = {
  title: 'Terms of service',
  description:
    'The agreement between you and Hustle Street: what the platform does, what it does not do, how payments are held, and how disputes are decided.',
  alternates: { canonical: '/terms' },
}

export const revalidate = 86400

const UPDATED = '6 August 2026'

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of service"
        lede="The agreement between you and Hustle Street. Written to be read, not to be survived."
      />

      <LegalDoc
        updated={UPDATED}
        intro={
          <>
            <p>
              These terms govern your use of Hustle Street. By creating an account, posting a job,
              or applying for work, you agree to them.
            </p>
            <p className="mt-4">
              Hustle Street is operated in Nigeria and these terms are governed by Nigerian law.
              They are a real contract, so the plain-English summaries in each section are there to
              help you understand the clause, not to replace it.
            </p>
          </>
        }
        sections={[
          {
            heading: 'What Hustle Street is',
            body: (
              <>
                <p>
                  Hustle Street is a marketplace. We connect people who need work done
                  (&ldquo;posters&rdquo;) with people who can do it (&ldquo;hustlers&rdquo;), and we
                  hold the payment in between.
                </p>
                <p>
                  <strong>We are not the employer of any hustler, and we do not perform any of
                  the work advertised.</strong> Hustlers are independent contractors who set their
                  own rates, choose their own jobs, and control how the work is done. A contract for
                  a job is between the poster and the hustler. Hustle Street is not a party to it.
                </p>
                <p>
                  We are also not a bank and we do not hold customer funds. Payments are held by a
                  licensed payment provider. See section 4.
                </p>
              </>
            ),
          },
          {
            heading: 'Your account',
            body: (
              <>
                <p>To use Hustle Street you must:</p>
                <ul>
                  <li>be at least 18 years old</li>
                  <li>give accurate information, and keep it accurate</li>
                  <li>verify your phone number before applying for work</li>
                  <li>verify your identity before withdrawing earnings</li>
                  <li>keep your login credentials to yourself</li>
                </ul>
                <p>
                  One person, one account. Creating additional accounts to evade a rating, a
                  suspension or a dispute outcome is grounds for permanent removal.
                </p>
                <p>
                  You are responsible for everything done through your account. Tell us immediately
                  if you think someone else has access to it.
                </p>
              </>
            ),
          },
          {
            heading: 'Posting jobs and applying for work',
            body: (
              <>
                <p>
                  Posting a job is free. Applying for work is free. There is no subscription and no
                  charge for messaging.
                </p>
                <p>
                  When you post a job you are making a genuine offer of work at the budget you
                  state. When you apply, you are stating that you can actually do the work at the
                  price you quote and hold any licence the work legally requires.
                </p>
                <p>
                  Once a poster accepts an application and the payment is secured, both sides are
                  committed. Cancelling after that point is handled under section 5.
                </p>
                <p>You may not use Hustle Street to advertise or seek:</p>
                <ul>
                  <li>anything illegal under Nigerian law</li>
                  <li>work requiring a licence or certification you do not hold</li>
                  <li>sexual services</li>
                  <li>work involving weapons, controlled substances or stolen goods</li>
                  <li>multi-level marketing, recruitment schemes or advance-fee arrangements</li>
                </ul>
              </>
            ),
          },
          {
            heading: 'Payments, fees and how money is held',
            body: (
              <>
                <p>
                  <strong>The poster pays before work starts.</strong> The agreed price is charged
                  when the application is accepted and held by our licensed payment provider. It is
                  not held by Hustle Street, it is not spendable by us, and it is no longer in the
                  poster&rsquo;s account.
                </p>
                <p>
                  <strong>Release.</strong> The held amount is released to the hustler when the
                  poster confirms the work is complete. If the poster does not confirm and does not
                  open a dispute, it releases automatically 72 hours after the hustler marks the job
                  done.
                </p>
                <p>
                  <strong>Our fee.</strong> Hustle Street takes a commission from the hustler&rsquo;s
                  payout when a job completes. The current rate is shown on the job before you
                  accept it and on the{' '}
                  <Link href="/how-it-works#payments">how it works</Link> page. We take nothing if a
                  job does not complete. We may change the rate, but never for a job already
                  accepted.
                </p>
                <p>
                  <strong>Withdrawals.</strong> Earnings become withdrawable after a short clearing
                  period and can be sent to any Nigerian bank account in your own name. Identity
                  verification is required first.
                </p>
                <p>
                  Taking payment for a Hustle Street job outside the platform removes every
                  protection in these terms and is grounds for removal from the platform.
                </p>
              </>
            ),
          },
          {
            heading: 'Cancellations and disputes',
            body: (
              <>
                <p>
                  <strong>Before work starts,</strong> either side may cancel and the held payment
                  is returned to the poster in full.
                </p>
                <p>
                  <strong>After work has started,</strong> cancelling is a dispute. Do not confirm
                  completion if the work is not right, because confirming releases the money.
                </p>
                <p>When a dispute is opened, the money stays held. A reviewer at Hustle Street:</p>
                <ul>
                  <li>reads the job, the agreed scope, the messages and any evidence submitted</li>
                  <li>may ask either side for more information</li>
                  <li>decides to refund in full, release in full, or split the amount</li>
                  <li>tells both sides the reasoning</li>
                </ul>
                <p>
                  That decision is final within the platform. It does not remove any right you have
                  to pursue the matter through the Nigerian courts.
                </p>
              </>
            ),
          },
          {
            heading: 'Reviews and reputation',
            body: (
              <>
                <p>
                  Only a completed, paid job produces a reviewable event. Neither side sees the
                  other&rsquo;s review until both have submitted or the review window closes.
                </p>
                <p>
                  Reviews must describe your genuine experience of that job. Buying, selling,
                  trading or coercing reviews, or threatening a bad review to obtain a discount or a
                  refund, results in removal from the platform.
                </p>
                <p>
                  We remove reviews containing personal data, threats, or content unrelated to the
                  work. We do not remove a review for being unflattering.
                </p>
              </>
            ),
          },
          {
            heading: 'What we are responsible for, and what we are not',
            body: (
              <>
                <p>
                  We are responsible for operating the platform: matching, messaging, holding
                  payment through our provider, and reviewing disputes fairly.
                </p>
                <p>
                  <strong>We do not guarantee the quality, safety, legality or timeliness of any
                  work,</strong> and we do not guarantee that any job will be filled or that any
                  hustler will find work. Verification confirms that someone is who they say they
                  are. It is not a warranty of their competence or conduct.
                </p>
                <p>
                  To the fullest extent Nigerian law permits, our liability arising from any job is
                  limited to the amount held for that job. We are not liable for indirect or
                  consequential loss.
                </p>
                <p>
                  Nothing here limits liability for fraud, for death or personal injury caused by
                  our negligence, or for anything else that cannot lawfully be limited.
                </p>
              </>
            ),
          },
          {
            heading: 'Suspension and closing your account',
            body: (
              <>
                <p>
                  You can close your account at any time. Jobs already in progress must be finished
                  or cancelled first, and held payments are settled before closure.
                </p>
                <p>
                  We may suspend or remove an account that breaches these terms, that we reasonably
                  believe is being used fraudulently, or that puts other users at risk. Where we
                  can, we tell you why and give you a route to respond. Where the risk is immediate,
                  we act first.
                </p>
                <p>Suspension does not forfeit money already earned on completed jobs.</p>
              </>
            ),
          },
          {
            heading: 'Changes to these terms',
            body: (
              <>
                <p>
                  We may update these terms. If a change materially affects your rights, we will
                  give notice in the app before it takes effect.
                </p>
                <p>
                  Changes never apply retroactively to a job already accepted. The terms that
                  applied when a job was accepted govern that job.
                </p>
              </>
            ),
          },
          {
            heading: 'Contact',
            body: (
              <>
                <p>
                  Questions about these terms go to{' '}
                  <a href="mailto:legal@hustlestreet.ng">legal@hustlestreet.ng</a>. Anything about a
                  specific job is faster through <Link href="/help">help and support</Link>, because
                  the job thread comes with it.
                </p>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
