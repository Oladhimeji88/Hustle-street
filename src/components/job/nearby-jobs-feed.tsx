'use client'

import * as React from 'react'
import { MapPinOff, Plus } from 'lucide-react'
import { useLocation } from '@/components/location/location-provider'
import { useJobFeed, useSavedJobIds, useToggleSaveJob } from '@/hooks/use-jobs'
import { JobCard } from './job-card'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback'
import { toast } from '@/components/ui/toast'

/**
 * "Jobs near you" on the home screen.
 *
 * Handles all four states the brief demands — loading, empty, error and
 * success — rather than rendering nothing while it waits.
 */
export function NearbyJobsFeed({ limit = 6 }: { limit?: number }) {
  const { coords, isResolved } = useLocation()
  const { data, isPending, isError, refetch } = useJobFeed({
    lat: coords.lat,
    lng: coords.lng,
    sort: 'nearest',
    pageSize: limit,
  })

  const { data: savedIds } = useSavedJobIds()
  const toggleSave = useToggleSaveJob()

  const jobs = data?.pages.flatMap((page) => page.data) ?? []

  if (isPending) return <ListSkeleton count={3} />

  if (isError) {
    return <ErrorState description="We could not load jobs near you." onRetry={() => void refetch()} />
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={<MapPinOff />}
        title="No jobs nearby yet"
        description={
          isResolved
            ? 'Nothing in your area right now. Try widening your search radius, or be the first to post.'
            : 'Set your location to see jobs around you.'
        }
        action={{ label: 'Post a job', href: '/post' }}
        secondaryAction={{ label: 'Widen search', href: '/discover?radiusKm=50' }}
      />
    )
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          surface="home-nearby"
          saved={savedIds?.includes(job.id)}
          onToggleSave={(jobId, nextSaved) => {
            toggleSave.mutate(
              { jobId, save: nextSaved },
              {
                onSuccess: () => {
                  if (nextSaved) toast.success('Saved', 'Find it later under Saved.')
                },
                onError: () => toast.error('Could not save that job'),
              },
            )
          }}
        />
      ))}

      <Button asChild variant="outline" block>
        <a href="/discover">See more jobs</a>
      </Button>
    </div>
  )
}

/** Compact home-screen strip used when there is nothing else to show. */
export function PostJobNudge() {
  return (
    <EmptyState
      icon={<Plus />}
      title="Need something done?"
      description="Post it and hustlers nearby will see it straight away. Posting is free."
      action={{ label: 'Post a job', href: '/post' }}
    />
  )
}
