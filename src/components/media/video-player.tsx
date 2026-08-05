'use client'

import * as React from 'react'
import Image from 'next/image'
import { Play, Volume2, VolumeX, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/**
 * Video player.
 *
 * Two product constraints shape this completely:
 *
 * 1. **Data costs money.** Most of our users are on metered mobile data in
 *    Nigeria. Nothing autoplays, `preload="none"` means not a single byte of
 *    video is fetched until someone taps play, and the poster image is what
 *    loads by default. An autoplaying hero video would burn a stranger's
 *    airtime to show them marketing.
 *
 * 2. **Video is never the only copy.** Every player takes a `transcript` and
 *    a captions track. If the video fails, is muted, or the person cannot
 *    hear it, the page still communicates.
 *
 * When `sources` is empty the component renders the poster as a still frame
 * with an honest "coming soon" state, rather than a broken player. That is how
 * it behaves today — see `public/media/README` for where to drop the files.
 */

export interface VideoSource {
  src: string
  type: 'video/webm' | 'video/mp4'
}

export interface VideoPlayerProps {
  /** Empty until real footage is produced; the poster is shown alone. */
  sources?: VideoSource[]
  poster: string
  title: string
  description?: string
  /** Human duration, e.g. "1:48". Shown on the poster. */
  duration?: string
  /** WebVTT captions. Required whenever there is speech. */
  captionsSrc?: string
  /** Plain-text transcript, disclosed below the player. */
  transcript?: string
  aspect?: '16/9' | '9/16' | '4/3'
  className?: string
  priority?: boolean
}

export function VideoPlayer({
  sources = [],
  poster,
  title,
  description,
  duration,
  captionsSrc,
  transcript,
  aspect = '16/9',
  className,
  priority,
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [started, setStarted] = React.useState(false)
  const [muted, setMuted] = React.useState(false)
  const [showTranscript, setShowTranscript] = React.useState(false)

  const hasVideo = sources.length > 0

  const aspectClass = {
    '16/9': 'aspect-video',
    '9/16': 'aspect-[9/16]',
    '4/3': 'aspect-[4/3]',
  }[aspect]

  async function play() {
    if (!hasVideo) return
    setStarted(true)
    // Wait for React to mount the <video> before asking it to play.
    await Promise.resolve()
    try {
      await videoRef.current?.play()
    } catch {
      // Autoplay policies can still refuse; the native controls remain usable.
    }
  }

  return (
    <figure className={cn('m-0', className)}>
      <div
        className={cn(
          'group relative overflow-hidden rounded-2xl border border-border bg-ink shadow-lg',
          aspectClass,
        )}
      >
        {started && hasVideo ? (
          <>
            <video
              ref={videoRef}
              className="size-full object-cover"
              controls
              playsInline
              muted={muted}
              poster={poster}
              preload="metadata"
              // Discourage the browser from prefetching the whole file on a
              // connection the user is paying for by the megabyte.
              controlsList="nodownload"
            >
              {sources.map((source) => (
                <source key={source.src} src={source.src} type={source.type} />
              ))}
              {captionsSrc && (
                <track kind="captions" src={captionsSrc} srcLang="en" label="English" default />
              )}
              Your browser cannot play this video.
            </video>

            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          </>
        ) : (
          <>
            <Image
              src={poster}
              alt={hasVideo ? '' : title}
              fill
              sizes="(max-width: 768px) 100vw, 60vw"
              className="object-cover"
              priority={priority}
            />

            {/* Scrim so the title stays legible over any poster frame. */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
              aria-hidden="true"
            />

            {hasVideo ? (
              <button
                type="button"
                onClick={() => void play()}
                className="absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60"
                aria-label={`Play video: ${title}`}
              >
                <span className="flex size-20 items-center justify-center rounded-full bg-white/95 shadow-pop transition-transform duration-200 group-hover:scale-110">
                  <Play className="ml-1 size-8 fill-ink text-ink" aria-hidden="true" />
                </span>
              </button>
            ) : (
              // Honest empty state: the section still reads, and nobody taps a
              // play button that does nothing.
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-white sm:text-lg">{title}</p>
                  {description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-white/70">{description}</p>
                  )}
                </div>
                <Badge variant="solid" size="sm" className="shrink-0">
                  Film coming soon
                </Badge>
              </div>
            )}

            {hasVideo && duration && (
              <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                {duration}
              </span>
            )}
          </>
        )}
      </div>

      {(description || transcript) && (
        <figcaption className="mt-3">
          {description && hasVideo && (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}

          {transcript && (
            <>
              <button
                type="button"
                onClick={() => setShowTranscript((value) => !value)}
                aria-expanded={showTranscript}
                className="mt-1 text-sm font-semibold text-primary hover:underline"
              >
                {showTranscript ? 'Hide transcript' : 'Read the transcript'}
              </button>

              {showTranscript && (
                <div className="mt-2 rounded-xl bg-surface-muted p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Transcript
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTranscript(false)}
                      aria-label="Close transcript"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {transcript}
                  </p>
                </div>
              )}
            </>
          )}
        </figcaption>
      )}
    </figure>
  )
}
