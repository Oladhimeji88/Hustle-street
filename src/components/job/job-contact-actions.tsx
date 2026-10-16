'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquare, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import type { ApiResponseBody } from '@/lib/api/response'

interface ContactPayload {
  name: string
  phone: string
  verified: boolean
}

/**
 * Call and message actions on a job card.
 *
 * ── Why the number is not already here ──────────────────────────────────────
 *
 * The obvious build is a `tel:` link with the poster's number baked into the
 * card. That would mean shipping every poster's phone number inside a public,
 * unauthenticated listing — scrapeable in one request, and flatly contrary to
 * what the safety page promises ("Your phone number: Never shown"). It would
 * also route negotiation off-platform, where a dispute cannot reach it.
 *
 * So the number is fetched on tap from `/api/jobs/:id/contact`, which hands it
 * over only to the poster or the hired hustler on a live assignment. When the
 * caller is not entitled, the API's own message explains why and the user is
 * pushed toward messaging, which is the channel that works at that stage.
 *
 * ── Why `location.href` and not a rendered <a href="tel:"> ──────────────────
 *
 * The number does not exist until the request resolves, so there is nothing to
 * put in an href at render time. Assigning `location.href` to a `tel:` URL is
 * what opens the dialer with the digits already entered, which is the "copy
 * their digits to the phone" behaviour — on desktop, where no handler exists,
 * that silently does nothing, so the number is copied to the clipboard and
 * shown in a toast instead.
 */
export function JobContactActions({
  jobId,
  posterName,
  className,
}: {
  jobId: string
  posterName: string
  className?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  // Coarse pointer with no hover is the reliable "this is a phone" signal;
  // `navigator.userAgent` sniffing gets this wrong on tablets and desktops in
  // tablet mode.
  const isDialerDevice = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches

  const handleCall = async (event: React.MouseEvent) => {
    // The whole card is a link; these buttons sit above it and must not follow it.
    event.preventDefault()
    event.stopPropagation()
    if (loading) return

    setLoading(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}/contact`)
      const body = (await response.json()) as ApiResponseBody<ContactPayload>

      if (!body.ok) {
        if (response.status === 401) {
          toast.error('Log in to contact this person.')
          router.push(`/login?next=/jobs/${jobId}`)
          return
        }
        // 403/404 carry a human explanation from the route; show it verbatim
        // rather than inventing a generic failure message.
        toast.error(body.error.message)
        return
      }

      const { phone, name } = body.data

      if (isDialerDevice()) {
        window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`
        return
      }

      await navigator.clipboard.writeText(phone)
      toast.success(`${name}'s number copied: ${phone}`)
    } catch {
      toast.error('Could not reach the server. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleMessage = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    router.push(`/jobs/${jobId}?action=message`)
  }

  return (
    <div className={cn('relative z-10 flex items-center gap-1.5', className)}>
      <button
        type="button"
        onClick={handleMessage}
        aria-label={`Message ${posterName} about this job`}
        className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <MessageSquare className="size-[17px]" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={handleCall}
        disabled={loading}
        aria-label={`Call ${posterName} about this job`}
        className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-[17px] animate-spin" aria-hidden="true" />
        ) : (
          <Phone className="size-[17px]" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
