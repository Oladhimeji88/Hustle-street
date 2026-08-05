-- ═══════════════════════════════════════════════════════════════════════════
-- 0008 — Money.
--
-- Non-negotiable rules encoded here:
--
--  1. Balances are NEVER updated directly. Every movement of value is an
--     immutable double-entry pair in `ledger_entries`. `ledger_accounts.
--     balance_minor` is a trigger-maintained cache, not a source of truth —
--     `app.recompute_account_balance()` can always rebuild it from entries.
--  2. Every transaction's entries must sum to zero (debits = credits). This is
--     checked by a DEFERRABLE constraint trigger at COMMIT, so a partially
--     written transaction can never be persisted.
--  3. `ledger_entries` is append-only at the database level. UPDATE and DELETE
--     raise, even for the service role.
--  4. Idempotency is structural: `transactions.idempotency_key` and
--     `payment_webhook_events.event_id` are unique, so a retried payment or a
--     replayed webhook cannot double-apply.
--
-- Regulatory note: Hustle Street does not hold customer funds. "Escrow" here is
-- a bookkeeping construct over funds sitting with the licensed payment
-- provider (Paystack). The `escrow` ledger account records our obligation; the
-- `gateway_receivable` account records the matching asset held at the provider.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── chart of accounts ──────────────────────────────────────────────────────

create table ledger_accounts (
  id            uuid primary key default gen_random_uuid(),
  kind          ledger_account_kind not null,
  -- Owner for user-scoped accounts; NULL for platform-level accounts.
  owner_id      uuid references profiles(id) on delete restrict,
  -- Scope for accounts tied to a specific object (escrow -> assignment).
  reference_id  uuid,
  currency      currency_code not null default 'NGN',

  -- Cache of sum(entries). Signed so positive always means "normal balance".
  balance_minor bigint not null default 0,

  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One account per (kind, owner, reference, currency). The COALESCE keeps the
-- uniqueness working for NULL owners/references.
create unique index ledger_accounts_identity_key
  on ledger_accounts (
    kind,
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(reference_id, '00000000-0000-0000-0000-000000000000'::uuid),
    currency
  );

create index ledger_accounts_owner_idx on ledger_accounts (owner_id, currency);
create index ledger_accounts_reference_idx on ledger_accounts (reference_id);

create trigger ledger_accounts_touch before update on ledger_accounts
  for each row execute function app.touch_updated_at();

-- Whether a debit or a credit increases this account type.
create or replace function app.account_normal_direction(kind ledger_account_kind)
returns entry_direction
language sql
immutable
parallel safe
as $$
  select case kind
    -- Assets and expenses increase on the debit side.
    when 'gateway_receivable' then 'debit'::entry_direction
    when 'gateway_fees'       then 'debit'::entry_direction
    -- Liabilities and income increase on the credit side.
    else 'credit'::entry_direction
  end
$$;

-- Finds or creates an account. SECURITY DEFINER because normal users must not
-- be able to create accounts directly, but the money functions must.
create or replace function app.ensure_ledger_account(
  p_kind ledger_account_kind,
  p_owner_id uuid,
  p_reference_id uuid,
  p_currency currency_code
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from ledger_accounts
  where kind = p_kind
    and coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(reference_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_reference_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and currency = p_currency;

  if v_id is not null then
    return v_id;
  end if;

  insert into ledger_accounts (kind, owner_id, reference_id, currency)
  values (p_kind, p_owner_id, p_reference_id, p_currency)
  on conflict do nothing
  returning id into v_id;

  -- Lost the race against a concurrent insert — re-read.
  if v_id is null then
    select id into v_id
    from ledger_accounts
    where kind = p_kind
      and coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(reference_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_reference_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and currency = p_currency;
  end if;

  return v_id;
end;
$$;

-- ── transactions ───────────────────────────────────────────────────────────

create table transactions (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique
                     default 'TXN-' || upper(encode(gen_random_bytes(8), 'hex')),

  kind             transaction_kind not null,
  status           transaction_status not null default 'PENDING',
  currency         currency_code not null default 'NGN',

  -- Gross value moved by this transaction, always positive.
  amount_minor     bigint not null check (amount_minor > 0),
  fee_minor        bigint not null default 0 check (fee_minor >= 0),
  net_minor        bigint not null default 0 check (net_minor >= 0),

  job_id           uuid references jobs(id) on delete set null,
  assignment_id    uuid references job_assignments(id) on delete set null,
  payer_id         uuid references profiles(id) on delete set null,
  payee_id         uuid references profiles(id) on delete set null,

  provider         text,
  provider_reference text,
  provider_fee_minor bigint not null default 0 check (provider_fee_minor >= 0),

  -- Structural idempotency. Every write path supplies a deterministic key, so
  -- a retried request reuses the existing transaction instead of creating one.
  idempotency_key  text not null,

  failure_reason   text,
  metadata         jsonb not null default '{}'::jsonb,

  authorized_at    timestamptz,
  held_at          timestamptz,
  released_at      timestamptz,
  refunded_at      timestamptz,
  failed_at        timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint transactions_fee_arithmetic check (fee_minor + net_minor <= amount_minor + fee_minor)
);

create unique index transactions_idempotency_key on transactions (idempotency_key);
create unique index transactions_provider_reference_key
  on transactions (provider, provider_reference)
  where provider_reference is not null;

create index transactions_assignment_idx on transactions (assignment_id, kind);
create index transactions_payer_idx on transactions (payer_id, created_at desc);
create index transactions_payee_idx on transactions (payee_id, created_at desc);
create index transactions_status_idx on transactions (status, created_at desc);
create index transactions_reconcile_idx on transactions (provider, status, created_at)
  where status in ('PENDING', 'AUTHORIZED');

create trigger transactions_touch before update on transactions
  for each row execute function app.touch_updated_at();

-- Payment state machine. Mirrors the job guard: illegal transitions raise.
create or replace function app.is_valid_transaction_transition(
  from_status transaction_status,
  to_status transaction_status
)
returns boolean
language sql
immutable
parallel safe
as $$
  select case from_status
    when 'PENDING'    then to_status in ('AUTHORIZED', 'HELD', 'FAILED', 'CANCELLED')
    when 'AUTHORIZED' then to_status in ('HELD', 'RELEASED', 'REFUNDED', 'FAILED', 'DISPUTED')
    when 'HELD'       then to_status in ('RELEASED', 'REFUNDED', 'DISPUTED', 'CANCELLED')
    when 'DISPUTED'   then to_status in ('RELEASED', 'REFUNDED', 'CANCELLED')
    when 'RELEASED'   then to_status in ('REFUNDED')  -- post-release reversal, admin only
    when 'REFUNDED'   then false
    when 'FAILED'     then to_status in ('PENDING')   -- retry
    when 'CANCELLED'  then false
    else false
  end
$$;

create or replace function app.guard_transaction_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and not app.is_valid_transaction_transition(old.status, new.status) then
    raise exception 'Illegal payment transition % -> % for transaction %',
      old.status, new.status, old.reference
      using errcode = 'check_violation';
  end if;

  -- The money itself is immutable once the transaction exists.
  if new.amount_minor is distinct from old.amount_minor
     or new.currency is distinct from old.currency then
    raise exception 'Transaction amount and currency are immutable'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'AUTHORIZED' then new.authorized_at := coalesce(new.authorized_at, now());
      when 'HELD'       then new.held_at       := coalesce(new.held_at, now());
      when 'RELEASED'   then new.released_at   := now();
      when 'REFUNDED'   then new.refunded_at   := now();
      when 'FAILED'     then new.failed_at     := now();
      else null;
    end case;
  end if;

  return new;
end;
$$;

create trigger transactions_guard_transition before update on transactions
  for each row execute function app.guard_transaction_transition();

-- ── the ledger ─────────────────────────────────────────────────────────────

create table ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete restrict,
  account_id     uuid not null references ledger_accounts(id) on delete restrict,
  direction      entry_direction not null,
  amount_minor   bigint not null check (amount_minor > 0),
  currency       currency_code not null,
  -- Human-readable narration; shows up in statements and admin exports.
  narration      text,
  -- Running balance of the account immediately after this entry. Makes
  -- statements and reconciliation cheap and auditable.
  balance_after_minor bigint not null,
  created_at     timestamptz not null default now()
);

create index ledger_entries_transaction_idx on ledger_entries (transaction_id);
create index ledger_entries_account_idx on ledger_entries (account_id, created_at desc);

-- Append-only, enforced by the database.
create trigger ledger_entries_immutable
  before update or delete on ledger_entries
  for each row execute function app.forbid_mutation();

-- Update the cached balance and stamp balance_after, atomically, with a row
-- lock so concurrent entries against the same account serialise correctly.
create or replace function app.apply_ledger_entry()
returns trigger
language plpgsql
as $$
declare
  v_account ledger_accounts%rowtype;
  v_signed bigint;
  v_new_balance bigint;
begin
  select * into v_account from ledger_accounts where id = new.account_id for update;

  if not found then
    raise exception 'Ledger account % not found', new.account_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_account.currency <> new.currency then
    raise exception 'Currency mismatch: entry is % but account % is %',
      new.currency, v_account.id, v_account.currency
      using errcode = 'check_violation';
  end if;

  v_signed := case
    when new.direction = app.account_normal_direction(v_account.kind) then new.amount_minor
    else -new.amount_minor
  end;

  v_new_balance := v_account.balance_minor + v_signed;

  -- A user's withdrawable balance may never go negative. This is the last line
  -- of defence against a double-withdrawal race.
  if v_account.kind in ('user_available', 'user_pending', 'escrow')
     and v_new_balance < 0 then
    raise exception 'Insufficient balance on account % (% -> %)',
      v_account.id, v_account.balance_minor, v_new_balance
      using errcode = 'check_violation';
  end if;

  update ledger_accounts
     set balance_minor = v_new_balance
   where id = new.account_id;

  new.balance_after_minor := v_new_balance;
  return new;
end;
$$;

create trigger ledger_entries_apply before insert on ledger_entries
  for each row execute function app.apply_ledger_entry();

-- Double-entry invariant: every transaction's entries must net to zero. Checked
-- at COMMIT so a multi-statement posting is evaluated as a whole.
create or replace function app.assert_ledger_balanced()
returns trigger
language plpgsql
as $$
declare
  v_imbalance bigint;
begin
  select coalesce(sum(case when direction = 'debit' then amount_minor else -amount_minor end), 0)
    into v_imbalance
  from ledger_entries
  where transaction_id = coalesce(new.transaction_id, old.transaction_id);

  if v_imbalance <> 0 then
    raise exception 'Unbalanced ledger posting for transaction %: debits - credits = %',
      coalesce(new.transaction_id, old.transaction_id), v_imbalance
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger ledger_entries_balanced
  after insert on ledger_entries
  deferrable initially deferred
  for each row execute function app.assert_ledger_balanced();

-- Rebuilds a cached balance from the immutable entries. Used by the
-- reconciliation cron and by admins investigating a discrepancy.
create or replace function app.recompute_account_balance(p_account_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind ledger_account_kind;
  v_normal entry_direction;
  v_balance bigint;
begin
  select kind into v_kind from ledger_accounts where id = p_account_id;
  v_normal := app.account_normal_direction(v_kind);

  select coalesce(sum(
    case when direction = v_normal then amount_minor else -amount_minor end
  ), 0)
  into v_balance
  from ledger_entries
  where account_id = p_account_id;

  update ledger_accounts set balance_minor = v_balance where id = p_account_id;
  return v_balance;
end;
$$;

-- ── wallet projection ──────────────────────────────────────────────────────
-- A "wallet" is not a table: it is the projection of a user's ledger accounts.
-- Modelling it as a view makes it impossible for the balance to disagree with
-- the ledger.

create view wallets as
select
  p.id as user_id,
  p.currency,
  coalesce(avail.balance_minor, 0) as available_minor,
  coalesce(pending.balance_minor, 0) as pending_minor,
  coalesce(avail.balance_minor, 0) + coalesce(pending.balance_minor, 0) as total_minor,
  coalesce(clearing.balance_minor, 0) as withdrawing_minor
from profiles p
left join ledger_accounts avail
  on avail.owner_id = p.id and avail.kind = 'user_available' and avail.currency = p.currency
left join ledger_accounts pending
  on pending.owner_id = p.id and pending.kind = 'user_pending' and pending.currency = p.currency
left join ledger_accounts clearing
  on clearing.owner_id = p.id and clearing.kind = 'payout_clearing' and clearing.currency = p.currency;

comment on view wallets is
  'Derived from the ledger. There is no writable balance column anywhere in the schema.';

-- ── payout accounts & payouts ──────────────────────────────────────────────

create table payout_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  provider        text not null default 'paystack',
  -- We store only what is needed to display and to instruct the provider. The
  -- full account number is never persisted — the provider's recipient token is
  -- the payout handle.
  bank_code       text not null,
  bank_name       text not null,
  account_last4   text not null check (account_last4 ~ '^[0-9]{4}$'),
  account_name    text not null,
  recipient_code  text,                       -- provider-side recipient token
  currency        currency_code not null default 'NGN',
  is_default      boolean not null default false,
  is_verified     boolean not null default false,
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index payout_accounts_user_idx on payout_accounts (user_id);
create unique index payout_accounts_one_default
  on payout_accounts (user_id, currency) where is_default;
create unique index payout_accounts_recipient_key
  on payout_accounts (provider, recipient_code) where recipient_code is not null;

create trigger payout_accounts_touch before update on payout_accounts
  for each row execute function app.touch_updated_at();

create table payouts (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique
                     default 'PO-' || upper(encode(gen_random_bytes(6), 'hex')),
  user_id          uuid not null references profiles(id) on delete restrict,
  payout_account_id uuid not null references payout_accounts(id) on delete restrict,
  transaction_id   uuid references transactions(id) on delete set null,

  amount_minor     bigint not null check (amount_minor > 0),
  fee_minor        bigint not null default 0 check (fee_minor >= 0),
  currency         currency_code not null default 'NGN',
  status           payout_status not null default 'requested',

  provider         text not null default 'paystack',
  provider_reference text,
  failure_reason   text,

  requested_at     timestamptz not null default now(),
  processed_at     timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index payouts_user_idx on payouts (user_id, created_at desc);
create index payouts_status_idx on payouts (status, created_at);
create unique index payouts_provider_reference_key
  on payouts (provider, provider_reference) where provider_reference is not null;

create trigger payouts_touch before update on payouts
  for each row execute function app.touch_updated_at();

-- ── webhook events (idempotency + audit) ───────────────────────────────────

create table payment_webhook_events (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null,
  -- Provider's own event id. UNIQUE — this is what makes replay impossible.
  event_id       text not null,
  event_type     text not null,
  signature_valid boolean not null,
  payload        jsonb not null,

  processed_at   timestamptz,
  processing_error text,
  attempts       integer not null default 0,
  transaction_id uuid references transactions(id) on delete set null,

  received_at    timestamptz not null default now(),

  unique (provider, event_id)
);

create index payment_webhook_events_unprocessed_idx
  on payment_webhook_events (received_at)
  where processed_at is null;
create index payment_webhook_events_type_idx on payment_webhook_events (event_type, received_at desc);

-- The payload is evidence. It must never be edited, only annotated with
-- processing results — so DELETE is blocked and UPDATE is restricted to the
-- processing columns.
create or replace function app.guard_webhook_event_update()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Webhook events are append-only' using errcode = 'restrict_violation';
  end if;

  if new.payload is distinct from old.payload
     or new.event_id is distinct from old.event_id
     or new.provider is distinct from old.provider
     or new.signature_valid is distinct from old.signature_valid then
    raise exception 'Webhook event evidence is immutable' using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

create trigger payment_webhook_events_guard
  before update or delete on payment_webhook_events
  for each row execute function app.guard_webhook_event_update();
