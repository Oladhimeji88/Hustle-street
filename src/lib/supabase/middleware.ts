import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from '@/lib/config/env'

/**
 * Refreshes the Supabase session cookie on every request.
 *
 * Without this, an expired access token is only noticed once a Server Component
 * tries to use it — by which point it is too late to write a new cookie. Doing
 * it in middleware means every request downstream sees a valid session.
 *
 * Returns both the response (carrying any refreshed cookies) and the user, so
 * the caller can make routing decisions without a second round trip.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              // Harden the session cookie regardless of what the SDK defaults to.
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            }),
          )
        },
      },
    },
  )

  // getUser() validates the token against the auth server. getSession() would
  // only decode the cookie, which is not safe to route on.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
