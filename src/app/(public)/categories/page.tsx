import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { categoryIcon } from '@/lib/categories'
import { ClosingCta, PageHero, Section } from '@/components/marketing/page-primitives'
import { RevealGroup } from '@/components/motion/reveal'
import type { Category } from '@/types/database'

export const metadata: Metadata = {
  title: 'Categories',
  description:
    'Every kind of work on Hustle Street: cleaning, repairs, moving, design, tutoring and more. Browse a category to see live jobs near you.',
  alternates: { canonical: '/categories' },
}

export const revalidate = 3600

type CategoryRow = Pick<Category, 'id' | 'slug' | 'name' | 'icon' | 'job_count'> & {
  parent_id: string | null
  description: string | null
}

export default async function CategoriesPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('categories')
    .select('id, slug, name, icon, job_count, parent_id, description')
    .eq('is_active', true)
    .order('position')

  const all = (data ?? []) as CategoryRow[]
  const parents = all.filter((c) => c.parent_id === null)
  const childrenOf = (parentId: string) => all.filter((c) => c.parent_id === parentId)

  const totalLive = all.reduce((sum, c) => sum + (c.job_count ?? 0), 0)

  return (
    <>
      <PageHero
        eyebrow="Categories"
        title="Whatever it is, someone nearby does it"
        lede={
          totalLive > 0
            ? `${parents.length} categories and ${totalLive.toLocaleString()} live jobs across Lagos. Pick one to see what is open near you.`
            : `${parents.length} categories, from a leaking tap to a brand identity. Pick one to see what is open near you.`
        }
        image="/media/hero-categories.jpg"
        imageAlt="A woman standing against a painted wall in Lagos"
      >
        <Button asChild size="lg">
          <Link href="/explore">
            Browse all jobs
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </PageHero>

      <Section aria-labelledby="all-heading">
        <h2 id="all-heading" className="sr-only">
          All categories
        </h2>

        {parents.length === 0 ? (
          <div className="panel px-6 py-16 text-center">
            <p className="font-display text-lg font-semibold">No categories yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Categories appear here once the marketplace is seeded. Nothing has gone wrong.
            </p>
          </div>
        ) : (
          <RevealGroup as="ul" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
            {parents.map((category) => {
              const Icon = categoryIcon(category.icon, category.slug)
              const subs = childrenOf(category.id)
              return (
                <li key={category.id}>
                  <Link
                    href={`/explore?categories=${category.id}`}
                    className="lift group flex h-full flex-col rounded-[8px] border border-border bg-surface p-6 hover:border-foreground/15 hover:bg-surface-muted"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <Icon
                        className="icon-hover size-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="text-xs tabular-nums text-muted-foreground/70">
                        {category.job_count > 0
                          ? `${category.job_count.toLocaleString()} live`
                          : 'None yet'}
                      </span>
                    </div>

                    <h3 className="mt-8 font-display text-lg font-semibold leading-snug tracking-tight">
                      {category.name}
                    </h3>

                    {category.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {category.description}
                      </p>
                    ) : null}

                    {subs.length > 0 ? (
                      <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-muted-foreground/70">
                        {subs.map((s) => s.name).join(' · ')}
                      </p>
                    ) : null}

                    <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-medium text-primary-text">
                      See jobs
                      <ArrowRight className="arrow-hover size-4" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </RevealGroup>
        )}
      </Section>

      <ClosingCta
        title="Not sure which one it fits?"
        body="Describe the job in your own words. We will route it to the people who do that kind of work."
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
          <Link href="/explore">Browse jobs</Link>
        </Button>
      </ClosingCta>
    </>
  )
}
