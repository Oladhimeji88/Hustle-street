# API reference

## Response envelope

Every endpoint returns the same shape, so a client never has to guess whether it
received data or an error.

```jsonc
// success
{ "ok": true, "data": { }, "meta": { "page": 1, "pageSize": 20, "total": 84, "hasMore": true } }

// failure
{ "ok": false, "error": { "code": "INVALID_STATE", "message": "This job is no longer open.", "details": [] } }
```

Switch on `error.code`, never on `error.message` — the wording will change and
will eventually be translated.

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Field-level problem; `details` lists `{path, message}` |
| `BAD_REQUEST` | 400 | Malformed request |
| `UNAUTHENTICATED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `ACCOUNT_SUSPENDED` | 403 | Account restricted, suspended or banned |
| `PAYMENT_REQUIRED` | 402 | The job needs funding first |
| `NOT_FOUND` | 404 | Missing, or exists but is not visible to you |
| `CONFLICT` / `ALREADY_EXISTS` | 409 | Duplicate |
| `INVALID_STATE` | 422 | Well-formed, but the domain refused it |
| `INSUFFICIENT_BALANCE` | 422 | Not enough available balance |
| `LIMIT_EXCEEDED` | 422 | A platform limit was hit |
| `RATE_LIMITED` | 429 | Back off; see `Retry-After` |
| `INTERNAL_ERROR` | 500 | Unexpected |
| `PROVIDER_ERROR` | 502 | A third party failed |
| `SERVICE_UNAVAILABLE` | 503 | Transient; safe to retry |

A `404` is returned both for records that do not exist and for records you are
not allowed to see. That symmetry is deliberate — a `403` would confirm the
record is real.

### Headers

Responses carry `x-request-id` (echoed from the request if supplied, useful for
correlating with server logs). Rate-limited routes add `X-RateLimit-Limit`,
`X-RateLimit-Remaining` and `X-RateLimit-Reset`.

---

## Endpoints

### Discovery

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/api/jobs` | optional | Geospatial + text search. Returns approximate distance only |
| `GET` | `/api/jobs/:id` | optional | Detail. Exact location only if you are the poster or hired hustler |
| `GET` | `/api/jobs/recommended` | required | Scored feed for hustlers, with per-factor reasons |
| `GET` | `/api/hustlers` | optional | Hustler search |
| `GET` | `/api/search/suggestions` | optional | Typo-tolerant autocomplete |
| `GET` | `/api/categories` | none | Taxonomy |
| `GET` | `/api/locations` | none | Area autocomplete |

`GET /api/jobs` query parameters: `q`, `lat`, `lng`, `radiusKm`, `categories`
(csv), `minBudget`, `maxBudget` (minor units), `urgency` (csv), `locationKind`
(csv), `minRating`, `postedWithinHours`, `sort`
(`relevant|nearest|newest|highest_paying|urgent`), `page`, `pageSize`.

### Jobs

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/jobs` | required | Creates a **draft**. Does not publish |
| `PATCH` | `/api/jobs/:id` | required | Poster only. Completed jobs are frozen |
| `DELETE` | `/api/jobs/:id` | required | Soft delete |
| `POST` | `/api/jobs/:id/publish` | required | Runs limits, area labelling, notification fan-out |
| `POST` | `/api/jobs/:id/cancel` | required | Refunds held escrow. Blocked after submission |
| `POST`/`DELETE` | `/api/jobs/:id/save` | required | Bookmark |
| `GET` | `/api/jobs/saved/ids` | required | Bookmark ids |

Creation and publication are separate calls on purpose: a draft is cheap and
private, publishing is what notifies people.

### Applications and hiring

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/api/jobs/:id/applications` | required | Poster only |
| `POST` | `/api/jobs/:id/applications` | required | Apply. Enforces daily cap, blocks, invite-only |
| `PATCH` | `/api/applications/:id` | required | `accept` \| `decline` \| `shortlist` \| `unshortlist` |
| `DELETE` | `/api/applications/:id` | required | Hustler withdraws |
| `POST` | `/api/assignments/:id/submit` | required | Hustler marks work done |
| `POST` | `/api/assignments/:id/confirm` | required | Poster confirms → **releases payment** |

`accept` is a single atomic RPC: it creates the agreement, declines every other
applicant, moves the job to `HIRED`, opens the job conversation and creates the
escrow-funding transaction.

### Money

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/payments/initialize` | required | Returns a checkout URL. **Marks nothing as paid** |
| `POST` | `/api/webhooks/paystack` | signature | The only thing that can confirm a payment |
| `GET` | `/api/wallet` | required | Balances (from the ledger view) + history |
| `POST` | `/api/payouts` | required | Withdraw. Debits available balance immediately |

### Notifications, ops

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST`/`DELETE` | `/api/notifications/subscribe` | required | Web Push subscription |
| `GET`/`HEAD` | `/api/health` | none | `HEAD` = liveness, `GET` = readiness |
| `POST`/`GET` | `/api/cron/:task` | `CRON_SECRET` | Scheduled maintenance |

Cron tasks: `notifications`, `auto-confirm`, `mature-earnings`, `expire-jobs`,
`publish-reviews`, `reconcile`, `cleanup`.

---

## Rate limits

| Bucket | Limit | Window |
|---|---|---|
| `authSignIn` | 8 | 5 min |
| `authSignUp` | 5 | 1 h |
| `authOtp` | 5 | 15 min |
| `jobCreate` | 20 | 1 h |
| `applicationCreate` | 30 | 1 h |
| `messageSend` | 90 | 1 min |
| `paymentInitialize` | 12 | 10 min |
| `payoutRequest` | 5 | 1 h |
| `search` | 120 | 1 min |
| `read` | 300 | 1 min |

Authenticated callers are limited per user, anonymous per hashed IP — IP-only
limiting would punish everyone behind one NAT, which in Lagos means a whole
office or campus.

---

## Webhook contract

`POST /api/webhooks/paystack`

1. The raw body is read **before** any parsing — re-serialising JSON would
   change byte order and invalidate the HMAC.
2. Signature: HMAC-SHA512 of the raw body with the secret key, compared in
   constant time against `x-paystack-signature`. A mismatch returns `401` with
   no explanation.
3. The event is inserted into `payment_webhook_events` **before** processing.
   The unique `(provider, event_id)` index makes a replay a no-op.
4. Processing calls the relevant RPC (`record_escrow_funding`, `settle_payout`).
5. Response is `200` for anything successfully stored — even if processing then
   failed. A `5xx` would make Paystack retry forever; the stored event is
   replayed by the `reconcile` cron instead.

If the amount the provider reports differs from the amount we asked for, the
transaction is marked `FAILED`, a `payment_amount_mismatch` fraud signal is
raised, and the escrow is **not** funded.
