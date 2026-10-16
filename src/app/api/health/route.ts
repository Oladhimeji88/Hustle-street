import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Liveness + readiness.
 *
 * HEAD is a cheap liveness ping — used by the client's network watcher to tell
 * "actually online" from "connected to a captive Wi-Fi portal".
 *
 * GET is readiness: it touches the database, so a load balancer or uptime
 * monitor learns when the app is up but its dependencies are not.
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET() {
  const startedAt = Date.now()
  const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {}

  const dbStart = Date.now()
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('platform_settings').select('key').limit(1)
    checks.database = { ok: !error, ms: Date.now() - dbStart, error: error?.message }
  } catch (error) {
    checks.database = {
      ok: false,
      ms: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'unknown',
    }
  }

  const healthy = Object.values(checks).every((check) => check.ok)

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'development',
      uptimeMs: Date.now() - startedAt,
      checks,
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
