'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, SlidersHorizontal, X } from 'lucide-react'
import { useHustlerFeed } from '@/hooks/use-jobs'
import { useLocation } from '@/components/location/location-provider'
import { HustlerCard } from './hustler-card'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback'

interface CategoryOption {
  id: string
  name: string
}

const SORTS = [
  { value: 'rating', label: 'Best rated' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'jobs', label: 'Most jobs done' },
] as const

/**
 * The hustler directory behind /hustlers.
 *
 * Mirrors JobBrowser's filter model deliberately — the two surfaces answer the
 * same question from opposite sides, and a poster who has already used /explore
 * should not have to learn a second set of controls.
 */
export function HustlerBrowser({ categories }: { categories: CategoryOption[] }) {
  const params = useSearchParams()
  const { coords, isResolved } = useLocation()

  const [query, setQuery] = React.useState(() => params.get('q') ?? '')
  const [selected, setSelected] = React.useState<string[]>(() => {
    const raw = params.get('categories')
    return raw ? raw.split(',').filter(Boolean) : []
  })
  const [sort, setSort] = React.useState<string>('rating')
  const [verifiedOnly, setVerifiedOnly] = React.useState(false)
  const [availableNow, setAvailableNow] = React.useState(false)

  const [debouncedQuery, setDebouncedQuery] = React.useState(query)
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 350)
    return () => window.clearTimeout(id)
  }, [query])

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useHustlerFeed({
      q: debouncedQuery || undefined,
      lat: isResolved ? coords.lat : undefined,
      lng: isResolved ? coords.lng : undefined,
      categories: selected.length ? selected : undefined,
      verifiedOnly: verifiedOnly || undefined,
      availableNow: availableNow || undefined,
      sort,
      pageSize: 12,
    })

  const hustlers = data?.pages.flatMap((page) => page.data) ?? []
  const activeFilters = selected.length + (verifiedOnly ? 1 : 0) + (availableNow ? 1 : 0)

  const toggleCategory = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))

  const clearAll = () => {
    setSelected([])
    setVerifiedOnly(false)
    setAvailableNow(false)
    setQuery('')
  }

  return (
    <div>
      <div className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="hustler-search" className="sr-only">
              Search hustlers
            </label>
            <input
              id="hustler-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Plumber, photographer, tutor…"
              className="h-12 w-full rounded-full border border-input bg-background px-5 text-[15px] transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/20 focus:outline-none focus:ring-4 focus:ring-foreground/5"
            />
          </div>

          <label htmlFor="hustler-sort" className="sr-only">
            Sort hustlers
          </label>
          <select
            id="hustler-sort"
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

        <div className="rail mt-4 -mx-1 px-1">
          <Chip selected={availableNow} onClick={() => setAvailableNow((v) => !v)}>
            Available now
          </Chip>
          <Chip selected={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)}>
            ID verified
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

        {activeFilters > 0 ? (
          <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              {activeFilters} filter{activeFilters === 1 ? '' : 's'} active
            </p>
            <Button variant="ghost" size="xs" onClick={clearAll} className="ml-auto">
              <X aria-hidden="true" />
              Clear
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-8">
        {isPending ? (
          <ListSkeleton count={6} />
        ) : isError ? (
          <ErrorState
            description="We could not load hustlers right now."
            onRetry={() => void refetch()}
          />
        ) : hustlers.length === 0 ? (
          <EmptyState
            title="Nobody matches yet"
            description={
              activeFilters > 0 || debouncedQuery
                ? 'Try removing a filter or searching for something broader.'
                : 'No hustlers have signed up in this area yet. Post a job and we will notify people as they join.'
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
              {hustlers.length} hustler{hustlers.length === 1 ? '' : 's'}
              {hasNextPage ? ' so far' : ''}
            </p>

            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {hustlers.map((hustler) => (
                <li key={hustler.id}>
                  <HustlerCard hustler={hustler} />
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
                    'Load more hustlers'
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
