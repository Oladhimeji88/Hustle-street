'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Home, MessageSquare, Plus, User } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Mobile bottom navigation.
 *
 * Five destinations, with "Post" raised into a floating orange disc in the
 * middle. That centre slot is the single most valuable action in the product —
 * it should be reachable by thumb without looking, and it should look like a
 * button rather than a tab.
 *
 * Badges surface unread counts so a user never has to open a tab to discover
 * something is waiting.
 */

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Prefixes that should also light this tab up. */
  match: string[]
  badgeKey?: 'messages' | 'notifications'
}

const NAV_ITEMS: NavItem[] = [
  { href: '/home', label: 'Home', icon: Home, match: ['/home'] },
  { href: '/discover', label: 'Explore', icon: Compass, match: ['/discover', '/jobs', '/hustlers'] },
  { href: '/post', label: 'Post', icon: Plus, match: ['/post'] },
  {
    href: '/messages',
    label: 'Messages',
    icon: MessageSquare,
    match: ['/messages'],
    badgeKey: 'messages',
  },
  { href: '/profile', label: 'Profile', icon: User, match: ['/profile', '/settings', '/wallet'] },
]

export function BottomNav({
  unreadMessages = 0,
  unreadNotifications = 0,
}: {
  unreadMessages?: number
  unreadNotifications?: number
}) {
  const pathname = usePathname()

  const isActive = (item: NavItem) =>
    item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)
          const Icon = item.icon
          const isPost = item.href === '/post'

          const badge =
            item.badgeKey === 'messages'
              ? unreadMessages
              : item.badgeKey === 'notifications'
                ? unreadNotifications
                : 0

          if (isPost) {
            return (
              <li key={item.href} className="flex items-center">
                <Link
                  href={item.href}
                  aria-label="Post a job"
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'tap-target -mt-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-street transition-transform',
                    'focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    'active:scale-95',
                  )}
                >
                  <Plus className="size-7" strokeWidth={2.5} aria-hidden="true" />
                </Link>
              </li>
            )
          }

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'tap-target relative flex h-full flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="relative">
                  <Icon className="size-[22px]" aria-hidden="true" />
                  {badge > 0 && (
                    <span
                      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[9px] text-destructive-foreground"
                      aria-label={`${badge} unread`}
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                {item.label}
                {active && (
                  <span
                    className="absolute inset-x-4 top-0 h-0.5 bg-primary"
                    aria-hidden="true"
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
