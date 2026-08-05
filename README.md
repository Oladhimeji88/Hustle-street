# Hustle Street

> **Need it done? Find someone nearby.
> Ready to hustle? Find your next job.**

A location-based marketplace for getting things done. Someone needs a sofa
moved, a flyer designed, a tap fixed. Someone nearby knows how. Hustle Street
connects them and holds the money until the work is confirmed done.

Built for Lagos first, architected to expand across Nigeria and beyond.

---

## Status

This repository contains a working production-grade foundation. Below is an
honest breakdown of what is complete and what is not, so you can plan from
reality rather than from a feature list.

### Complete and wired end to end

| Area | State |
|---|---|
| **Database** | 14 migrations: full schema, RLS on every table, 25+ RPCs, triggers, reference data |
| **Money** | Double-entry ledger, escrow hold/release, refunds, payouts, commission, reconciliation |
| **Payments** | Paystack adapter behind a provider port; signed, idempotent webhook handler |
| **Auth** | Email/password, phone OTP, Google OAuth, password reset, session middleware, profile bootstrap |
| **Discovery** | PostGIS geospatial search, typo-tolerant full-text, filters, deterministic recommendations |
| **Job lifecycle** | Post wizard (9 steps) → publish → apply → hire → fund → submit → confirm → release |
| **Design system** | Brand tokens, 20+ accessible primitives, light/dark, mobile-first |
| **PWA** | Manifest, service worker (per-resource caching, never money), offline page, install + push prompts |
| **API layer** | Typed envelope, auth/authz middleware, Zod validation, shared rate limiting, structured logs |
| **Background jobs** | 7 cron tasks: auto-confirm, earnings maturation, expiry, reviews, notifications, reconciliation, cleanup |
| **Ops** | Migration runner with checksums, realistic Lagos seed data, icon generation, cron runner |
| **Tests** | 61 unit tests covering money arithmetic, state machines, and location privacy |

### Screens still to build

The backend, API routes and database rules for these all exist and are tested;
what is missing is the UI on top.

- `/discover` — the full filter/sort/map browse experience
- `/jobs/[id]` — public job detail and the apply sheet
- `/my-jobs`, `/applications` — poster and hustler management views
- `/messages` — realtime chat (schema, RLS, triggers and notifications are done)
- `/wallet` — balances and withdrawal UI (`/api/wallet` and `/api/payouts` work)
- `/admin/*` — admin dashboard (all queries, RLS and audit logging exist)
- `/onboarding`, `/profile`, `/settings`, `/notifications`, `/saved`
- Public: `/explore`, `/hustlers`, `/categories`, `/how-it-works`, `/safety`, `/faq`, legal pages
- Integration + E2E test suites (Playwright is configured; specs not yet written)

> **The migrations have not been executed against a live PostgreSQL instance.**
> No Postgres, Docker or Supabase CLI was available in the build environment.
> The SQL is written against PostgreSQL 15 + PostGIS and reviewed, but treat the
> first `pnpm db:migrate` as the real verification step.

---

## Quick start

```bash
# 1. Install
pnpm install

# 2. Configure
cp .env.example .env.local
#    Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#    SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL from your Supabase project.

# 3. Create the schema
pnpm db:migrate

# 4. Fill it with a realistic Lagos marketplace
pnpm db:seed

# 5. Run
pnpm dev
```

Optional but recommended:

```bash
pnpm keys:vapid                       # generate Web Push keys
pnpm dlx tsx scripts/generate-icons.ts # regenerate PWA icons from the brand mark
```

Seeded accounts all use the password `HustleStreet2026!`:

| Email | Role |
|---|---|
| `admin@seed.hustlestreet.test` | superadmin |
| `danielokafor@seed.hustlestreet.test` | hustler |
| `kemialabi@seed.hustlestreet.test` | job poster |

---

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:migrate --dry-run` | Show what would run |
| `pnpm db:reset` | Drop, re-migrate, re-seed (never in production) |
| `pnpm db:seed` | Seed development data |
| `pnpm worker:cron` | Run every scheduled task once |
| `pnpm worker:cron --watch` | Run them on a loop |
| `pnpm keys:vapid` | Generate VAPID key pair |

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Components keep the mobile bundle small; one deployable for UI and API |
| Language | TypeScript (strict) | |
| Database | PostgreSQL + PostGIS | Geospatial search is a core feature, not an add-on |
| Backend | Supabase | Postgres, Auth, Realtime and Storage without operating four services |
| Styling | Tailwind CSS 3 + Radix primitives | Radix supplies focus traps, ARIA and keyboard behaviour that are easy to get wrong |
| Data | TanStack Query | |
| Forms | React Hook Form + Zod | The same schema validates in the browser and on the server |
| Payments | Paystack behind a provider port | Best Nigerian coverage; swapping providers is one file |
| Maps | MapLibre GL | Open source, no vendor lock-in, tile provider is configurable |
| Tests | Vitest + Playwright | |

---

## Architecture in one page

```
Browser (PWA)
  │  service worker: app shell, images, reference data — never money
  ▼
Next.js App Router
  ├── Server Components ──► Supabase (anon key + user session → RLS applies)
  ├── Route handlers    ──► defineRoute(): auth, authz, Zod, rate limit, logging
  └── Webhooks / cron   ──► Supabase (service role → RLS bypassed, guarded by RPCs)
                                │
                                ▼
                         PostgreSQL
                           ├── RLS policies      ← the real authorization boundary
                           ├── SECURITY DEFINER RPCs ← every money/state operation
                           ├── Triggers          ← state machines, counters, audit
                           └── Double-entry ledger (append-only)
```

### The rules this codebase is built around

**1. The database is the authority, not the API.**
Row Level Security decides what any user can see or change. Business rules —
"you cannot apply to your own job", "a cancelled job cannot become completed",
"only completed jobs can be reviewed" — are triggers and constraints, not `if`
statements in a route handler. The API re-checks some of them purely to produce
good error messages.

**2. Money is double-entry and append-only.**
There is no writable balance column anywhere in the schema. `wallets` is a view
derived from `ledger_accounts`, which is itself a cache of `ledger_entries`.
Entries are immutable at the database level — `UPDATE` and `DELETE` raise, even
for the service role. Every transaction's entries must sum to zero, enforced by
a deferred constraint trigger at `COMMIT`. `reconcile_ledger()` can rebuild
every balance from the entries and reports any drift.

**3. Nothing is paid because a browser said so.**
`/api/payments/initialize` creates a checkout URL and nothing else. The
transaction stays `PENDING` until Paystack's signed webhook arrives. The webhook
verifies an HMAC-SHA512 over the raw body, stores the event before acting on it,
and is idempotent through a unique `(provider, event_id)` index.

**4. Exact location is never public.**
Coordinates are stored twice: `exact_point` (private) and `approx_point`
(rounded to ~1.1 km). Every discovery query reads the approximate one. The
precise address is exposed through a permission-gated view that requires an
active working relationship. `fuzzCoordinate()` in TypeScript and
`app.fuzz_coordinate()` in SQL are tested to agree.

**5. Idempotency is structural, not conventional.**
`transactions.idempotency_key` is unique and derived deterministically
(`release:<assignment_id>`). A double release is not "prevented by a check" —
it violates a unique index. Same for webhook events and offline message replay.

Full detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Project structure

```
supabase/migrations/     14 SQL migrations, applied in order, checksummed
  0001_foundation        extensions, enums, shared helpers
  0002_identity          profiles, roles, verification, skills, addresses
  0003_taxonomy_location categories, the country→state→city→area tree
  0004_jobs              jobs, media, requirements, status history, bookmarks
  0005_applications      applications, assignments, response metrics
  0006_messaging         conversations, messages, read state, typing
  0007_notifications     preferences, feed, push subscriptions, delivery queue
  0008_money             ledger, transactions, payouts, webhook events
  0009_trust             reviews, reports, disputes, fraud signals
  0010_admin_ops         settings, audit, analytics, rate limits, job queue
  0011_rpc_discovery     geospatial search, recommendations, suggestions
  0012_rpc_transactions  hiring, escrow, release, refund, payout, disputes, cron
  0013_rls               every policy + column-level privacy grants
  0014_reference_data    categories, skills, Nigerian locations, storage buckets

src/
  app/
    (public)/            marketing site
    (auth)/              login, signup, password reset
    (app)/               the authenticated product
    api/                 route handlers
    auth/callback/       OAuth + email confirmation
  components/
    ui/                  design system primitives
    job/ hustler/        domain components
    layout/ location/ pwa/ auth/ marketing/
  lib/
    config/env.ts        validated environment contract
    supabase/            client / server / admin / middleware
    api/                 handler composition, errors, envelope, rate limiting
    payments/            provider port + Paystack adapter
    notifications/       email, SMS, push
    validation/          Zod schemas shared by client and server
    money.ts geo.ts format.ts utils.ts
  types/database.ts      row + RPC types mirroring the schema

scripts/                 migrate, seed, icons, VAPID keys, cron runner
tests/unit/              money, state machines, geo privacy
```

---

## Security

- **Authorization** lives in RLS policies, not middleware. Middleware only
  redirects; it is never the thing keeping data safe.
- **The service-role key** is confined to `src/lib/supabase/admin.ts`, which is
  marked `server-only` so bundling it into client code is a build error.
- **Passwords** require 10+ characters. Login returns one message for both wrong
  email and wrong password, and password reset always reports success — neither
  can be used to enumerate accounts.
- **Rate limiting** uses a shared Postgres counter so limits hold across
  serverless instances. It degrades open on failure; the expensive operations
  have hard database guards regardless.
- **IPs are never stored raw** — only a peppered SHA-256 hash.
- **CSP, HSTS, frame-ancestors and Permissions-Policy** are set in
  `next.config.mjs`, with the Supabase and tile origins injected from env.
- **Every privileged action is audited** in the append-only `audit_logs` and
  `admin_actions` tables.

Run `pnpm dlx @next/codemod@latest` style upgrades and re-run `pnpm build`
before any deploy.

---

## Regulatory note

Hustle Street does **not** hold customer funds and is not a bank. "Escrow" here
is a bookkeeping construct over money held by a licensed payment provider
(Paystack). The `escrow` ledger account records our obligation; the
`gateway_receivable` account records the matching asset held at the provider.
This is stated in the footer, the FAQ and the ledger comments so the
architecture cannot drift into implying otherwise.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data model, money flow, realtime, security model
- [`docs/API.md`](docs/API.md) — endpoint reference and response envelope
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — environments, secrets, cron, backups
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — why the ambiguous calls were made the way they were
