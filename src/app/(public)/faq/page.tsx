import { permanentRedirect } from 'next/navigation'

/**
 * /faq exists because the footer links to it, and a dead link in the footer is
 * worse than a redirect.
 *
 * It redirects rather than duplicating the accordion. The FAQ already lives on
 * /help and emits `FAQPage` structured data; a second page emitting the same
 * schema for the same questions is a duplicate-content problem that search
 * engines resolve by picking one and discarding the other, which is a decision
 * better made here than by a crawler.
 *
 * Permanent (308) rather than temporary, because this is not going to move back.
 */
export default function FaqPage() {
  permanentRedirect('/help#faq')
}
