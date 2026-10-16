'use client'

import * as React from 'react'
import { Bell, X } from 'lucide-react'
import { publicEnv } from '@/lib/config/env'
import { urlBase64ToUint8Array } from '@/lib/notifications/vapid'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'

const DISMISS_KEY = 'hs:push-dismissed'
const DISMISS_DAYS = 30

/**
 * Push permission prompt.
 *
 * Never fires `Notification.requestPermission()` on load. Browsers permanently
 * block a site the moment a user hits "Deny", so the native prompt is only
 * triggered from an explicit tap on our own soft prompt — and only after the
 * user has been in the app long enough to know why they'd want it.
 */
export function PushPermissionPrompt() {
  const [visible, setVisible] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return
    // Already decided, either way.
    if (Notification.permission !== 'default') return

    try {
      const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0)
      if (Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return
    } catch {
      /* ignore */
    }

    const timer = setTimeout(() => setVisible(true), 45_000)
    return () => clearTimeout(timer)
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }

  async function enable() {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        dismiss()
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })

      const json = subscription.toJSON() as {
        endpoint?: string
        keys?: { p256dh?: string; auth?: string }
      }

      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      })

      if (!response.ok) throw new Error('subscribe failed')

      toast.success('Alerts on', "We'll let you know when a job lands near you.")
      dismiss()
    } catch {
      toast.error('Could not turn on alerts', 'Please try again from Settings.')
      setVisible(false)
    } finally {
      setBusy(false)
    }
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Enable notifications"
      className="fixed inset-x-3 z-50 animate-slide-up rounded-2xl border border-border bg-surface p-4 shadow-pop md:left-auto md:right-4 md:w-80"
      style={{ bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 0.75rem)' }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
      >
        <X className="size-4" />
      </button>

      <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-text">
        <Bell className="size-5" aria-hidden="true" />
      </div>

      <p className="mt-2.5 font-display text-sm font-medium">Never miss a job</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Get alerted when a job lands near you, or when someone replies.
      </p>

      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1" loading={busy} onClick={() => void enable()}>
          Turn on alerts
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  )
}
