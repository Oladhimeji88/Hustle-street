#!/usr/bin/env tsx
/**
 * Local cron runner.
 *
 * Invokes the same HTTP endpoints a production scheduler would, so what you
 * test locally is exactly what runs in production.
 *
 *   pnpm worker:cron                 run every task once
 *   pnpm worker:cron auto-confirm    run one task
 *   pnpm worker:cron --watch         run on a loop (dev)
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const SECRET = process.env.CRON_SECRET

const ALL_TASKS = [
  'notifications',
  'auto-confirm',
  'mature-earnings',
  'expire-jobs',
  'publish-reviews',
  'reconcile',
  'cleanup',
] as const

async function runTask(task: string) {
  const started = Date.now()
  try {
    const response = await fetch(`${BASE_URL}/api/cron/${task}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}` },
    })
    const body = await response.json()
    const status = response.ok ? '✓' : '✗'
    console.log(`${status} ${task.padEnd(18)} ${Date.now() - started}ms  ${JSON.stringify(body)}`)
  } catch (error) {
    console.error(`✗ ${task.padEnd(18)} ${error instanceof Error ? error.message : error}`)
  }
}

async function main() {
  if (!SECRET) {
    console.error('✗ CRON_SECRET is not set.')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const watch = args.includes('--watch')
  const requested = args.filter((arg) => !arg.startsWith('--'))
  const tasks = requested.length ? requested : [...ALL_TASKS]

  do {
    console.log(`\n[${new Date().toISOString()}] running ${tasks.length} task(s)`)
    for (const task of tasks) await runTask(task)
    if (watch) await new Promise((resolve) => setTimeout(resolve, 60_000))
  } while (watch)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
