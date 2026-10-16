import 'server-only'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { publicEnv } from '@/lib/config/env'
import type { Profile, UserRole } from '@/types/database'

/**
 * Request-scoped Supabase client for Server Components, Route Handlers and
 * Server Actions.
 *
 * Uses the ANON key with the caller's session cookie, so every query runs under
 * that user's Row Level Security context. This is the default client for all
 * server code — reach for `admin.ts` only where the operation genuinely has no
 * user (webhooks, cron).
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Components cannot set cookies. The middleware refreshes the
            // session on every request, so this is safe to ignore here.
          }
        },
      },
    },
  )
}

/**
 * The authenticated user, or null.
 *
 * Always uses `getUser()` rather than `getSession()`: `getSession()` reads the
 * cookie without verifying it against the auth server, so it must never be
 * trusted for an authorization decision.
 *
 * `cache()` deduplicates the call across a single render pass.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
})

/** The caller's full profile row, or null when signed out. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase.from('my_profile').select('*').maybeSingle()

  return (data as Profile | null) ?? null
})

/** The caller's granted roles. Empty array when signed out. */
export const getCurrentRoles = cache(async (): Promise<UserRole[]> => {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('user_roles')
    .select('role, expires_at')
    .eq('user_id', user.id)

  if (!data) return []

  const now = Date.now()
  return data
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > now)
    .map((row) => row.role as UserRole)
})

/**
 * Role check honouring the hierarchy superadmin > admin > moderator > user.
 * Mirrors `app.has_role()` in SQL.
 */
export async function hasRole(required: UserRole): Promise<boolean> {
  const roles = await getCurrentRoles()
  const rank: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2, superadmin: 3 }
  const highest = roles.reduce((max, role) => Math.max(max, rank[role] ?? 0), 0)
  return highest >= rank[required]
}

export async function isStaff(): Promise<boolean> {
  return hasRole('moderator')
}
