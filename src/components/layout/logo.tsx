import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Wordmark.
 *
 * "Hustle" in ink, "Street" in the brand orange, with a small angled bar under
 * "Street" that reads as road marking. No icon file needed — it is type, so it
 * is crisp at every size and costs nothing to load.
 */
export function Logo({
  href = '/',
  size = 'md',
  className,
}: {
  href?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl sm:text-3xl',
  }

  const content = (
    <span
      className={cn(
        'relative inline-flex select-none items-baseline font-display font-extrabold tracking-tight',
        sizes[size],
        className,
      )}
    >
      <span className="text-foreground">Hustle</span>
      <span className="relative text-primary">
        Street
        <span
          className="absolute -bottom-0.5 left-0 h-[3px] w-full origin-left -skew-x-[20deg] rounded-full bg-primary/35"
          aria-hidden="true"
        />
      </span>
    </span>
  )

  if (!href) return content

  return (
    <Link href={href} className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring">
      {content}
      <span className="sr-only">Hustle Street home</span>
    </Link>
  )
}
