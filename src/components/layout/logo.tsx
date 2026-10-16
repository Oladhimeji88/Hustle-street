import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * The mark and wordmark.
 *
 * Rebuilt around the same idea Mistral's identity uses: a mark made of flat,
 * stacked colour bands, set beside a wordmark in plain ink. Three things follow
 * from that split, and all three are deliberate.
 *
 * The mark carries the colour, so the wordmark does not have to. The previous
 * version set "Street" in orange, which measures 3.12:1 on paper — under AA for
 * text at this size. Moving the brand colour into a non-text element means the
 * palette can stay full-strength and the words stay at 17:1.
 *
 * The bands step through the brand ramp — sun, tangerine, orange — rather than
 * fading. A gradient would be the one soft edge in a system with no soft edges.
 *
 * Widths are ragged rather than equal, which reads as a bar chart climbing: the
 * closest thing to "hustle" the geometry can say on its own. On hover the stack
 * squares up, every band running to full width.
 */
export function Logo({
  href = '/',
  size = 'md',
  className,
  /** Set on an ink panel, where the wordmark has to invert. */
  invert = false,
}: {
  href?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  invert?: boolean
}) {
  const type = {
    sm: 'text-[0.9375rem]',
    md: 'text-[1.0625rem]',
    lg: 'text-xl sm:text-2xl',
  }

  const markHeight = {
    sm: 'h-[15px] w-[15px]',
    md: 'h-[17px] w-[17px]',
    lg: 'h-[22px] w-[22px]',
  }

  const BANDS = [
    { color: 'bg-sun', width: 'w-1/2' },
    { color: 'bg-sun', width: 'w-full' },
    { color: 'bg-tangerine', width: 'w-2/3' },
    { color: 'bg-primary', width: 'w-full' },
    { color: 'bg-primary', width: 'w-1/3' },
  ]

  const content = (
    <span
      className={cn(
        'group inline-flex select-none items-center gap-2 font-display font-medium tracking-[-0.02em]',
        type[size],
        className,
      )}
    >
      {/* Flat bands, no radius, 1px gaps. The gaps are the paper showing
          through, so the mark stays part of the grid rather than sitting on it. */}
      <span
        className={cn('flex shrink-0 flex-col justify-between', markHeight[size])}
        aria-hidden="true"
      >
        {BANDS.map((band, index) => (
          <span
            key={index}
            className={cn(
              'block h-[2px] transition-[width] duration-300 ease-out-quart group-hover:w-full',
              band.color,
              band.width,
            )}
          />
        ))}
      </span>

      <span className={invert ? 'text-ink-foreground' : 'text-foreground'}>Hustle Street</span>
    </span>
  )

  if (!href) return content

  return (
    <Link href={href} className="inline-flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {content}
      <span className="sr-only">Hustle Street home</span>
    </Link>
  )
}
