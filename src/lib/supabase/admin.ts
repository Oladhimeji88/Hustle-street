import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getServerEnv, publicEnv } from '@/lib/config/env'

/**
 * Service-role Supabase client.
 *
 * ⚠️ THIS CLIENT BYPASSES ROW LEVEL SECURITY. ⚠️
 *
 * It exists for exactly three categories of work, none of which has a user
 * session to run under:
 *
 *   1. Verified payment webhooks   (`/api/webhooks/paystack`)
 *   2. The cron / background worker (`/api/cron/*`, `scripts/run-cron.ts`)
 *   3. Trusted operations that must read across users — notification fan-out,
 *      reconciliation, the seed script.
 *
 * Rules for using it:
 *   - Never import this from a client component or a page.
 *   - Never pass a user-supplied id straight into a query without first
 *     authorising the caller yourself. RLS is not there to catch you.
 *   - Prefer calling a SECURITY DEFINER RPC (which enforces its own rules) over
 *     writing tables directly.
 *
 * The `server-only` import above makes bundling this into client code a build
 * error rather than a silent key disclosure.
 */
export function createAdminClient() {
  const env = getServerEnv()

  return createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { 'x-application-name': 'hustle-street-service' },
      },
    },
  )
}

/**
 * Records a line in the immutable audit log.
 *
 * Every privileged mutation should leave a trace. Failures here are logged but
 * never thrown: an audit write must not be able to roll back the operation it
 * is describing.
 */
export async function writeAuditLog(input: {
  actorId?: string | null
  actorKind?: 'user' | 'admin' | 'system' | 'webhook'
  action: string
  entityType: string
  entityId?: string | null
  changes?: Record<string, unknown>
  ipHash?: string | null
  userAgent?: string | null
  requestId?: string | null
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      actor_id: input.actorId ?? null,
      actor_kind: input.actorKind ?? 'system',
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      changes: input.changes ?? null,
      ip_hash: input.ipHash ?? null,
      user_agent: input.userAgent ?? null,
      request_id: input.requestId ?? null,
    })
  } catch (error) {
    console.error('[audit] failed to write audit log', { action: input.action, error })
  }
}

/** Records an admin action for the admin activity trail. */
export async function writeAdminAction(input: {
  adminId: string
  action: string
  targetKind: string
  targetId?: string | null
  reason?: string | null
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
  ipHash?: string | null
  userAgent?: string | null
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('admin_actions').insert({
      admin_id: input.adminId,
      action: input.action,
      target_kind: input.targetKind,
      target_id: input.targetId ?? null,
      reason: input.reason ?? null,
      before_state: input.beforeState ?? null,
      after_state: input.afterState ?? null,
      ip_hash: input.ipHash ?? null,
      user_agent: input.userAgent ?? null,
    })
  } catch (error) {
    console.error('[audit] failed to write admin action', { action: input.action, error })
  }
}
