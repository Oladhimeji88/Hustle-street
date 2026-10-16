'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/ui/toast'

/**
 * Network status watcher.
 *
 * `navigator.onLine` lies constantly — it reports true when a phone is
 * connected to a Wi-Fi access point with no working internet behind it, which
 * is an extremely common failure mode. So going *offline* is trusted (that
 * signal is reliable) but coming back *online* is verified with a real request
 * before we tell the user or refetch anything.
 */
export function NetworkStatusWatcher() {
  const queryClient = useQueryClient()
  const wasOffline = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false

    async function verifyConnectivity(): Promise<boolean> {
      try {
        const response = await fetch('/api/health', {
          method: 'HEAD',
          cache: 'no-store',
          signal: AbortSignal.timeout(5_000),
        })
        return response.ok
      } catch {
        return false
      }
    }

    function handleOffline() {
      if (cancelled || wasOffline.current) return
      wasOffline.current = true
      toast.offline()
    }

    async function handleOnline() {
      if (cancelled || !wasOffline.current) return

      const reachable = await verifyConnectivity()
      if (cancelled || !reachable) return

      wasOffline.current = false
      toast.backOnline()
      // Pull anything that went stale while the connection was down.
      void queryClient.invalidateQueries()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', () => void handleOnline())

    // Catch the case where the app loads already offline.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) handleOffline()

    return () => {
      cancelled = true
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', () => void handleOnline())
    }
  }, [queryClient])

  return null
}

/** Hook version for components that need to render an offline-aware state. */
export function useIsOnline(): boolean {
  const [online, setOnline] = React.useState(true)

  React.useEffect(() => {
    setOnline(navigator.onLine)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return online
}
