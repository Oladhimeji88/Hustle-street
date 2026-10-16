import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Edge middleware: session refresh + route protection.
 *
 * This is a convenience layer, not the security boundary. Row Level Security in
 * PostgreSQL is what actually protects data; middleware only saves a user from
 * loading a page they cannot use, and gives them a sensible redirect.
 */

/** Requires a signed-in user. */
const PROTECTED_PREFIXES = [
  '/home',
  '/discover',
  '/post',
  '/my-jobs',
  '/applications',
  '/messages',
  '/notifications',
  '/saved',
  '/wallet',
  '/settings',
  '/hustler',
  '/disputes',
  '/onboarding',
]

/** Requires a staff role — additionally re-checked server-side on every page. */
const ADMIN_PREFIX = '/admin'

/** Signed-in users are bounced away from these. */
const AUTH_ROUTES = ['/login', '/signup', '/reset-password']

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // The service worker and manifest must never be gated or redirected.
  if (pathname === '/sw.js' || pathname === '/manifest.webmanifest' || pathname === '/offline') {
    return NextResponse.next()
  }

  const { response, user } = await updateSession(request)

  const isProtected = matches(pathname, PROTECTED_PREFIXES)
  const isAdmin = matches(pathname, [ADMIN_PREFIX])
  const isAuthRoute = matches(pathname, AUTH_ROUTES)

  if (!user && (isProtected || isAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve the destination so the user lands where they meant to go.
    url.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = request.nextUrl.searchParams.get('next') ?? '/home'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Keeping the matcher
     * tight matters: middleware runs on every matched request and session
     * refresh costs a round trip to the auth server.
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|screenshots/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)',
  ],
}
