'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Bookmark,
  Briefcase,
  Compass,
  FileText,
  HelpCircle,
  Home,
  MessageSquare,
  Plus,
  Settings,
  Shield,
  User,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { Button } from '@/components/ui/button'
import type { UserRole } from '@/types/database'

/**
 * Desktop sidebar.
 *
 * Not a stretched version of the mobile nav — desktop has room for the full
 * information architecture, so secondary destinations (wallet, saved,
 * applications) get first-class links instead of hiding behind a profile menu.
 */

const SECTIONS: Array<{
  label?: string
  items: Array<{
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    badgeKey?: 'messages' | 'notifications'
  }>
}> = [
  {
    items: [
      { href: '/home', label: 'Home', icon: Home },
      { href: '/discover', label: 'Discover', icon: Compass },
      { href: '/messages', label: 'Messages', icon: MessageSquare, badgeKey: 'messages' },
      { href: '/notifications', label: 'Notifications', icon: Bell, badgeKey: 'notifications' },
    ],
  },
  {
    label: 'Work',
    items: [
      { href: '/my-jobs', label: 'My jobs', icon: Briefcase },
      { href: '/applications', label: 'Applications', icon: FileText },
      { href: '/saved', label: 'Saved', icon: Bookmark },
    ],
  },
  {
    label: 'Money',
    items: [{ href: '/wallet', label: 'Wallet', icon: Wallet }],
  },
  {
    label: 'Account',
    items: [
      { href: '/profile', label: 'Profile', icon: User },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/help', label: 'Help', icon: HelpCircle },
    ],
  },
]

export function AppSidebar({
  roles = [],
  unreadMessages = 0,
  unreadNotifications = 0,
}: {
  roles?: UserRole[]
  unreadMessages?: number
  unreadNotifications?: number
}) {
  const pathname = usePathname()
  const isStaff = roles.some((role) => role === 'moderator' || role === 'admin' || role === 'superadmin')

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface md:flex xl:w-72">
      <div className="px-5 py-5">
        <Logo />
      </div>

      <div className="px-4 pb-4">
        <Button asChild block size="md">
          <Link href="/post">
            <Plus aria-hidden="true" />
            Post a Job
          </Link>
        </Button>
      </div>

      <nav aria-label="Sidebar" className="flex-1 overflow-y-auto px-3 pb-6">
        {SECTIONS.map((section, index) => (
          <div key={section.label ?? index} className={cn(index > 0 && 'mt-5')}>
            {section.label && (
              <h2 className="eyebrow px-3 pb-1.5">
                {section.label}
              </h2>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon
                const badge =
                  item.badgeKey === 'messages'
                    ? unreadMessages
                    : item.badgeKey === 'notifications'
                      ? unreadNotifications
                      : 0

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        active
                          ? 'bg-primary-soft text-primary'
                          : 'text-foreground/75 hover:bg-secondary hover:text-foreground',
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 font-mono text-[10px] text-destructive-foreground">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {isStaff && (
          <div className="mt-5 border-t border-border pt-4">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Shield className="size-[18px] shrink-0" aria-hidden="true" />
              Admin
            </Link>
          </div>
        )}
      </nav>
    </aside>
  )
}
