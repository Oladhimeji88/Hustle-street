'use client'

import * as React from 'react'
import { ChevronDown, Crosshair, MapPin, Search } from 'lucide-react'
import { useLocation } from './location-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/feedback'
import { toast } from '@/components/ui/toast'
import type { Coordinates } from '@/lib/geo'

interface LocationSuggestion {
  id: string
  name: string
  kind: string
  lat: number
  lng: number
  parent: string | null
}

/**
 * Location switcher.
 *
 * Three ways in, because one is never enough: use my device, search an area, or
 * pick from the areas we already know about. The last one is what makes this
 * work on a laptop in an office where GPS is meaningless.
 */
export function LocationBar() {
  const { label, source, locating, requestDeviceLocation, setManualLocation } = useLocation()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<LocationSuggestion[]>([])
  const [searching, setSearching] = React.useState(false)

  // Debounced area search against our own locations table.
  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/locations?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        const body = await response.json()
        if (body.ok) setResults(body.data)
      } catch {
        /* aborted or offline */
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  async function applyDeviceLocation() {
    const granted = await requestDeviceLocation()
    if (granted) {
      toast.success('Location updated', 'Showing jobs around you.')
      setOpen(false)
    } else {
      toast.error(
        'Could not get your location',
        'Allow location access in your browser settings, or search for your area instead.',
      )
    }
  }

  function choose(suggestion: LocationSuggestion) {
    const coords: Coordinates = { lat: suggestion.lat, lng: suggestion.lng }
    setManualLocation(coords, suggestion.name)
    toast.success(`Showing jobs in ${suggestion.name}`)
    setOpen(false)
    setQuery('')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-primary/40"
        >
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate font-medium">{label}</span>
          {source === 'default' && (
            <span className="shrink-0 text-xs text-muted-foreground">(set location)</span>
          )}
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="max-h-[80dvh]">
        <SheetHeader>
          <SheetTitle>Where are you?</SheetTitle>
          <SheetDescription>
            We use this to show jobs and hustlers near you. Your exact location is never made public.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="pt-4">
          <Button
            variant="outline"
            block
            size="lg"
            loading={locating}
            loadingText="Finding you…"
            onClick={() => void applyDeviceLocation()}
          >
            <Crosshair aria-hidden="true" />
            Use my current location
          </Button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              or search
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Lekki, Ikeja, Wuse II…"
            leadingIcon={<Search />}
            autoComplete="off"
          />

          <div className="mt-3 min-h-[200px]">
            {searching && <Spinner label="Searching…" className="py-4" />}

            {!searching && query.length >= 2 && results.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No areas matched &ldquo;{query}&rdquo;.
              </p>
            )}

            <ul className="space-y-1">
              {results.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    onClick={() => choose(suggestion)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary"
                  >
                    <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{suggestion.name}</span>
                      {suggestion.parent && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {suggestion.parent}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
