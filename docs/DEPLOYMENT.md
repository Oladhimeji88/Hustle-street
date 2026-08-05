# Deployment

## Environments

| Environment | Purpose | Payment keys | Indexed by search |
|---|---|---|---|
| `development` | Local | `sk_test_` / `pk_test_` | no |
| `staging` | Pre-production, real integrations | `sk_test_` / `pk_test_` | no |
| `production` | Live | `sk_live_` / `pk_live_` | yes |

`src/lib/config/env.ts` enforces this. Production **refuses to boot** with a
test payment key, a `console` email provider, or a `CRON_SECRET` under 24
characters. That is deliberate: these are mistakes you want to find at deploy
time, not at first payment.

`app/layout.tsx` also sets `robots: noindex` outside production, so a staging
marketplace never competes with the real one in search results.

---

## First deploy

### 1. Database (Supabase)

Create the project, then enable the required extensions. `postgis` is not
optional — geospatial discovery depends on it.

```sql
create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists btree_gin;
```

Apply the schema:

```bash
DATABASE_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres" \
  pnpm db:migrate
```

Verify:

```sql
select version, applied_at from schema_migrations order by version;
select count(*) from categories;   -- 15
select count(*) from locations;    -- ~60
```

Confirm RLS is on everywhere — this query must return zero rows:

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename not in ('schema_migrations')
  and not rowsecurity;
```

### 2. Storage

Buckets are created by migration `0014` when run against Supabase. Confirm
`avatars`, `job-media` and `portfolio` are public, and `chat-media`,
`verification` and `disputes` are **private** — those hold ID documents and
dispute evidence.

### 3. Auth

In the Supabase dashboard:

- Site URL → your production origin
- Redirect URLs → `https://<origin>/auth/callback`
- Enable Google provider (add the OAuth client ID/secret)
- Enable phone auth and connect an SMS provider
- Email templates → point at your own domain

### 4. Payments (Paystack)

- Webhook URL → `https://<origin>/api/webhooks/paystack`
- Subscribe to: `charge.success`, `charge.failed`, `transfer.success`,
  `transfer.failed`, `transfer.reversed`, `refund.processed`
- Enable Transfers (required for payouts) and fund the balance
- Whitelist Paystack's webhook IPs at the edge if your host supports it

The webhook verifies an HMAC-SHA512 signature over the raw body, so it needs
`nodejs` runtime — already set in the route.

### 5. Push notifications

```bash
pnpm keys:vapid
```

Add both keys to the environment. Rotating the private key invalidates every
existing subscription, so do it only when necessary.

### 6. Frontend (Vercel or equivalent)

Set every variable from `.env.example`. Then:

```bash
pnpm build
```

`vercel.json` registers the seven cron schedules. On another host, point your
scheduler at `POST /api/cron/<task>` with
`Authorization: Bearer $CRON_SECRET`, or run `pnpm worker:cron --watch` as a
long-lived worker.

---

## Pre-launch checklist

**Correctness**
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass
- [ ] Migrations applied; `schema_migrations` matches the repo
- [ ] `select * from reconcile_ledger();` returns zero rows
- [ ] A test payment reaches `HELD`, and confirmation reaches `RELEASED`
- [ ] A replayed webhook returns `{ received: true, duplicate: true }`

**Security**
- [ ] The RLS check above returns zero rows
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is not present in any client bundle
      (`grep -r "service_role" .next/static/` must find nothing)
- [ ] `CRON_SECRET` is 32+ random characters
- [ ] Production is using live payment keys
- [ ] Security headers present (`curl -I https://<origin>`)

**Operations**
- [ ] Point-in-time recovery enabled on the database
- [ ] `/api/health` wired to uptime monitoring
- [ ] Error tracking configured
- [ ] An alert on `ledger.drift_detected` in `audit_logs` — that event means the
      cached balances disagree with the immutable entries, and it should page
      someone

**Product**
- [ ] Terms, Privacy and Cookies pages published
- [ ] Support email monitored
- [ ] At least one `superadmin` account exists with 2FA on the email

---

## Backup and recovery

Supabase provides daily backups and point-in-time recovery on paid plans. Enable
PITR before launch.

What matters most, in order:

1. `ledger_entries` and `transactions` — immutable financial history. These
   cannot be reconstructed from anything else.
2. `payment_webhook_events` — the provider's own record of what happened, which
   is what lets you replay a bad day.
3. `job_assignments` — the agreements the money hangs off.

Everything else (search vectors, counters, cached balances) can be rebuilt from
those three.

A restore drill is worth running once before launch: restore into a scratch
project, run `select * from reconcile_ledger();`, and confirm it comes back
empty.

---

## Scaling notes

The first bottlenecks, roughly in the order you will meet them:

1. **Notification fan-out.** `publish_job` caps at 200 recipients per post. Past
   a few thousand daily posts, move fan-out into `background_jobs`.
2. **Geospatial queries.** The GIST indexes hold well into the millions of rows.
   Beyond that, partition `jobs` by `country_code`.
3. **Realtime connections.** Supabase Realtime has per-plan limits. The UI is
   built to fall back to polling, so a limit degrades rather than breaks.
4. **The ledger.** Append-only and only ever queried by account, so it scales
   linearly. Archive `ledger_entries` older than two years to cold storage if it
   becomes unwieldy.
