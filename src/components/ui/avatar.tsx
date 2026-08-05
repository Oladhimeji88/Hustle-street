'use client'

import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn, avatarTint, initials } from '@/lib/utils'

/**
 * Avatar.
 *
 * The fallback is a deterministic colour derived from the user id, so a
 * pictureless profile still looks intentional and stays visually stable across
 * sessions and devices.
 */

const SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-20 text-xl',
  '2xl': 'size-28 text-3xl',
} as const

export interface AvatarProps {
  src?: string | null
  name?: string | null
  /** Used to pick the fallback colour. Pass the user id for stability. */
  seed?: string
  size?: keyof typeof SIZES
  className?: string
  /** Green ring + dot for "available now". */
  online?: boolean
  ring?: boolean
}

function Avatar({ src, name, seed, size = 'md', className, online, ring }: AvatarProps) {
  const label = name ?? 'User'

  return (
    <div className={cn('relative shrink-0', className)}>
      <AvatarPrimitive.Root
        className={cn(
          'relative flex shrink-0 overflow-hidden rounded-full',
          SIZES[size],
          ring && 'ring-2 ring-background',
        )}
      >
        {src && (
          <AvatarPrimitive.Image
            src={src}
            alt={label}
            className="aspect-square size-full object-cover"
            loading="lazy"
          />
        )}
        <AvatarPrimitive.Fallback
          delayMs={src ? 300 : 0}
          className={cn(
            'flex size-full items-center justify-center font-semibold',
            avatarTint(seed ?? label),
          )}
        >
          <span aria-hidden="true">{initials(name)}</span>
          <span className="sr-only">{label}</span>
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {online && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full bg-money ring-2 ring-background',
            size === 'xs' || size === 'sm' ? 'size-2' : size === 'md' ? 'size-2.5' : 'size-3.5',
          )}
        >
          <span className="sr-only">Available now</span>
        </span>
      )}
    </div>
  )
}

/** Overlapping avatars for "3 applicants" style summaries. */
function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
}: {
  people: Array<{ id: string; name?: string | null; avatarUrl?: string | null }>
  max?: number
  size?: keyof typeof SIZES
}) {
  const shown = people.slice(0, max)
  const overflow = people.length - shown.length

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((person) => (
        <Avatar
          key={person.id}
          src={person.avatarUrl}
          name={person.name}
          seed={person.id}
          size={size}
          ring
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground ring-2 ring-background',
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

export { Avatar, AvatarGroup }
