import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, writeAuditLog } from '@/lib/supabase/admin'
import { clientIp, hashIdentifier } from '@/lib/api/rate-limit'
import { sendEmail, emailTemplates } from '@/lib/notifications/email'
import { track, ANALYTICS_EVENTS } from '@/lib/analytics/server'
import { slugify } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * OAuth / email-confirmation callback.
 *
 * Exchanges the PKCE code for a session, then makes sure the user has a usable
 * profile row before letting them into the app. Doing profile bootstrap here
 * (rather than in a database trigger on `auth.users`) keeps username collision
 * handling and welcome email in application code where it can be tested.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error_description') ?? url.searchParams.get('error')

  // Only ever redirect to a path on this origin. An open redirect here would be
  // a phishing vector on an authenticated session.
  const rawNext = url.searchParams.get('next') ?? '/home'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/home'

  if (errorParam) {
    const target = new URL('/login', url.origin)
    target.searchParams.set('error', 'oauth')
    return NextResponse.redirect(target)
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login', url.origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    const target = new URL('/login', url.origin)
    target.searchParams.set('error', 'exchange')
    return NextResponse.redirect(target)
  }

  const user = data.user
  const admin = createAdminClient()

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, profile_completed, onboarding_step')
    .eq('id', user.id)
    .maybeSingle()

  if (!existingProfile) {
    const displayName =
      (user.user_metadata?.display_name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split('@')[0] ??
      'Hustler'

    const intent = (user.user_metadata?.intent as string | undefined) ?? 'both'

    await admin.from('profiles').insert({
      id: user.id,
      username: await allocateUsername(admin, displayName, user.id),
      display_name: displayName.slice(0, 60),
      email: user.email ?? null,
      phone: user.phone ?? null,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      email_verified: Boolean(user.email_confirmed_at),
      phone_verified: Boolean(user.phone_confirmed_at),
      is_hustler: intent === 'hustle' || intent === 'both',
      is_poster: intent === 'post' || intent === 'both',
      onboarding_step: 'profile',
    })

    // Default notification preferences, so the fan-out trigger has a row.
    await admin.from('notification_preferences').insert({ user_id: user.id })

    // Mirror the verification state from the auth provider into our own
    // verification table, which is what the trust badges read from.
    if (user.email_confirmed_at) {
      await admin.from('user_verifications').insert({
        user_id: user.id,
        kind: 'email',
        status: 'verified',
        provider: 'supabase_auth',
        verified_at: user.email_confirmed_at,
      })
    }

    await track(ANALYTICS_EVENTS.ACCOUNT_CREATED, {
      userId: user.id,
      properties: { method: user.app_metadata?.provider ?? 'email', intent },
    })

    if (user.email) {
      void sendEmail({ to: user.email, ...emailTemplates.welcome({ name: displayName }) })
    }

    void writeAuditLog({
      actorId: user.id,
      actorKind: 'user',
      action: 'account.created',
      entityType: 'profile',
      entityId: user.id,
      ipHash: hashIdentifier(clientIp(request)),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.redirect(new URL('/onboarding', url.origin))
  }

  // Email confirmation can land here for an existing account; keep the flags
  // in step with the auth record.
  if (user.email_confirmed_at) {
    await admin
      .from('profiles')
      .update({ email_verified: true, last_active_at: new Date().toISOString() })
      .eq('id', user.id)
  }

  if (!existingProfile.profile_completed) {
    return NextResponse.redirect(new URL('/onboarding', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}

/**
 * Picks a free username derived from the display name.
 *
 * Usernames are public and permanent-ish, so collisions must be resolved
 * server-side rather than by asking a brand-new user to invent one before they
 * have seen the product.
 */
async function allocateUsername(
  admin: ReturnType<typeof createAdminClient>,
  displayName: string,
  userId: string,
): Promise<string> {
  const base = slugify(displayName).replace(/-/g, '_').slice(0, 18) || 'hustler'

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(Math.random() * 9000) + 1000}`
    if (candidate.length < 3) continue

    const { data } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', candidate)
      .maybeSingle()

    if (!data) return candidate
  }

  // Deterministic last resort — the user id fragment cannot collide.
  return `hustler_${userId.replace(/-/g, '').slice(0, 12)}`
}
