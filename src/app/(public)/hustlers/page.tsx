import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { HustlerBrowser } from '@/components/hustler/hustler-browser'
import { ListSkeleton } from '@/components/ui/feedback'
import { ClosingCta, PageHero } from '@/components/marketing/page-primitives'

export const metadata: Metadata = {
  title: 'Find hustlers',
  description:
    'Browse verified, rated people near you in Lagos: plumbers, cleaners, movers, designers and more. Message before you commit, and pay only when the work is done.',
  alternates: { canonical: '/hustlers' },
}

export const dynamic = 'force-static'

export default async function HustlersPage() {
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
        eyebrow="Find hustlers"
        title="Skilled people, already nearby"
        lede="Ratings and completed-job counts that can only come from finished work. Message anyone before you commit, and your payment stays held until you confirm."
              image="/media/hero-hustlers.jpg"
        imageAlt="A carpenter drilling into timber"
      />

      <section className="gutter py-14 sm:py-20">
        <Suspense fallback={<ListSkeleton count={6} />}>
          <HustlerBrowser categories={categories} />
        </Suspense>
      </section>

      <ClosingCta
        title="Would rather they came to you?"
        body="Post the job instead. People with the right skills in your area get notified straight away, and you pick from whoever replies."
      >
        <Button asChild size="lg">
          <Link href="/post">
            Post a Job
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="invert-outline"
        >
          <Link href="/safety">Trust &amp; safety</Link>
        </Button>
      </ClosingCta>
    </>
  )
}
