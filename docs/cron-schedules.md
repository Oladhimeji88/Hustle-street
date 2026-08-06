# Cron schedules

## The constraint

Vercel's Hobby plan permits **daily crons only**. Any expression that would fire
more than once in 24 hours is rejected at deploy time, not at runtime, so a
single sub-daily entry fails the whole deployment:

```
Hobby accounts are limited to daily cron jobs. This cron expression
(*/2 * * * *) would run more than once per day.
```

## What changed, and what it costs

Three jobs were throttled to get a Hobby deployment through. The schedules in
`vercel.json` are **not** the schedules this product wants:

| Task | Wants | Currently | Consequence of the gap |
|---|---|---|---|
| `notifications` | every 2 min | daily 06:00 | **Severe.** Push notifications for new nearby jobs are the mechanism that makes the marketplace feel live. Daily batching means a hustler hears about a job up to 24 hours after it is posted, by which point it is usually filled. |
| `auto-confirm` | every 15 min | daily 07:00 | **Moderate.** The 72-hour auto-release still happens, just checked once a day, so a payout can land up to 24 hours later than promised. The guarantee holds; the timing slips. |
| `mature-earnings` | hourly | daily 08:00 | **Minor.** Earnings clear once a day instead of hourly. Withdrawals become available later, but no money is at risk. |

The remaining four were already daily and are unaffected.

## Fixing it properly

**Option A: upgrade to Vercel Pro.** Restore the original expressions:

```json
{ "path": "/api/cron/notifications",    "schedule": "*/2 * * * *" },
{ "path": "/api/cron/auto-confirm",     "schedule": "*/15 * * * *" },
{ "path": "/api/cron/mature-earnings",  "schedule": "0 * * * *" },
```

**Option B: drive them externally.** The endpoints are ordinary authenticated
routes and do not care what invokes them. Any external scheduler works:

```
GET https://<your-domain>/api/cron/notifications
Authorization: Bearer $CRON_SECRET
```

`CRON_SECRET` is already set in the Vercel production environment. A GitHub
Actions workflow on a `schedule:` trigger, cron-job.org, or any small always-on
box can call these at the real cadence while the daily Vercel entries stay as a
backstop. Note that GitHub Actions' own scheduler is best-effort and can drift
by several minutes under load, which is fine for these tasks but worth knowing.

Whichever route is taken, the table above should go back to matching reality.
