# Architecture

## The shape of the thing

```
Browser (installable PWA)
  │   service worker: app shell, images, reference data
  │   NEVER cached: /api/wallet, /api/payouts, /api/payments, /api/webhooks
  ▼
Next.js 15 App Router
  ├── Server Components ─────► Supabase (anon key + user session → RLS applies)
  ├── Route handlers ────────► defineRoute(): authn, authz, Zod, rate limit, logs
  └── Webhooks / cron ───────► Supabase service role (RLS bypassed; RPCs guard)
                                     │
                                     ▼
                              PostgreSQL 15 + PostGIS
                                ├── RLS policies            ← authorization
                                ├── SECURITY DEFINER RPCs   ← transactional ops
                                ├── Triggers                ← state machines, counters
                                └── Double-entry ledger     ← append-only
```

There are three ways to reach the database, and they are different on purpose:

| Path | Key | RLS | Used for |
|---|---|---|---|
| `lib/supabase/client.ts` | anon | yes | Browser reads, realtime subscriptions |
| `lib/supabase/server.ts` | anon + session cookie | yes | Server Components, route handlers |
| `lib/supabase/admin.ts` | service role | **no** | Webhooks, cron, notification fan-out |

`admin.ts` is marked `server-only`, so importing it from a client component is a
build error rather than a silent key disclosure.

---

## Authorization

**The API layer is not the security boundary. RLS is.**

Every table has `enable row level security` and an explicit policy list
(`0013_rls.sql`). A user's own data is reachable; everything else is not. Route
handlers re-check some rules to produce good error messages, but if every route
handler were deleted tomorrow, the data would still be safe.

Three helpers back the policies, all `SECURITY DEFINER` with a pinned
`search_path` so they cannot be hijacked:

- `app.has_role(role)` — hierarchical: superadmin ⊃ admin ⊃ moderator
- `app.is_conversation_member(conversation, user)` — avoids the infinite
  recursion you get when a policy on `conversation_members` queries it
- `app.has_job_relationship(a, b)` — gates precise addresses and contact details

### Column-level privacy

Row policies control *which rows*. Grants control *which columns*. The `anon`
and `authenticated` roles simply have no `SELECT` privilege on
`profiles.email`, `profiles.phone`, `profiles.home_lat/lng`, or
`jobs.exact_lat/lng` — so even a `select *` cannot leak them. Owners read their
own private columns through the `my_profile` view; counterparties read a job's
precise location through `job_precise_location`, which is gated on an active
working relationship.

---

## The money model

### Chart of accounts

| Account kind | Type | Increases on | Scope |
|---|---|---|---|
| `user_available` | liability | credit | per user |
| `user_pending` | liability | credit | per user |
| `escrow` | liability | credit | per assignment |
| `platform_revenue` | income | credit | platform |
| `gateway_receivable` | asset | debit | platform |
| `payout_clearing` | liability | credit | per user |
| `gateway_fees` | expense | debit | platform |

### The flows

**Funding escrow** (NGN 20,000):

```
DEBIT   gateway_receivable     20,000    money arrives at Paystack
CREDIT  escrow(assignment)     20,000    we owe it into escrow
```

**Release** (10% commission):

```
DEBIT   escrow(assignment)     20,000
CREDIT  user_pending(hustler)  18,000
CREDIT  platform_revenue        2,000
```

**Maturation** (after the clearing period, by cron):

```
DEBIT   user_pending(hustler)  18,000
CREDIT  user_available(hustler) 18,000
```

**Withdrawal** (NGN 18,000 with a NGN 50 fee):

```
DEBIT   user_available         18,000
CREDIT  payout_clearing        17,950
CREDIT  platform_revenue           50
```

then on `transfer.success`:

```
DEBIT   payout_clearing        17,950
CREDIT  gateway_receivable     17,950    money leaves the provider
```

and on failure the whole thing reverses cleanly back to `user_available`.

**Refund**:

```
DEBIT   escrow(assignment)     20,000
CREDIT  gateway_receivable     20,000
```

### The four guarantees

1. **Every posting balances.** A deferred constraint trigger checks at `COMMIT`
   that each transaction's entries sum to zero. A half-written posting cannot be
   persisted.
2. **Entries are immutable.** `UPDATE` and `DELETE` on `ledger_entries` raise —
   even for the service role. Financial history cannot be rewritten.
3. **Balances cannot go negative** where that would be nonsense. The
   `apply_ledger_entry` trigger takes a row lock and refuses to drive
   `user_available`, `user_pending` or `escrow` below zero. This is the last
   line of defence against a double-withdrawal race.
4. **Balances are derived.** `wallets` is a view.
   `ledger_accounts.balance_minor` is a trigger-maintained cache that
   `reconcile_ledger()` verifies nightly and `app.recompute_account_balance()`
   can rebuild from entries.

### Idempotency

Structural, not conventional:

| Operation | Key | Enforced by |
|---|---|---|
| Escrow funding | `escrow:<assignment_id>` | unique index |
| Release | `release:<assignment_id>` | unique index |
| Refund | `refund:<assignment_id>:<amount>` | unique index |
| Payout | `payout:<payout_id>` | unique index |
| Maturation | `mature:<assignment_id>` | unique index |
| Webhook | `(provider, event_id)` | unique index |
| Offline message | `(conversation, sender, client_nonce)` | unique index |

A double release is not "prevented by a check". It violates a unique index.

---

## State machines

Both live in the database as `IMMUTABLE` functions, so they are the single
source of truth and cannot drift from what the API believes.

**Jobs** — `app.is_valid_job_transition()`:

```
DRAFT → PUBLISHED → APPLICATIONS_OPEN → HIRED → IN_PROGRESS → SUBMITTED → COMPLETED
                                                                   │
                                                                   └→ DISPUTED → COMPLETED | CANCELLED
```

`COMPLETED` and `CANCELLED` are terminal. `SUBMITTED` cannot go to `CANCELLED` —
otherwise a poster could take delivered work for free.

**Payments** — `app.is_valid_transaction_transition()`:

```
PENDING → AUTHORIZED → HELD → RELEASED
                        │ └─→ REFUNDED
                        └───→ DISPUTED → RELEASED | REFUNDED
```

`REFUNDED` is terminal. `RELEASED → REFUNDED` exists for admin reversals only.

A trigger also freezes completed jobs: the title, description, budget and
category cannot change once `status = 'COMPLETED'`.

---

## Location and privacy

Coordinates are stored twice, both as generated columns:

```sql
exact_point  generated always as (point_from_lat_lng(exact_lat, exact_lng)) stored
approx_point generated always as (point_from_lat_lng(
               fuzz_coordinate(exact_lat), fuzz_coordinate(exact_lng))) stored
```

`fuzz_coordinate` rounds to 2 decimal places (~1.1 km). Every discovery query,
map endpoint and job card reads `approx_point`. `exact_point` is only reachable
through `job_precise_location`, which requires an active working relationship.

GIST indexes back both. `search_jobs` uses `ST_DWithin` for the radius filter
and `ST_Distance` for ranking, so "jobs within 10 km, nearest first" is a single
index scan.

The TypeScript `fuzzCoordinate()` and the SQL `app.fuzz_coordinate()` are
asserted to agree in `tests/unit/geo-and-privacy.test.ts`.

---

## Discovery and ranking

`search_jobs` does the whole job in one round trip: geospatial filter, text
match, attribute filters, ranking, pagination and a total count. Text search is
full-text first with a trigram-similarity fallback, so "plumer" still finds
"plumber".

`recommend_jobs` scores each candidate on five factors with weights read from
`platform_settings`:

```
score = location x 30 + skills x 30 + rating x 15 + availability x 15 + experience x 10
```

It returns the component sub-scores alongside the total, plus a short reason
("Matches your skills", "Few applicants so far"). Weights are tunable from the
admin dashboard. Swapping in a model later means replacing one expression; the
RPC contract stays identical.

---

## Notifications

Intent and delivery are deliberately separate:

```
domain code → INSERT notifications (intent)
                    │ trigger: app.fanout_notification()
                    ▼
              notification_deliveries (one row per enabled channel)
                    │ cron: drains the queue
                    ▼
              in-app │ web push │ email │ SMS
```

The fan-out trigger honours per-topic preferences and quiet hours (deferring
rather than dropping), and critical notifications — security alerts, payment
released — bypass both. Because delivery is a queue, a failing SMS provider can
never break a job flow.

Retries use exponential backoff (1m, 4m, 9m) and give up after four attempts.
Push subscriptions that return 404/410 are marked dead so the worker stops
wasting requests on them.

---

## Offline behaviour

| Resource | Strategy |
|---|---|
| App shell, navigations | network-first, offline page fallback |
| `/_next/static/*`, icons | cache-first (immutable) |
| Images | cache-first, 80-entry cap |
| `/api/categories`, `/api/locations` | stale-while-revalidate |
| Other `/api/*` reads | network-first, 5-minute stale window |
| **Wallet, payouts, payments, webhooks** | **never cached** |

Messages and applications composed offline go into an IndexedDB outbox and are
replayed by a background sync. Each carries a client nonce, so a replay that
races the original cannot duplicate. Financial actions are deliberately absent
from that queue — the server is always the authority on money.

---

## Fraud

`fraud_signals` rows carry a severity and a 90-day expiry.
`app.recompute_risk_score()` combines unexpired signals with behavioural
counters:

```
score = signals + (shared_device_accounts x 12) + (cancellations x 5) + (lost_disputes x 15)
```

Bucketed into low / medium / high / critical. High-risk accounts cannot withdraw
until reviewed. Device and payout fingerprints are hashed with a server-side
pepper before storage, and users cannot see their own signals — that would be a
roadmap for evading them.

---

## Performance

- **Indexes are written for the actual queries**, including partial indexes on
  open jobs only, so the hot discovery path never scans closed listings.
- **`total_count` is computed once** inside the search CTE, not as a second
  round trip.
- **Server Components by default.** Client components are limited to things that
  genuinely need interactivity.
- **Query defaults tuned for mobile networks**: one retry, no refetch on window
  focus (which fires on every app switch on a phone), refetch on reconnect.
- **Emoji category icons** — zero extra requests on a slow connection.
- **`next/font`** self-hosts Inter Tight, Inter and Figtree, so there is no
  render-blocking request to a font CDN. Only the 400/500/600 cuts ship — the
  type scale has no weight above 500, so heavier files would be dead payload.
