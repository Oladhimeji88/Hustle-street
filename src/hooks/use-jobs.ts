'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toSearchParams } from '@/lib/utils'
import type { ApiResponseBody } from '@/lib/api/response'
import type {
  HustlerSearchResult,
  JobRecommendation,
  JobSearchResult,
  SearchSuggestion,
} from '@/types/database'

/**
 * Data hooks.
 *
 * One place that knows how to talk to the API, so every screen gets the same
 * error handling, the same cache keys, and the same optimistic behaviour.
 */

/** Unwraps the API envelope, turning a failure into a thrown Error. */
async function request<T>(url: string, init?: RequestInit): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  const body = (await response.json()) as ApiResponseBody<T>

  if (!body.ok) {
    const error = new Error(body.error.message) as Error & { code?: string; status?: number }
    error.code = body.error.code
    error.status = response.status
    throw error
  }

  return { data: body.data, meta: body.meta }
}

export interface JobFilters {
  q?: string
  lat?: number
  lng?: number
  radiusKm?: number
  categories?: string[]
  minBudget?: number
  maxBudget?: number
  urgency?: string[]
  locationKind?: string[]
  minRating?: number
  postedWithinHours?: number
  sort?: string
  pageSize?: number
}

/** Infinite job feed. Page size stays modest — most people never scroll far. */
export function useJobFeed(filters: JobFilters) {
  return useInfiniteQuery({
    queryKey: ['jobs', filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const query = toSearchParams({ ...filters, page: pageParam })
      return request<JobSearchResult[]>(`/api/jobs?${query}`)
    },
    getNextPageParam: (lastPage, allPages) =>
      (lastPage.meta as { hasMore?: boolean } | undefined)?.hasMore ? allPages.length + 1 : undefined,
  })
}

export function useHustlerFeed(filters: Omit<JobFilters, 'urgency'> & { availableNow?: boolean; verifiedOnly?: boolean; skills?: string[] }) {
  return useInfiniteQuery({
    queryKey: ['hustlers', filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const query = toSearchParams({ ...filters, page: pageParam })
      return request<HustlerSearchResult[]>(`/api/hustlers?${query}`)
    },
    getNextPageParam: (lastPage, allPages) =>
      (lastPage.meta as { hasMore?: boolean } | undefined)?.hasMore ? allPages.length + 1 : undefined,
  })
}

export function useRecommendedJobs(enabled = true) {
  return useQuery({
    queryKey: ['recommended-jobs'],
    queryFn: async () => (await request<JobRecommendation[]>('/api/jobs/recommended')).data,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useSearchSuggestions(query: string) {
  return useQuery({
    queryKey: ['search-suggestions', query],
    queryFn: async () =>
      (await request<SearchSuggestion[]>(`/api/search/suggestions?q=${encodeURIComponent(query)}`)).data,
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  })
}

/**
 * Save / unsave a job.
 *
 * Optimistic: the bookmark fills instantly and rolls back if the request fails.
 * On a slow connection, waiting 800ms for a bookmark to respond feels broken.
 */
export function useToggleSaveJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ jobId, save }: { jobId: string; save: boolean }) => {
      await request(`/api/jobs/${jobId}/save`, { method: save ? 'POST' : 'DELETE' })
      return { jobId, save }
    },
    onMutate: async ({ jobId, save }) => {
      await queryClient.cancelQueries({ queryKey: ['saved-jobs'] })
      const previous = queryClient.getQueryData<string[]>(['saved-jobs'])

      queryClient.setQueryData<string[]>(['saved-jobs'], (current = []) =>
        save ? [...current, jobId] : current.filter((id) => id !== jobId),
      )

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['saved-jobs'], context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] })
    },
  })
}

export function useSavedJobIds() {
  return useQuery({
    queryKey: ['saved-jobs'],
    queryFn: async () => (await request<string[]>('/api/jobs/saved/ids')).data,
    staleTime: 5 * 60_000,
  })
}

export function useApplyToJob(jobId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      proposedPriceMinor: number
      message: string
      canStartAt?: string
      estimatedMinutes?: number
      skillIds?: string[]
    }) => (await request(`/api/jobs/${jobId}/applications`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      void queryClient.invalidateQueries({ queryKey: ['my-applications'] })
    },
  })
}

export { request as apiRequest }
