# Decisions

The brief said: *"If a requirement is ambiguous, choose the most scalable and
secure solution and document the decision."* This is that document.

Each entry states the ambiguity, the call, and the reasoning — including what
was given up.

---

## 1. `PUBLISHED` and `APPLICATIONS_OPEN` are both real states

**Ambiguity.** The brief lists both, but they look like the same thing.

**Decision.** `PUBLISHED` is the instant after publishing; the first application
flips it to `APPLICATIONS_OPEN` automatically (trigger on `job_applications`).

**Why.** It gives an honest "no applicants yet" signal to both sides without a
separate column, and it leaves room for a future "published but paused" state.
Both are treated as open by every discovery query, so the distinction never
leaks into filtering logic.

---

## 2. Escrow is a ledger construct, not a held balance

**Ambiguity.** The brief asks for escrow but warns against creating regulatory
assumptions about holding funds.

**Decision.** Money never sits in a Hustle Street account. Funds stay with
Paystack. Our `escrow` ledger account records the *obligation*;
`gateway_receivable` records the matching *asset* at the provider. Release moves
the obligation to the hustler's balance and the commission to platform revenue.

**Why.** It is the accurate description of what actually happens, it keeps the
double-entry books balanced, and it avoids implying a deposit-taking business.
The trade-off is that a payout requires a real provider transfer rather than an
internal balance move — which is correct, just slower.

---

## 3. Balances are a view, not a column

**Decision.** `wallets` is a SQL view over `ledger_accounts`. There is no
writable balance column in the schema.

**Why.** A balance column is a cache that will eventually disagree with its
transactions, and by the time anyone notices, nobody can tell which is right.
`ledger_accounts.balance_minor` exists as a trigger-maintained cache for query
speed, but `app.recompute_account_balance()` can rebuild it from the immutable
entries at any time, and the nightly `reconcile` cron proves they still agree.

---

## 4. Commission rounds down

**Decision.** `floor(amount × bps / 10000)`. Any sub-kobo remainder goes to the
hustler.

**Why.** Rounding is a policy choice, and a platform that rounds in its own
favour is one a marketplace notices. Identical logic exists in
`app.compute_commission()` (SQL) and `computeCommission()` (TypeScript), and the
unit tests assert they agree across the full range.

---

## 5. Auto-confirmation exists, with a 72-hour default

**Ambiguity.** The brief's flow requires the poster to confirm. It does not say
what happens if they never do.

**Decision.** Escrow releases automatically 72 hours after submission
(configurable). Jobs under dispute are excluded.

**Why.** Without it, a poster who simply stops responding holds a hustler's
money indefinitely — the single most damaging failure mode for a marketplace
that depends on hustlers trusting it. The dispute exclusion means the escape
hatch stays open for genuine problems.

---

## 6. Reviews are double-blind

**Ambiguity.** The brief asks for mutual reviews but not the disclosure rule.

**Decision.** Reviews stay hidden until both sides submit, or 14 days pass.

**Why.** Sequential visible reviews produce retaliation: the second reviewer
responds to their own rating rather than to the work. Double-blind is what makes
the ratings mean anything. The 14-day fallback stops one silent party from
suppressing the other's review forever.

---

## 7. Location is fuzzed to two decimal places

**Ambiguity.** "Do not expose the exact private address" — but how approximate?

**Decision.** Public coordinates round to 2dp (~1.1 km). Distances under 500 m
render as "Under 500 m away". Precise coordinates live behind a view gated on an
active working relationship.

**Why.** One decimal place (~11 km) is useless in Lagos — it cannot tell Lekki
from Ikeja. Three (~110 m) identifies a building. Two keeps discovery genuinely
useful while making triangulation impractical. The fuzzing is deterministic so
repeated reads cannot be averaged back to the true position.

---

## 8. Recommendations are deterministic, not learned

**Decision.** A weighted linear score (location 30, skills 30, rating 15,
availability 15, experience 10) with the weights stored in `platform_settings`.
Each recommendation returns its component sub-scores and a human-readable
reason.

**Why.** With no usage data, an ML model would be guessing anyway. A
deterministic score can be explained to a user ("Matches your skills"),
debugged, and tuned from the admin dashboard without a deploy. The RPC contract
is designed so the scoring expression can be swapped for a model later without
any caller changing.

---

## 9. The API is REST-shaped over SECURITY DEFINER RPCs

**Ambiguity.** REST or RPC.

**Decision.** Both, deliberately. Reads and simple writes are REST route
handlers using the caller's RLS context. Anything transactional — hiring,
funding, release, refund, payout, dispute resolution — is a single Postgres RPC
called by a thin route.

**Why.** Multi-step money operations must be atomic. Doing them across several
HTTP-layer queries means a crash halfway through leaves the ledger unbalanced.
Inside a function, PostgreSQL rolls the whole thing back on any exception.

---

## 10. Rate limiting degrades open

**Decision.** If the rate-limit backend is unreachable, the request is allowed
and the failure is logged.

**Why.** Degrading closed turns a counter-table hiccup into a total outage.
Abuse is a smaller problem than downtime, and the operations worth abusing
(payments, payouts) have their own hard database-level guards that do not depend
on the limiter.

---

## 11. Emoji for category icons

**Decision.** Categories render as emoji, not an icon font or SVG sprite.

**Why.** Zero extra bytes, zero extra requests, instant render on a slow
connection, and they carry colour and warmth. On a mid-range Android phone in
Lagos this is a real performance decision, not a stylistic one. The `icon`
column exists on `categories` for a future switch to Lucide names.

---

## 12. Phone auth is first-class, not a fallback

**Decision.** Login offers email and phone as equal tabs.

**Why.** Email-first is a Western default. Plenty of Nigerian users check email
rarely and have their phone constantly. Making phone a hidden fallback would
push those users through a worse flow for no reason.

---

## 13. The service worker never caches money

**Decision.** `/api/wallet`, `/api/payouts`, `/api/payments` and `/api/webhooks`
are on an explicit never-cache list.

**Why.** A cached balance is a wrong balance. Showing a stale figure is worse
than showing a spinner, because a user will act on it. The offline page says so
explicitly.

---

## 14. Migrations are immutable once applied

**Decision.** The runner checksums each file. Editing an applied migration is a
hard error.

**Why.** An edited migration produces environments whose schemas silently
disagree — which is discovered later, in production, at the worst moment.

---

## 15. Seed data refuses to run in production

**Decision.** `scripts/seed.ts` exits if `NEXT_PUBLIC_APP_ENV=production`.
Seeded accounts use a `@seed.hustlestreet.test` domain that cannot receive mail.

**Why.** Brief §62 and §45: no fake data in production. A guard is more reliable
than a convention.

---

## 16. Auth errors do not reveal whether an account exists

**Decision.** Login returns one message for wrong-email and wrong-password.
Password reset always reports success. Signup reports the same for a taken email.

**Why.** Distinct responses turn any of these forms into an account-enumeration
oracle — the first step in credential stuffing. The cost is slightly vaguer
error copy, which is worth it.

---

## 17. Fraud signals decay

**Decision.** `fraud_signals` rows carry a 90-day `expires_at`, and the risk
score only counts unexpired ones.

**Why.** A burst of odd activity six months ago should not follow someone
forever. Permanent scoring makes a platform unappealable and eventually punishes
its best long-term users.

---

## 18. Users cannot see their own risk score

**Decision.** `fraud_signals` and `account_fingerprints` are staff-only in RLS,
even for the subject.

**Why.** Showing someone which signals fired is a roadmap for evading them.

---

## 19. Cancellation is blocked after submission

**Decision.** A poster cannot cancel a job once work has been submitted. The
only routes are confirmation or a dispute.

**Why.** Otherwise a poster receives finished work, cancels, gets a refund, and
the hustler has nothing. The dispute path handles the legitimate version of that
situation with evidence and a human decision.

---

## 20. Both `sonner` and Radix, rather than one component library

**Decision.** Hand-written primitives over Radix, plus `sonner` for toasts.

**Why.** Radix supplies the focus management, ARIA wiring and keyboard behaviour
that are genuinely hard to get right, while leaving all styling to us — which is
what "avoid generic SaaS styling" requires. A full component library would have
brought its own visual identity.

---

## 21. The primary button is ink, and orange is a plane

**Decision.** The design system was rebuilt on a hairline grid over warm paper,
with near-square geometry and no elevation. As part of that, `variant="primary"`
became near-black and the brand orange moved to its own `brand` variant.

**Why.** Orange was previously the colour of every action, which meant it was the
colour of "button" rather than the colour of the product. Reserving it for one or
two moments per screen is what makes it register at all.

Contrast forced the same conclusion independently. The brand orange (`#FF5229`)
measures **3.12:1** on paper and **2.91:1** on the soft orange fill — fine for an
icon under WCAG 1.4.11, never legible enough for type. So the palette carries two
cuts, and which one you reach for is not a matter of taste:

| Use | Token | Ratio |
| --- | --- | --- |
| Flat plane, block fill, standalone icon | `primary` | 3.12:1 on paper |
| Any orange **text** or link | `primary-text` (`#B75002`) | 4.87:1 on paper |
| Label **on** an orange plane | `primary-foreground` (white) | 3.24:1 |

**The label on an orange plane is a deliberate exception.** White on `#FF5229`
measures 3.24:1 — AA for large text, below the 4.5:1 that a normal-size button
label needs. Ink would have measured 6.15:1 and was the original choice; white
was chosen afterwards for brand reasons, with the trade-off understood.

What keeps it defensible: orange is never the only route to an action (every
orange CTA has an ink-filled equivalent elsewhere in the flow), and the labels
are short, repeated words rather than content anyone reads carefully.

If AA on these buttons becomes a requirement, change `--primary` to
`11 100% 44%` (`#E02900`) rather than the foreground token — white reaches
4.68:1 there, at the same hue and saturation.

**What was given up.** Orange CTAs were a recognisable Hustle Street asset, and
the top-of-funnel "Post a job" button keeps them. Everywhere else the action is
ink, and the brand shows up as the block sequence under the hero, the ramp in the
footer and the band on the auth panel.

---

## 22. Custom `text-*` scale steps must be declared to `tailwind-merge`

**Decision.** `src/lib/utils.ts` maintains a `FONT_SIZES` list mirroring the
`fontSize` keys in `tailwind.config.ts`, wired in through `extendTailwindMerge`.

**Why.** `text-` is the prefix for both font size and text colour, so
`tailwind-merge` disambiguates by matching against the sizes it knows. It knows
Tailwind's built-in names, not ours — so `text-button-sm` fell through to the
colour group and collided with `text-ink-foreground` in the same `cn()` call. The
later class won and the colour was silently dropped, which shipped every
ink-filled button with an invisible ink-on-ink label.

Nothing about the failure is visible at the type level or in a build: the class
string looks right in the source and simply arrives short in the DOM.

**Consequence.** Adding a step to `fontSize` without adding it to `FONT_SIZES`
reintroduces the bug for that step. Both lists live with a comment saying so.
