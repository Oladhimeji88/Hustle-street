/**
 * Development-only sign-in bypass.
 *
 * ── Read this before touching it ────────────────────────────────────────────
 *
 * This accepts *any* email and *any* password. On a public deployment that is
 * not a convenience, it is a total authentication failure: anyone who loads the
 * login page owns every account, including whichever accounts hold payouts.
 *
 * So it is gated three ways, and all three must agree:
 *
 *   1. `NEXT_PUBLIC_APP_ENV` must not be `production`.
 *   2. `NEXT_PUBLIC_ALLOW_DEV_LOGIN` must be exactly `'true'`. Opt-in, so a
 *      staging environment does not inherit it by merely not being production.
 *   3. `process.env.NODE_ENV` must not be `production`, which is set by
 *      `next build` and cannot be forgotten the way an env var can.
 *
 * Condition 3 is the one that actually saves you. Conditions 1 and 2 are env
 * vars a person can mis-set; NODE_ENV is set by the build itself. A production
 * build therefore cannot enable this even if both env vars are wrong.
 *
 * ── Removing it ─────────────────────────────────────────────────────────────
 *
 * Delete this file and the two call sites in `auth-forms.tsx`. Nothing else
 * depends on it. It exists to unblock UI work before the real auth flow is
 * finished, and it should not outlive that.
 */

export function devLoginAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') return false
  return process.env.NEXT_PUBLIC_ALLOW_DEV_LOGIN === 'true'
}

/**
 * A deterministic password for a given email, so the bypass can sign in through
 * real Supabase auth rather than faking a session.
 *
 * Faking a session client-side would mean every server component still saw an
 * unauthenticated request, so nothing behind auth would actually work. Creating
 * a real (throwaway) account means RLS, the session cookie and every downstream
 * query behave exactly as they will in production.
 */
export function devPasswordFor(email: string): string {
  return `dev!${email.toLowerCase().trim()}!Hustle1`
}
