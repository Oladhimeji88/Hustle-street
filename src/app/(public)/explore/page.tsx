import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { JobBrowser } from '@/components/job/job-browser'
import { ListSkeleton } from '@/components/ui/feedback'
import { ClosingCta, PageHero } from '@/components/marketing/page-primitives'

export const metadata: Metadata = {
  title: 'Find work',
  description:
    'Browse jobs near you in Lagos — cleaning, repairs, moving, design and more. Free to apply, and payment is secured before you start.',
  alternates: { canonical: '/explore' },
}

// The shell is static; the feed inside it is client-fetched per location and
// filter, so there is nothing here worth revalidating on a timer.
export const dynamic = 'force-static'

export default async function ExplorePage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true)
    .is('parent_id', null)
    .order('position')
    .limit(20)

  const categories = (data ?? []) as { id: string; name: string }[]

  return (
    <>
      <PageHero
        eyebrow="Find work"
        title="Jobs near you, right now"
        lede="Free to apply, no subscription, and the payment is secured before you lift a finger. Set your location to rank them by distance."
      />

      <section className="container py-14 sm:py-20">
        {/* useSearchParams inside JobBrowser needs a Suspense boundary — the
            landing page's search box and the category rail both arrive here
            with a query string to seed the filters from. */}
        <Suspense fallback={<ListSkeleton count={6} />}>
          <JobBrowser categories={categories} />
        </Suspense>
      </section>

      <ClosingCta
        title="Nothing here for you yet?"
        body="Create a profile and we will notify you the moment a job matching your skills is posted nearby."
      >
        <Button asChild size="lg" className="rounded-full px-7">
          <Link href="/signup?intent=hustle">
            Become a hustler
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="rounded-full border-white/20 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
        >
          <Link href="/how-it-works">How it works</Link>
        </Button>
      </ClosingCta>
    </>
  )
}
