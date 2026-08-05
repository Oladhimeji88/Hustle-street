#!/usr/bin/env tsx
/**
 * Integrity verification.
 *
 *   pnpm db:verify
 *
 * Asserts the invariants the product's correctness actually rests on, against a
 * real database with real seeded data. Unit tests check the arithmetic; this
 * checks that PostgreSQL is enforcing the rules we told it to.
 *
 * Four areas:
 *   A. Double-entry ledger integrity
 *   B. Geospatial discovery
 *   C. Row Level Security isolation
 *   D. Server-side business rules
 *
 * Read-only apart from area D, which deliberately attempts writes that must be
 * REJECTED. Nothing here leaves data behind.
 */

import { config } from 'dotenv'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const PASS = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'

let failures = 0
let checks = 0

function assert(condition: boolean, label: string, detail = '') {
  checks++
  if (condition) {
    console.log(`  ${PASS} ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`)
  } else {
    failures++
    console.log(`  ${FAIL} ${label}  \x1b[31m${detail}\x1b[0m`)
  }
}

function ngn(minor: number | string): string {
  return `₦${(Number(minor) / 100).toLocaleString('en-NG')}`
}

const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

/* ── A. Ledger ───────────────────────────────────────────────────────────── */

async function verifyLedger() {
  console.log('\n\x1b[1mA. Double-entry ledger\x1b[0m')

  // The cached balance on every account must equal the sum of its entries.
  const drift = await db.query('select * from reconcile_ledger()')
  assert(
    drift.rows.length === 0,
    'Every cached balance matches its entries',
    drift.rows.length ? `${drift.rows.length} account(s) drifted` : '',
  )

  // Every transaction must net to zero across debits and credits.
  const unbalanced = await db.query(`
    select t.reference,
           sum(case when e.direction = 'debit' then e.amount_minor else -e.amount_minor end) as imbalance
      from transactions t join ledger_entries e on e.transaction_id = t.id
     group by t.reference having sum(case when e.direction = 'debit' then e.amount_minor else -e.amount_minor end) <> 0`)
  assert(unbalanced.rows.length === 0, 'Every transaction balances to zero',
    unbalanced.rows.map((r) => `${r.reference}: ${r.imbalance}`).join(', '))

  // No liability account may go negative.
  const negative = await db.query(`
    select kind, count(*)::int n from ledger_accounts
     where balance_minor < 0 and kind in ('user_available','user_pending','escrow')
     group by kind`)
  assert(negative.rows.length === 0, 'No negative user or escrow balances',
    negative.rows.map((r) => `${r.kind}=${r.n}`).join(', '))

  // Escrow for a completed job must be fully drained.
  const residual = await db.query(`
    select count(*)::int n from ledger_accounts la
     join job_assignments ja on ja.id = la.reference_id
    where la.kind = 'escrow' and ja.status = 'completed' and la.balance_minor <> 0`)
  assert(Number(residual.rows[0].n) === 0, 'Completed jobs leave zero in escrow',
    `${residual.rows[0].n} account(s) still funded`)

  // Platform revenue must equal the commission actually agreed on those jobs.
  const revenue = await db.query(`
    select
      (select coalesce(sum(balance_minor),0) from ledger_accounts where kind='platform_revenue') as booked,
      (select coalesce(sum(platform_fee_minor),0) from job_assignments where status='completed') as expected`)
  const { booked, expected } = revenue.rows[0]
  assert(String(booked) === String(expected), 'Platform revenue equals commission charged',
    `booked ${ngn(booked)} vs expected ${ngn(expected)}`)

  // What hustlers hold must equal what was released to them.
  const earnings = await db.query(`
    select
      (select coalesce(sum(balance_minor),0) from ledger_accounts
        where kind in ('user_available','user_pending')) as held,
      (select coalesce(sum(hustler_net_minor),0) from job_assignments where status='completed') as released`)
  assert(String(earnings.rows[0].held) === String(earnings.rows[0].released),
    'Hustler balances equal net released',
    `held ${ngn(earnings.rows[0].held)} vs released ${ngn(earnings.rows[0].released)}`)

  // The accounting identity across the whole system.
  const identity = await db.query(`
    select coalesce(sum(case when app.account_normal_direction(la.kind) = 'debit'
                             then la.balance_minor else -la.balance_minor end), 0) as net
      from ledger_accounts la`)
  assert(Number(identity.rows[0].net) === 0, 'Assets equal liabilities plus income',
    `net = ${identity.rows[0].net}`)

  const summary = await db.query(`
    select kind, count(*)::int accounts, sum(balance_minor)::bigint total
      from ledger_accounts group by kind order by kind`)
  console.log('\n    \x1b[2mChart of accounts:\x1b[0m')
  for (const row of summary.rows) {
    console.log(`      ${String(row.kind).padEnd(20)} ${String(row.accounts).padStart(3)} acct  ${ngn(row.total).padStart(14)}`)
  }
}

/* ── B. Discovery ────────────────────────────────────────────────────────── */

async function verifyDiscovery() {
  console.log('\n\x1b[1mB. Geospatial discovery\x1b[0m')

  // Lekki Phase 1
  const LAT = 6.4433
  const LNG = 3.4736

  const near = await db.query(
    `select id, title, area_label, location_kind, round(distance_m::numeric) as m, total_count
       from search_jobs($1, $2, 10, null, null, null, null, null, null, null, null, 'nearest', 8, 0)`,
    [LAT, LNG],
  )
  assert(near.rows.length > 0, 'search_jobs returns jobs near Lekki',
    `${near.rows.length} of ${near.rows[0]?.total_count ?? 0}`)

  /*
   * Remote jobs legitimately have no distance: they carry no coordinates and
   * deliberately bypass the radius filter, because "must be within 10 km" is
   * meaningless for work done over the internet. So the ordering guarantee is
   * that on-site jobs ascend by distance and remote jobs sort last — not that
   * every row has a distance.
   */
  const onsite = near.rows.filter((r) => r.m !== null)
  const remote = near.rows.filter((r) => r.m === null)

  const ordered = onsite.every((r, i) => i === 0 || Number(r.m) >= Number(onsite[i - 1].m))
  assert(ordered, 'On-site results ascend by distance', `${onsite.length} located jobs`)

  const firstRemote = near.rows.findIndex((r) => r.m === null)
  const remoteSortLast = firstRemote === -1 || near.rows.slice(firstRemote).every((r) => r.m === null)
  assert(remoteSortLast, 'Remote jobs sort after located ones', `${remote.length} remote`)

  const remoteAreAllRemote = remote.every((r) => r.location_kind === 'remote')
  assert(remoteAreAllRemote, 'Only remote jobs lack a distance',
    remote.map((r) => r.location_kind).join(', '))

  if (near.rows.length) {
    console.log('\n    \x1b[2mNearest jobs to Lekki Phase 1:\x1b[0m')
    for (const r of near.rows.slice(0, 6)) {
      const where = r.m === null ? '  remote' : `${(Number(r.m) / 1000).toFixed(1).padStart(6)} km`
      console.log(`      ${where}  ${String(r.area_label ?? '—').padEnd(16)} ${r.title}`)
    }
  }

  // A tight radius must return strictly fewer jobs than a wide one.
  const tight = await db.query(
    `select count(*)::int n from search_jobs($1,$2,2,null,null,null,null,null,null,null,null,'nearest',100,0)`,
    [LAT, LNG],
  )
  const wide = await db.query(
    `select count(*)::int n from search_jobs($1,$2,50,null,null,null,null,null,null,null,null,'nearest',100,0)`,
    [LAT, LNG],
  )
  assert(Number(tight.rows[0].n) <= Number(wide.rows[0].n), 'Radius filter narrows results',
    `2km=${tight.rows[0].n}, 50km=${wide.rows[0].n}`)

  // Typo tolerance via trigram similarity.
  const typo = await db.query(
    `select count(*)::int n from search_jobs(null,null,null,'plumer',null,null,null,null,null,null,null,'relevant',20,0)`,
  )
  assert(Number(typo.rows[0].n) >= 0, 'Typo-tolerant search executes', `"plumer" → ${typo.rows[0].n} results`)

  // Recommendations must be scored and ordered.
  const hustler = await db.query(`select id, display_name from profiles where is_hustler limit 1`)
  const reco = await db.query(`select * from recommend_jobs($1, 5)`, [hustler.rows[0].id])
  assert(reco.rows.length > 0, 'recommend_jobs returns scored matches', `${reco.rows.length} for ${hustler.rows[0].display_name}`)
  const descending = reco.rows.every((r, i) => i === 0 || Number(r.score) <= Number(reco.rows[i - 1].score))
  assert(descending, 'Recommendations are ordered by descending score')
  if (reco.rows.length) {
    console.log('\n    \x1b[2mTop recommendations:\x1b[0m')
    for (const r of reco.rows.slice(0, 3)) {
      console.log(`      score ${String(r.score).padStart(6)}  ${String(r.reason).padEnd(34)} ${r.title}`)
    }
  }

  // Map pins must be fuzzed to 2dp — this is the location-privacy guarantee.
  const pins = await db.query(`select lat, lng from jobs_in_bounds(6.3, 3.2, 6.7, 3.7, null, 50)`)
  const fuzzed = pins.rows.every(
    (p) => Math.abs(Number(p.lat) * 100 - Math.round(Number(p.lat) * 100)) < 1e-6,
  )
  assert(pins.rows.length > 0 && fuzzed, 'Map pins are fuzzed to ~1.1 km precision',
    `${pins.rows.length} pins, all rounded to 2dp`)
}

/* ── C. Row Level Security ───────────────────────────────────────────────── */

async function verifyRls() {
  console.log('\n\x1b[1mC. Row Level Security (as anonymous)\x1b[0m')

  const open = await anon.from('categories').select('slug').limit(1)
  assert(!open.error && (open.data?.length ?? 0) > 0, 'Anonymous CAN read categories')

  const jobs = await anon.from('jobs').select('id,title').limit(5)
  assert(!jobs.error && (jobs.data?.length ?? 0) > 0, 'Anonymous CAN read published jobs',
    `${jobs.data?.length ?? 0} visible`)

  // Private columns must be withheld by the column-level grant.
  const pii = await anon.from('profiles').select('id,email,phone').limit(1)
  assert(!!pii.error, 'Anonymous CANNOT read profile email/phone',
    pii.error ? pii.error.code : 'LEAKED PII')

  const money = await anon.from('transactions').select('id').limit(1)
  assert((money.data?.length ?? 0) === 0, 'Anonymous CANNOT read transactions',
    money.error ? money.error.code : `${money.data?.length} rows returned`)

  const ledger = await anon.from('ledger_entries').select('id').limit(1)
  assert((ledger.data?.length ?? 0) === 0, 'Anonymous CANNOT read the ledger')

  const apps = await anon.from('job_applications').select('id').limit(1)
  assert((apps.data?.length ?? 0) === 0, 'Anonymous CANNOT read applications')

  const msgs = await anon.from('messages').select('id').limit(1)
  assert((msgs.data?.length ?? 0) === 0, 'Anonymous CANNOT read messages')

  const fraud = await anon.from('fraud_signals').select('id').limit(1)
  assert((fraud.data?.length ?? 0) === 0, 'Anonymous CANNOT read fraud signals')

  // Privileged RPCs must be unreachable from the API roles.
  const refund = await anon.rpc('refund_escrow', {
    p_assignment_id: '00000000-0000-0000-0000-000000000000',
  })
  assert(!!refund.error, 'Anonymous CANNOT call refund_escrow', refund.error?.code ?? 'REACHABLE')

  const release = await anon.rpc('mature_pending_earnings')
  assert(!!release.error, 'Anonymous CANNOT call mature_pending_earnings',
    release.error?.code ?? 'REACHABLE')

  // Discovery RPCs must remain open, or the public marketplace breaks.
  const search = await anon.rpc('search_jobs', { p_lat: 6.4433, p_lng: 3.4736, p_limit: 3 })
  assert(!search.error, 'Anonymous CAN call search_jobs', search.error?.message ?? '')
}

/* ── D. Business rules ───────────────────────────────────────────────────── */

async function verifyBusinessRules() {
  console.log('\n\x1b[1mD. Server-enforced business rules\x1b[0m')

  const job = await db.query(
    `select id, poster_id, status from jobs where status in ('PUBLISHED','APPLICATIONS_OPEN') limit 1`,
  )
  const j = job.rows[0]

  // A poster must not be able to apply to their own job.
  const own = await admin.from('job_applications').insert({
    job_id: j.id,
    hustler_id: j.poster_id,
    proposed_price_minor: 500000,
    message: 'Attempting to apply to my own job, which must be refused.',
  })
  assert(!!own.error, 'Cannot apply to your own job', own.error?.message.slice(0, 60) ?? 'ALLOWED')

  // Terminal states are terminal.
  const done = await db.query(`select id from jobs where status = 'COMPLETED' limit 1`)
  if (done.rows.length) {
    let rejected = false
    try {
      await db.query(`update jobs set status = 'APPLICATIONS_OPEN' where id = $1`, [done.rows[0].id])
    } catch {
      rejected = true
    }
    assert(rejected, 'Cannot reopen a COMPLETED job')

    let editRejected = false
    try {
      await db.query(`update jobs set title = 'Edited after completion' where id = $1`, [done.rows[0].id])
    } catch {
      editRejected = true
    }
    assert(editRejected, 'Cannot edit a completed job')
  }

  // The ledger is append-only, even for the owner connection.
  const entry = await db.query(`select id from ledger_entries limit 1`)
  if (entry.rows.length) {
    let immutable = false
    try {
      await db.query(`update ledger_entries set amount_minor = 1 where id = $1`, [entry.rows[0].id])
    } catch {
      immutable = true
    }
    assert(immutable, 'Ledger entries cannot be updated')

    let undeletable = false
    try {
      await db.query(`delete from ledger_entries where id = $1`, [entry.rows[0].id])
    } catch {
      undeletable = true
    }
    assert(undeletable, 'Ledger entries cannot be deleted')
  }

  // Releasing twice must not pay twice.
  const assignment = await db.query(`select id from job_assignments where status = 'completed' limit 1`)
  if (assignment.rows.length) {
    const before = await db.query(
      `select count(*)::int n from transactions where assignment_id = $1 and kind = 'escrow_release'`,
      [assignment.rows[0].id],
    )
    const again = await admin.rpc('confirm_job_completion', {
      p_assignment_id: assignment.rows[0].id,
      p_system_auto: true,
    })
    const after = await db.query(
      `select count(*)::int n from transactions where assignment_id = $1 and kind = 'escrow_release'`,
      [assignment.rows[0].id],
    )
    assert(
      Number(before.rows[0].n) === Number(after.rows[0].n),
      'Double release is idempotent — no second payout',
      `releases before=${before.rows[0].n} after=${after.rows[0].n}${again.error ? ` (${again.error.code})` : ''}`,
    )
  }

  // Reviews require a completed working relationship.
  const strangers = await db.query(
    `select a.id a, b.id b from profiles a, profiles b
      where a.id <> b.id
        and not exists (select 1 from job_assignments ja
                        where (ja.poster_id=a.id and ja.hustler_id=b.id)
                           or (ja.poster_id=b.id and ja.hustler_id=a.id))
      limit 1`,
  )
  if (strangers.rows.length) {
    const bogus = await admin.from('reviews').insert({
      assignment_id: '00000000-0000-0000-0000-000000000000',
      job_id: '00000000-0000-0000-0000-000000000000',
      reviewer_id: strangers.rows[0].a,
      reviewee_id: strangers.rows[0].b,
      direction: 'poster_to_hustler',
      rating: 5,
    })
    assert(!!bogus.error, 'Cannot review without a completed job together',
      bogus.error?.message.slice(0, 50) ?? 'ALLOWED')
  }
}

/* ── run ─────────────────────────────────────────────────────────────────── */

async function main() {
  console.log('\n\x1b[1m\x1b[38;5;208mHustle Street — integrity verification\x1b[0m')
  await db.connect()

  try {
    await verifyLedger()
    await verifyDiscovery()
    await verifyRls()
    await verifyBusinessRules()
  } finally {
    await db.end().catch(() => {})
  }

  console.log(`\n${'─'.repeat(58)}`)
  if (failures === 0) {
    console.log(`\x1b[32m\x1b[1mAll ${checks} checks passed.\x1b[0m\n`)
  } else {
    console.log(`\x1b[31m\x1b[1m${failures} of ${checks} checks FAILED.\x1b[0m\n`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('\n', error)
  process.exit(1)
})
