'use client'

import * as React from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/layout/logo'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'hs:install-dismissed'
const DISMISS_DAYS = 14

/**
 * Install prompt.
 *
 * Two paths, because iOS has no `beforeinstallprompt`: Android/desktop get the
 * native prompt, iOS Safari gets instructions for the Share → Add to Home
 * Screen flow. Both are deferred until the user has actually used the app —
 * asking someone to install before they know what it is converts badly and
 * burns the one-shot native prompt.
 */
export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = React.useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = React.useState(false)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    // Already installed — nothing to offer.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    if (standalone) return

    try {
      const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0)
      if (Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return
    } catch {
      // localStorage unavailable — carry on and show it.
    }

    function onBeforeInstall(event: Event) {
      event.preventDefault()
      setDeferredEvent(event as BeforeInstallPromptEvent)
      // Wait ~20s so the prompt lands after the user has seen something useful.
      setTimeout(() => setVisible(true), 20_000)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    const isSafari =
      /safari/i.test(window.navigator.userAgent) && !/chrome|crios|fxios/i.test(window.navigator.userAgent)

    if (isIos && isSafari) {
      setShowIosHint(true)
      setTimeout(() => setVisible(true), 25_000)
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferredEvent) return
    await deferredEvent.prompt()
    const { outcome } = await deferredEvent.userChoice
    if (outcome === 'accepted') {
      void fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'pwa_installed', properties: { platform: 'web' } }),
      })
    }
    setDeferredEvent(null)
    dismiss()
  }

  if (!visible || (!deferredEvent && !showIosHint)) return null

  return (
    <div
      role="dialog"
      aria-label="Install Hustle Street"
      className="fixed inset-x-3 z-50 animate-slide-up rounded-2xl border border-border bg-surface p-4 shadow-pop md:left-auto md:right-4 md:w-80"
      style={{ bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 0.75rem)' }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
      >
        <X className="size-4" />
      </button>

      <Logo href={null} size="sm" />

      {deferredEvent ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Add Hustle Street to your home screen for faster access and job alerts.
          </p>
          <Button size="sm" block className="mt-3" onClick={() => void install()}>
            <Download aria-hidden="true" />
            Install app
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Add Hustle Street to your home screen: tap{' '}
            <Share className="inline size-4 align-text-bottom" aria-label="Share" /> then{' '}
            <strong className="text-foreground">Add to Home Screen</strong>.
          </p>
          <Button size="sm" variant="ghost" block className="mt-3" onClick={dismiss}>
            Got it
          </Button>
        </>
      )}
    </div>
  )
}
