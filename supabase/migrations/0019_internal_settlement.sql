-- ═══════════════════════════════════════════════════════════════════════════
-- 0019 — Allow internal transactions to settle directly from PENDING.
--
-- The payment state machine was written for money that makes a round trip to
-- the provider: PENDING → AUTHORIZED → HELD → RELEASED. That is right for an
-- escrow funding (a real card charge) and for a payout (a real bank transfer).
--
-- It is wrong for the transactions that only move value BETWEEN our own ledger
-- accounts, which have no provider step to wait for:
--
--   escrow_release    escrow → hustler pending + platform revenue
--   refund            escrow → gateway receivable
--   adjustment        pending → available (the clearing sweep)
--   payout_reversal   clearing → available after a failed transfer
--
-- Every one of those creates the row as PENDING, posts its ledger entries, and
-- immediately marks it settled. The guard rejected that with
--   "Illegal payment transition PENDING -> RELEASED"
-- which meant escrow could be funded but never released — the single most
-- important path in the product was dead.
--
-- The fix keeps the strict rule for provider-backed kinds and permits direct
-- settlement only for internal ones. Widening
-- app.is_valid_transaction_transition() itself would have loosened the guard
-- for escrow_funding too, allowing a charge to be marked RELEASED without ever
-- being confirmed held.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.is_internal_settlement(k transaction_kind)
returns boolean
language sql
immutable
parallel safe
as $$
  select k in ('escrow_release', 'refund', 'adjustment', 'payout_reversal', 'fee')
$$;

comment on function app.is_internal_settlement is
  'True for transactions that only move value between internal ledger accounts, with no payment-provider round trip.';

create or replace function app.guard_transaction_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and not app.is_valid_transaction_transition(old.status, new.status)
     -- Internal settlements have no provider step to wait for, so they may go
     -- straight from PENDING to their terminal state. Provider-backed kinds
     -- (escrow_funding, payout) still must pass through AUTHORIZED/HELD.
     and not (
       old.status = 'PENDING'
       and new.status in ('RELEASED', 'REFUNDED')
       and app.is_internal_settlement(new.kind)
     )
  then
    raise exception 'Illegal payment transition % -> % for transaction %',
      old.status, new.status, old.reference
      using errcode = 'check_violation';
  end if;

  -- The money itself remains immutable once the transaction exists.
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

grant execute on function app.is_internal_settlement(transaction_kind)
  to anon, authenticated, service_role;
