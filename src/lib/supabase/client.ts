'use client'

import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/config/env'

/**
 * Browser Supabase client.
 *
 * Uses the ANON key and is therefore bound by Row Level Security — a compromised
 * browser can only ever reach what the policies in `0013_rls.sql` allow.
 *
 * Memoised: creating multiple clients would open duplicate realtime sockets.
 */
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      realtime: {
        params: {
          // Keeps a busy conversation from flooding a poor 3G connection.
          eventsPerSecond: 10,
        },
      },
      global: {
        headers: { 'x-application-name': 'hustle-street-web' },
      },
    },
  )

  return client
}
