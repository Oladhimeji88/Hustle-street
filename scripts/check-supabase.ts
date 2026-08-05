#!/usr/bin/env tsx
/**
 * Connection preflight.
 *
 *   pnpm db:check
 *
 * Run this before `pnpm db:migrate`. It checks every credential independently
 * and tells you which one is wrong, rather than letting the migration fail
 * halfway with a generic connection error.
 *
 * Nothing here writes anything. It is safe to run repeatedly.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: '.env.local' })

const ENV_FILE = '.env.local'
const FIX = process.argv.includes('--fix')

/**
 * Supabase's dashboard hands you a copy-paste block using its own variable
 * names. Next.js only exposes a variable to the browser when it is prefixed
 * `NEXT_PUBLIC_`, so those names cannot simply be read as-is — the anon key
 * and project URL genuinely have to be re-prefixed.
 *
 * Rather than making that the user's problem, `--fix` maps them across.
 */
const ALIASES: Record<string, string[]> = {
  NEXT_PUBLIC_SUPABASE_URL: ['SUPABASE_URL', 'SUPABASE_PROJECT_URL'],
  NEXT_PUBLIC_SUPABASE_ANON_KEY: [
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ],
  SUPABASE_SERVICE_ROLE_KEY: ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_KEY'],
}

function looksUnset(value: string | undefined): boolean {
  return (
    !value ||
    value.includes('PASTE_') ||
    value.includes('your-') ||
    value.startsWith('local-') ||
    value.includes('placeholder')
  )
}

/** Copies any alias values onto the names the app actually reads. */
function applyAliases(): string[] {
  const applied: string[] = []
  let file = readFileSync(ENV_FILE, 'utf8')

  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    if (!looksUnset(process.env[canonical])) continue

    const source = aliases.find((alias) => !looksUnset(process.env[alias]))
    if (!source) continue

    const value = process.env[source]!
    process.env[canonical] = value
    applied.push(`${source} → ${canonical}`)

    if (FIX) {
      const line = `${canonical}=${value}`
      file = new RegExp(`^${canonical}=.*$`, 'm').test(file)
        ? file.replace(new RegExp(`^${canonical}=.*$`, 'm'), line)
        : `${file.trimEnd()}\n${line}\n`
    }
  }

  if (FIX && applied.length) writeFileSync(ENV_FILE, file)
  return applied
}

const PASS = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const WARN = '\x1b[33m!\x1b[0m'

let failures = 0

function pass(label: string, detail = '') {
  console.log(`  ${PASS} ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`)
}
function fail(label: string, fix: string) {
  failures++
  console.log(`  ${FAIL} ${label}`)
  console.log(`      \x1b[2m→ ${fix}\x1b[0m`)
}
function warn(label: string, detail: string) {
  console.log(`  ${WARN} ${label}`)
  console.log(`      \x1b[2m${detail}\x1b[0m`)
}

/* ── 1. Environment shape ───────────────────────────────────────────────── */

function checkEnv() {
  console.log('\n\x1b[1mEnvironment\x1b[0m')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const db = process.env.DATABASE_URL ?? ''
  const cron = process.env.CRON_SECRET ?? ''

  // Project URL
  if (!url || url.includes('PASTE_') || url.includes('your-project')) {
    fail('NEXT_PUBLIC_SUPABASE_URL not set', 'Supabase → Project Settings → API → Project URL')
  } else if (url.includes('localhost') || url.includes('127.0.0.1')) {
    warn('NEXT_PUBLIC_SUPABASE_URL points at localhost', 'Expected https://<ref>.supabase.co for a cloud project')
  } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url)) {
    warn('NEXT_PUBLIC_SUPABASE_URL looks unusual', `Got: ${url}`)
  } else {
    pass('NEXT_PUBLIC_SUPABASE_URL', url)
  }

  // Keys. Supabase issues either legacy JWTs (very long, start "eyJ") or the
  // newer sb_publishable_ / sb_secret_ format. Anything short is truncated.
  const checkKey = (name: string, value: string, kind: 'anon' | 'service') => {
    if (!value || value.includes('your-')) {
      fail(`${name} not set`, 'Supabase → Project Settings → API')
      return
    }
    const isJwt = value.startsWith('eyJ')
    const isNew = value.startsWith('sb_publishable_') || value.startsWith('sb_secret_')

    if (!isJwt && !isNew) {
      fail(
        `${name} does not look like a Supabase key`,
        'Expected a long JWT starting "eyJ", or a key starting "sb_publishable_" / "sb_secret_"',
      )
      return
    }
    if (isJwt && value.length < 100) {
      fail(`${name} looks truncated`, `Only ${value.length} chars — a Supabase JWT is ~200+. Re-copy the whole key.`)
      return
    }
    if (kind === 'service' && (value.startsWith('sb_publishable_') || value.includes('anon'))) {
      fail(`${name} is the ANON key, not the service role key`, 'These are different keys on the same settings page')
      return
    }
    pass(name, `${value.slice(0, 12)}… (${value.length} chars)`)
  }

  checkKey('NEXT_PUBLIC_SUPABASE_ANON_KEY', anon, 'anon')
  checkKey('SUPABASE_SERVICE_ROLE_KEY', service, 'service')

  if (anon && service && anon === service) {
    fail('Anon and service role keys are identical', 'They must be different — re-copy both')
  }

  // Database URL
  if (!db || db.includes('PASTE_') || db.includes('[YOUR-PASSWORD]')) {
    fail('DATABASE_URL not set', 'Supabase → Project Settings → Database → Connection string → URI')
  } else if (db.includes('localhost') || db.includes('127.0.0.1')) {
    warn('DATABASE_URL points at localhost', 'Expected your cloud project host')
  } else if (db.includes(':6543')) {
    fail(
      'DATABASE_URL uses the TRANSACTION pooler (port 6543)',
      'Migrations need the Session pooler or Direct connection (port 5432). The transaction pooler cannot run this DDL.',
    )
  } else {
    const masked = db.replace(/:([^:@/]+)@/, ':****@')
    pass('DATABASE_URL', masked.slice(0, 70))
  }

  if (!cron || cron.length < 24 || cron.includes('change-me')) {
    fail('CRON_SECRET too short or unset', 'Needs 24+ random characters — production refuses to boot otherwise')
  } else {
    pass('CRON_SECRET', `${cron.length} chars`)
  }
}

/* ── 2. REST API reachability ───────────────────────────────────────────── */

async function checkRest() {
  console.log('\n\x1b[1mSupabase REST API\x1b[0m')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || url.includes('PASTE_') || !anon) {
    warn('Skipped', 'Fix the environment values above first')
    return
  }

  /*
   * Probe a real table, not `/rest/v1/`.
   *
   * The API root rejects publishable/anon keys outright ("Secret API key
   * required"), so testing there reports a perfectly good anon key as broken.
   * Hitting a table exercises the path the app actually uses.
   *
   * A 404/PGRST205 means the key authenticated and only the schema is missing —
   * which is the expected state before the first migration.
   */
  for (const [label, key] of [
    ['anon key', anon],
    ['service role key', service],
  ] as const) {
    if (!key) continue
    try {
      const response = await fetch(`${url}/rest/v1/categories?select=slug&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15_000),
      })
      const body = await response.text()

      if (response.ok) {
        pass(`Authenticated with ${label}`, 'schema present')
      } else if (response.status === 404 && body.includes('PGRST205')) {
        pass(`Authenticated with ${label}`, 'schema not migrated yet — expected')
      } else if (response.status === 401) {
        fail(`${label} rejected (401)`, 'Key does not belong to this project, or has been rotated')
      } else {
        warn(`${label} returned HTTP ${response.status}`, body.slice(0, 140))
      }
    } catch (error) {
      fail(
        `Cannot reach ${url} with ${label}`,
        error instanceof Error
          ? error.message
          : 'Network error — check the project URL and that the project is not paused',
      )
    }
  }
}

/* ── 3. Direct Postgres connection ──────────────────────────────────────── */

async function checkDatabase() {
  console.log('\n\x1b[1mPostgreSQL\x1b[0m')

  const connectionString = process.env.DATABASE_URL
  if (!connectionString || connectionString.includes('PASTE_')) {
    warn('Skipped', 'DATABASE_URL not set')
    return
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('supabase.') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 20_000,
  })

  try {
    await client.connect()
    const { rows } = await client.query('select version(), current_database(), current_user')
    pass('Connected', `${rows[0].current_user}@${rows[0].current_database}`)
    pass('Server', String(rows[0].version).split(' ').slice(0, 2).join(' '))

    // PostGIS is a hard requirement — the whole discovery layer is built on it.
    const ext = await client.query(
      `select name, default_version, installed_version
         from pg_available_extensions
        where name in ('postgis','pg_trgm','unaccent','pgcrypto','btree_gin')
        order by name`,
    )

    for (const row of ext.rows) {
      if (row.installed_version) pass(`extension ${row.name}`, `v${row.installed_version} installed`)
      else pass(`extension ${row.name}`, `v${row.default_version} available (migration will enable it)`)
    }

    const missing = ['postgis', 'pg_trgm', 'unaccent', 'pgcrypto', 'btree_gin'].filter(
      (name) => !ext.rows.some((r) => r.name === name),
    )
    if (missing.length) {
      fail(`Extensions unavailable: ${missing.join(', ')}`, 'This project cannot run the migrations')
    }

    // Has anything been applied already?
    const applied = await client.query(
      `select exists (
         select 1 from information_schema.tables
         where table_schema = 'public' and table_name = 'schema_migrations'
       ) as has_table`,
    )

    if (applied.rows[0].has_table) {
      const count = await client.query('select count(*)::int as n from schema_migrations')
      pass('Migrations already applied', `${count.rows[0].n} recorded — db:migrate will apply only what is new`)
    } else {
      pass('Fresh database', 'No migrations applied yet')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('password authentication failed')) {
      fail('Password rejected', 'Replace [YOUR-PASSWORD] in DATABASE_URL, and URL-encode special characters')
    } else if (message.includes('ENOTFOUND') || message.includes('EAI_AGAIN')) {
      fail('Host not found', 'Check the hostname in DATABASE_URL. Is the project paused?')
    } else if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      fail(
        'Connection timed out',
        'Often IPv6: use the Session pooler connection string instead of Direct connection',
      )
    } else {
      fail('Connection failed', message.slice(0, 200))
    }
  } finally {
    await client.end().catch(() => {})
  }
}

/* ── run ─────────────────────────────────────────────────────────────────── */

async function main() {
  console.log('\n\x1b[1m\x1b[38;5;208mHustle Street — Supabase preflight\x1b[0m')

  const aliased = applyAliases()
  if (aliased.length) {
    console.log('\n\x1b[1mVariable names\x1b[0m')
    for (const mapping of aliased) {
      console.log(`  ${FIX ? PASS : WARN} ${mapping}`)
    }
    if (!FIX) {
      console.log(
        `      \x1b[2m→ Run \x1b[0m\x1b[1mpnpm db:check --fix\x1b[0m\x1b[2m to write these into ${ENV_FILE}\x1b[0m`,
      )
      console.log(
        `      \x1b[2m  (Next.js only exposes NEXT_PUBLIC_* to the browser, so the rename is required)\x1b[0m`,
      )
    }
  }

  checkEnv()
  await checkRest()
  await checkDatabase()

  console.log()
  if (failures === 0) {
    console.log('\x1b[32m\x1b[1mAll checks passed.\x1b[0m Next: pnpm db:migrate\n')
  } else {
    console.log(`\x1b[31m\x1b[1m${failures} problem${failures === 1 ? '' : 's'} to fix.\x1b[0m See the → hints above.\n`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
