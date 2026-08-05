'use client'

import * as React from 'react'
import { toast } from '@/components/ui/toast'

/**
 * Service worker registration + update prompt.
 *
 * A PWA that silently swaps its shell mid-session is worse than one that never
 * updates: people lose what they were typing. So a waiting worker prompts
 * instead of taking over, and only activates when the user says so.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    // A worker registered from a dev server caches half-built assets and makes
    // local development deeply confusing.
    if (process.env.NODE_ENV !== 'production') return

    let registration: ServiceWorkerRegistration | undefined

    function promptForUpdate(waiting: ServiceWorker) {
      toast.update('Update available', 'Reload to get the latest version of Hustle Street.', () => {
        // The worker skips waiting and takes control; `controllerchange` below
        // then reloads the page exactly once.
        waiting.postMessage({ type: 'SKIP_WAITING' })
      })
    }

    async function register() {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

        if (registration.waiting) promptForUpdate(registration.waiting)

        registration.addEventListener('updatefound', () => {
          const installing = registration?.installing
          if (!installing) return

          installing.addEventListener('statechange', () => {
            // `controller` is null on the very first install — that is not an
            // update, it is the app becoming installable, so stay quiet.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              promptForUpdate(installing)
            }
          })
        })

        // Check for a new deploy when the app is brought back to the foreground.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration?.update()
        })
      } catch (error) {
        console.warn('[pwa] service worker registration failed', error)
      }
    }

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    void register()
  }, [])

  return null
}
