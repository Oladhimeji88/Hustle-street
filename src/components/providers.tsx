'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@/components/ui/navigation'
import { LocationProvider } from '@/components/location/location-provider'
import { NetworkStatusWatcher } from '@/components/pwa/network-status'
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker'

/**
 * Client-side providers.
 *
 * Query defaults are tuned for the reality of Nigerian mobile networks: retry
 * once (a second failure usually means the connection is genuinely down, and
 * retrying burns data), keep data fresh for a minute so navigating back does
 * not refetch, and never refetch on window focus — on mobile that fires every
 * time the user switches apps.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          // Do not retry a 4xx: the request was wrong, not unlucky.
          const status = (error as { status?: number })?.status
          if (status && status >= 400 && status < 500) return false
          return failureCount < 1
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  // One client for the browser session, created lazily so Suspense during the
  // initial render cannot throw the cache away.
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {/* Light only. `forcedTheme` rather than `defaultTheme` on purpose: it
          overrides a `theme: dark` already sitting in localStorage from an
          earlier visit, which a default alone would not. There is no theme
          toggle anywhere in the app, so nothing loses functionality. */}
      <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
        <TooltipProvider delayDuration={300}>
          <LocationProvider>
            {children}
            <NetworkStatusWatcher />
            <ServiceWorkerRegistrar />
          </LocationProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
