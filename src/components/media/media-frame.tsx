import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Image presentation for marketing surfaces.
 *
 * Everything here exists to stop the two failure modes that make a media-heavy
 * landing page feel cheap on a slow connection:
 *
 *  - **Layout shift.** Every frame declares its aspect ratio up front, so the
 *    page never jumps as images arrive.
 *  - **Flashes of empty space.** A tinted placeholder sits behind each image,
 *    so a half-loaded page still looks composed rather than broken.
 */

const ASPECTS = {
  square: 'aspect-square',
  video: 'aspect-video',
  portrait: 'aspect-[3/4]',
  tall: 'aspect-[9/16]',
  wide: 'aspect-[16/10]',
  ultrawide: 'aspect-[2/1]',
} as const

export interface MediaFrameProps {
  src: string
  /**
   * Empty string marks the image as decorative. Anything that carries meaning
   * must describe what it shows, not repeat the nearby heading.
   */
  alt: string
  aspect?: keyof typeof ASPECTS
  sizes?: string
  priority?: boolean
  className?: string
  imageClassName?: string
  /** Soft brand tint behind the image while it loads. */
  tint?: 'primary' | 'money' | 'accent' | 'neutral'
  rounded?: 'lg' | 'xl' | '2xl' | '3xl'
  caption?: React.ReactNode
}

export function MediaFrame({
  src,
  alt,
  aspect = 'wide',
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority,
  className,
  imageClassName,
  tint = 'neutral',
  rounded = '2xl',
  caption,
}: MediaFrameProps) {
  const tints = {
    primary: 'bg-primary-soft',
    money: 'bg-money-soft',
    accent: 'bg-accent/10',
    neutral: 'bg-surface-muted',
  }

  const radii = {
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl',
  }

  const frame = (
    <div
      className={cn(
        'relative overflow-hidden border border-border',
        ASPECTS[aspect],
        tints[tint],
        radii[rounded],
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        className={cn('object-cover', imageClassName)}
      />
    </div>
  )

  if (!caption) return frame

  return (
    <figure className="m-0">
      {frame}
      <figcaption className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  )
}

/**
 * Phone mockup.
 *
 * The device frame is drawn in CSS rather than shipped as a PNG overlay, so it
 * stays crisp at any density and adapts to light/dark without a second asset.
 */
export function PhoneMockup({
  src,
  alt,
  className,
  priority,
  tilt,
}: {
  src: string
  alt: string
  className?: string
  priority?: boolean
  tilt?: 'left' | 'right'
}) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[280px] transition-transform duration-500',
        tilt === 'left' && 'lg:-rotate-3',
        tilt === 'right' && 'lg:rotate-3',
        className,
      )}
    >
      {/* Device body */}
      <div className="relative rounded-[2.6rem] border-[10px] border-ink bg-ink p-0 shadow-pop">
        {/* Screen */}
        <div className="relative aspect-[390/844] overflow-hidden rounded-[2rem] bg-background">
          <Image
            src={src}
            alt={alt}
            fill
            sizes="280px"
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            className="object-cover object-top"
          />
        </div>

        {/* Dynamic-island style cutout */}
        <div
          className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-ink"
          aria-hidden="true"
        />
      </div>

      {/* Grounding shadow so the device does not float on a flat background */}
      <div
        className="absolute inset-x-6 -bottom-4 h-8 rounded-[50%] bg-foreground/20 blur-xl"
        aria-hidden="true"
      />
    </div>
  )
}

/**
 * Story card — a portrait video/photo with the person's details over it.
 * Used for the hustler testimonials.
 */
export function StoryCard({
  poster,
  name,
  trade,
  area,
  quote,
  className,
}: {
  poster: string
  name: string
  trade: string
  area: string
  quote: string
  className?: string
}) {
  return (
    <figure className={cn('m-0', className)}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-surface-muted">
        <Image
          src={poster}
          alt={`${name}, ${trade} in ${area}`}
          fill
          sizes="(max-width: 768px) 80vw, 33vw"
          loading="lazy"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="font-display text-lg font-bold text-white">{name}</p>
          <p className="text-sm font-semibold text-primary">{trade}</p>
          <p className="text-xs text-white/60">{area}</p>
        </div>
      </div>

      <figcaption className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
        <q className="italic">{quote}</q>
      </figcaption>
    </figure>
  )
}
