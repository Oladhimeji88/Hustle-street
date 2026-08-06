'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, SlidersHorizontal, X } from 'lucide-react'
import { useJobFeed, useSavedJobIds, useToggleSaveJob } from '@/hooks/use-jobs'
import { useLocation } from '@/components/location/location-provider'
import { JobCard } from './job-card'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback'
import { toast } from '@/components/ui/toast'

interface CategoryOption {
  id: string
  name: string
}

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'budget_high', label: 'Highest paid' },
] as const

/**
 * The job browser behind /explore.
 *
 * Filter state lives in React rather than the URL query string, with one
 * exception: the initial values are seeded from the query so that the landing
 * page's search box and every `?categories=` link from the category rail arrive
 * with their filter already applied. Pushing every subsequent keystroke back
 * into the URL would add a history entry per character, which turns the back
 * button into a stutter.
 */
export function JobBrowser({ categories }: { categories: CategoryOption[] }) {
  const params = useSearchParams()
  const { coords, isResolved } = useLocation()

  const [query, setQuery] = React.useState(() => params.get('q') ?? '')
  const [selected, setSelected] = React.useState<string[]>(() => {
    const raw = params.get('categories')
    return raw ? raw.split(',').filter(Boolean) : []
  })
  const [sort, setSort] = React.useState<string>(() => params.get('sort') ?? 'newest')
  const [remoteOnly, setRemoteOnly] = React.useState(false)

  // Debounced so a search does not fire a request per keystroke on a phone
  // network. 350ms is long enough to batch typing, short enough to feel live.
  const [debouncedQuery, setDebouncedQuery] = React.useState(query)
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 350)
    return () => window.clearTimeout(id)
  }, [query])

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJobFeed({
      q: debouncedQuery || undefined,
      // Only send coordinates once the user has actually resolved a location —
      // sending the fallback would silently rank by distance from a place they
      // have never been.
      lat: isResolved ? coords.lat : undefined,
      lng: isResolved ? coords.lng : undefined,
      categories: selected.length ? selected : undefined,
      locationKind: remoteOnly ? ['remote'] : undefined,
      sort,
      pageSize: 12,
    })

  const { data: savedIds } = useSavedJobIds()
  const toggleSave = useToggleSaveJob()

  const jobs = data?.pages.flatMap((page) => page.data) ?? []
  const activeFilters = selected.length + (remoteOnly ? 1 : 0)

  const toggleCategory = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))

  const clearAll = () => {
    setSelected([])
    setRemoteOnly(false)
    setQuery('')
  }

  return (
    <div>
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="explore-search" className="sr-only">
              Search jobs
            </label>
            <input
              id="explore-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Plumber, cleaner, logo design…"
              className="h-12 w-full rounded-full border border-input bg-background px-5 text-[15px] transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/20 focus:outline-none focus:ring-4 focus:ring-foreground/5"
            />
          </div>

          <div className="flex gap-2">
            <label htmlFor="explore-sort" className="sr-only">
              Sort jobs
            </label>
            <select
              id="explore-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-12 rounded-full border border-input bg-background px-5 text-sm focus:border-foreground/20 focus:outline-none focus:ring-4 focus:ring-foreground/5"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category chips. Horizontally scrollable rather than wrapped to four
            rows on a phone. */}
        {categories.length > 0 ? (
          <div className="rail mt-4 -mx-1 px-1">
            <Chip selected={remoteOnly} onClick={() => setRemoteOnly((v) => !v)}>
              Remote only
            </Chip>
            {categories.map((category) => (
              <Chip
                key={category.id}
                selected={selected.includes(category.id)}
                onClick={() => toggleCategory(category.id)}
              >
                {category.name}
              </Chip>
            ))}
          </div>
        ) : null}

        {activeFilters > 0 ? (
          <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              {activeFilters} filter{activeFilters === 1 ? '' : 's'} active
            </p>
            <Button variant="ghost" size="xs" onClick={clearAll} className="ml-auto rounded-full">
              <X aria-hidden="true" />
              Clear
            </Button>
          </div>
        ) : null}
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <div className="mt-8">
        {isPending ? (
          <ListSkeleton count={6} />
        ) : isError ? (
          <ErrorState
            description="We could not load jobs right now."
            onRetry={() => void refetch()}
          />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="Nothing matches yet"
            description={
              activeFilters > 0 || debouncedQuery
                ? 'Try removing a filter or searching for something broader.'
                : 'No jobs are live in this area yet. Be the first to post one.'
            }
            action={
              activeFilters > 0 || debouncedQuery
                ? { label: 'Clear filters', onClick: clearAll }
                : { label: 'Post a Job', href: '/post' }
            }
          />
        ) : (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              {jobs.length} job{jobs.length === 1 ? '' : 's'}
              {hasNextPage ? ' so far' : ''}
            </p>

            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (
                <li key={job.id}>
                  <JobCard
                    job={job}
                    surface="explore"
                    saved={savedIds?.includes(job.id) ?? false}
                    onToggleSave={(jobId, nextSaved) =>
                      toggleSave.mutate(
                        { jobId, save: nextSaved },
                        {
                          onError: () =>
                            toast.error('Could not save that job. Check your connection.'),
                        },
                      )
                    }
                  />
                </li>
              ))}
            </ul>

            {hasNextPage ? (
              <div className="mt-10 flex justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Loading
                    </>
                  ) : (
                    'Load more jobs'
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
