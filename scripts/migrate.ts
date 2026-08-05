#!/usr/bin/env tsx
/**
 * Migration runner.
 *
 * Applies every file in `supabase/migrations` in filename order, exactly once,
 * inside a transaction, and records a checksum of each. If a file that has
 * already been applied is edited, the runner refuses to continue — silently
 * diverging schemas between environments is how production incidents start.
 *
 *   pnpm db:migrate            apply pending migrations
 *   pnpm db:migrate --reset    DROP the public schema first (never in prod)
 *   pnpm db:migrate --dry-run  show what would run
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

const args = new Set(process.argv.slice(2))
const shouldReset = args.has('--reset')
const dryRun = args.has('--dry-run')

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('✗ DATABASE_URL is not set. Copy .env.example to .env.local first.')
    process.exit(1)
  }

  if (shouldReset && process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    console.error('✗ Refusing to --reset a production database.')
    process.exit(1)
  }

  const client = new Client({
    connectionString,
    // Supabase requires TLS; local Postgres usually does not offer it.
    ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('→ connected')

  try {
    if (shouldReset) {
      console.log('→ dropping schema public (--reset)')
      await client.query('drop schema if exists public cascade')
      await client.query('drop schema if exists app cascade')
      await client.query('create schema public')
      await client.query('grant all on schema public to public')
    }

    await client.query(`
      create table if not exists schema_migrations (
        version    text primary key,
        checksum   text not null,
        applied_at timestamptz not null default now(),
        duration_ms integer
      )
    `)

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort()

    const { rows: applied } = await client.query<{ version: string; checksum: string }>(
      'select version, checksum from schema_migrations',
    )
    const appliedMap = new Map(applied.map((row) => [row.version, row.checksum]))

    let ran = 0

    for (const file of files) {
      const version = file.replace(/\.sql$/, '')
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16)

      const previous = appliedMap.get(version)

      if (previous) {
        if (previous !== checksum) {
          console.error(
            `\n✗ ${file} has changed since it was applied.\n` +
              `  Applied checksum: ${previous}\n` +
              `  Current checksum: ${checksum}\n\n` +
              `  Migrations are immutable once applied. Write a new migration instead.`,
          )
          process.exit(1)
        }
        continue
      }

      if (dryRun) {
        console.log(`  would apply ${file}`)
        ran += 1
        continue
      }

      process.stdout.write(`→ ${file} … `)
      const startedAt = Date.now()

      try {
        // Each migration is one transaction: it applies completely or not at all.
        await client.query('begin')
        await client.query(sql)
        await client.query(
          'insert into schema_migrations (version, checksum, duration_ms) values ($1, $2, $3)',
          [version, checksum, Date.now() - startedAt],
        )
        await client.query('commit')
        console.log(`ok (${Date.now() - startedAt}ms)`)
        ran += 1
      } catch (error) {
        await client.query('rollback')
        console.log('failed')
        console.error(`\n✗ ${file} failed:\n`)
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
      }
    }

    if (ran === 0) {
      console.log('✓ database is up to date')
    } else {
      console.log(`✓ ${dryRun ? 'would apply' : 'applied'} ${ran} migration${ran === 1 ? '' : 's'}`)
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
