'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@/components/ui/navigation'
import { LocationProvider } from '@/components/location/location-provider'
import { NetworkStatusWatcher } from '@/components/pwa/network-status'
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker'
import { createClient } from '@/lib/supabase/client'
import posthog from 'posthog-js'

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

function identifyUser(user: {
  id: string
  email?: string
  user_metadata: Record<string, unknown>
}) {
  const name =
    typeof user.user_metadata.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata.name === 'string'
        ? user.user_metadata.name
        : typeof user.user_metadata.display_name === 'string'
          ? user.user_metadata.display_name
          : undefined

  posthog.identify(user.id, {
    ...(user.email ? { email: user.email } : {}),
    ...(name ? { name } : {}),
  })
}

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  // One client for the browser session, created lazily so Suspense during the
  // initial render cannot throw the cache away.
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  React.useEffect(() => {
    const supabase = createClient()
    let identifiedUserId: string | null = null

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        identifiedUserId = null
        posthog.reset()
        return
      }

      if (!session?.user || (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN')) return

      // An account can change without a page reload (for example after an
      // account switch). Reset only then, preserving anonymous activity for a
      // normal first sign-in so PostHog can merge it into the known user.
      if (identifiedUserId && identifiedUserId !== session.user.id) {
        posthog.reset()
      }

      identifyUser(session.user)
      identifiedUserId = session.user.id
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
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
