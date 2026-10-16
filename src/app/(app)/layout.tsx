import { redirect } from 'next/navigation'
import { createClient, getCurrentProfile, getCurrentRoles } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { PushPermissionPrompt } from '@/components/pwa/push-prompt'

/**
 * Authenticated app shell.
 *
 * Middleware already redirects anonymous users, but this re-checks server-side:
 * middleware is a routing convenience, not an authorization boundary, and this
 * layout is what actually loads the user's data.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()

  if (!profile) redirect('/login')

  // A half-finished profile cannot use discovery meaningfully (no location, no
  // skills), so route them to finish it first.
  if (!profile.profile_completed) redirect('/onboarding')

  const roles = await getCurrentRoles()
  const supabase = await createClient()

  // Unread counters for the nav badges. Both are cheap indexed reads.
  const [{ data: memberships }, { count: unreadNotifications }] = await Promise.all([
    supabase
      .from('conversation_members')
      .select('unread_count')
      .eq('user_id', profile.id)
      .is('left_at', null),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .is('read_at', null),
  ])

  const unreadMessages = (memberships ?? []).reduce(
    (total, row) => total + (row.unread_count ?? 0),
    0,
  )

  return (
    <div className="flex min-h-dvh">
      <AppSidebar
        roles={roles}
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications ?? 0}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" className="app-scroll flex-1 md:pb-0">
          {children}
        </main>
      </div>

      <BottomNav
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications ?? 0}
      />

      <InstallPrompt />
      <PushPermissionPrompt />
    </div>
  )
}
