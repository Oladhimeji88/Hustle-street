'use client'

import * as React from 'react'
import { Camera, CameraOff, Check, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Liveness capture.
 *
 * ── What this is, and what it is not ────────────────────────────────────────
 *
 * This captures a frame with a short prompted action in front of it. It is a
 * *deterrent*, not a defence. Real anti-spoofing — telling a live face from a
 * printed photo or a phone held up to the lens — is done server-side by the
 * verification provider using depth, texture and reflectance cues that a
 * browser cannot see.
 *
 * The prompts below make casual replay attacks inconvenient. They do not stop a
 * determined one, and no client-side check ever will, because the client is
 * controlled by whoever is trying to defeat it. Everything here exists to give
 * the provider a usable frame and to make the user's part of it legible.
 *
 * ── Camera handling ─────────────────────────────────────────────────────────
 *
 * The stream is stopped on unmount and after capture. A `getUserMedia` stream
 * that is not explicitly stopped keeps the camera light on, which reads to the
 * user as the site still watching them.
 */

const PROMPTS = ['Look straight ahead', 'Turn your head slightly left', 'Now smile'] as const

export function LivenessCapture({
  onCapture,
  disabled,
}: {
  onCapture: (dataUrl: string | null) => void
  disabled?: boolean
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [state, setState] = React.useState<'idle' | 'live' | 'captured' | 'denied' | 'unsupported'>(
    'idle',
  )
  const [prompt, setPrompt] = React.useState(0)
  const [preview, setPreview] = React.useState<string | null>(null)

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Always release the camera when this leaves the screen.
  React.useEffect(() => stop, [stop])

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPrompt(0)
      setState('live')
    } catch {
      // Denied, or no camera. Both are the same dead end for the user.
      setState('denied')
    }
  }

  function capture() {
    const video = videoRef.current
    if (!video) return

    // Square crop from the centre: providers expect a face-centred frame, and
    // cropping here avoids shipping the rest of the room to a third party.
    const size = Math.min(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      size,
      size,
    )

    // 0.82 keeps the frame comfortably inside the 1.5MB cap the schema enforces
    // while leaving enough detail for a face match.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    setPreview(dataUrl)
    setState('captured')
    stop()
    onCapture(dataUrl)
  }

  function retake() {
    setPreview(null)
    onCapture(null)
    void start()
  }

  return (
    <div>
      <div className="relative aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl border border-border bg-surface-muted">
        {state === 'captured' && preview ? (
          /* A data: URL straight from the camera. next/image cannot optimise a
             data URL, so routing it through <Image> would add a layer and
             change nothing. The directive must be the immediately preceding
             line to apply, hence the block comment above rather than below. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Your liveness capture" className="size-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            // Mirrored, because an un-mirrored self-view makes people move the
            // wrong way when asked to turn their head.
            className="size-full scale-x-[-1] object-cover"
          />
        )}

        {state === 'idle' || state === 'denied' || state === 'unsupported' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {state === 'denied' || state === 'unsupported' ? (
              <CameraOff className="size-6 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Camera className="size-6 text-muted-foreground" aria-hidden="true" />
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {state === 'denied'
                ? 'Camera access was blocked. Allow it in your browser settings and try again.'
                : state === 'unsupported'
                  ? 'This browser cannot access a camera. Try Chrome or Safari on your phone.'
                  : 'We need a quick photo to confirm you are a real person.'}
            </p>
          </div>
        ) : null}

        {state === 'captured' ? (
          <span className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md bg-money text-white">
            <Check className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {state === 'live' ? (
        <p className="mt-3 text-sm font-medium" aria-live="polite">
          {PROMPTS[prompt]}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {state === 'idle' || state === 'denied' || state === 'unsupported' ? (
          <Button
            type="button"
            variant="ink"
            size="sm"
            className="rounded-full"
            onClick={() => void start()}
            disabled={disabled || state === 'unsupported'}
          >
            <Camera aria-hidden="true" />
            {state === 'denied' ? 'Try again' : 'Start camera'}
          </Button>
        ) : null}

        {state === 'live' ? (
          prompt < PROMPTS.length - 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setPrompt((p) => p + 1)}
            >
              Done, next
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={capture}
              disabled={disabled}
            >
              Capture
            </Button>
          )
        ) : null}

        {state === 'captured' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={retake}
            disabled={disabled}
          >
            <RefreshCw aria-hidden="true" />
            Retake
          </Button>
        ) : null}
      </div>
    </div>
  )
}
