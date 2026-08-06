-- ─── Identity verification (NIN / BVN / liveness) ───────────────────────────
--
-- `profiles.identity_verified` already existed as a boolean. Verification is
-- not boolean in practice: an attempt can be pending with a provider, or
-- rejected, and both are states the UI has to show. These columns carry that
-- without changing the meaning of the existing flag, which other code and one
-- trigger already read.
--
-- ── What is deliberately absent ─────────────────────────────────────────────
--
-- There is no `nin` column and no `bvn` column, and adding one would be a
-- serious mistake.
--
-- A BVN is a CBN-issued banking credential shared across every Nigerian bank.
-- A NIN is the national identity number. Neither can be rotated after a breach:
-- unlike a password, the user cannot change their BVN because we lost it. The
-- application has no feature that requires holding them, so it holds neither.
--
-- The raw values reach `/api/kyc/verify`, are forwarded to a licensed provider,
-- and are discarded when the request ends. What lands here is the verdict, the
-- provider's reference for audit, and a salted hash.

alter table profiles
  -- 'unstarted' rather than null so the column is always answerable.
  add column if not exists identity_status text not null default 'unstarted'
    check (identity_status in ('unstarted', 'pending', 'verified', 'rejected')),

  -- The provider's own id for the attempt. Needed to dispute or re-check a
  -- decision months later without having kept the inputs.
  add column if not exists identity_reference text,

  add column if not exists identity_verified_at timestamptz,

  -- Salted SHA-256 over (NIN, BVN). Its only job is detecting one person
  -- holding several accounts.
  --
  -- The salt lives in KYC_HASH_SALT, outside the database. This matters: an
  -- unsalted hash of an 11-digit number is not protection, because the whole
  -- keyspace is 10^11 and enumerable in minutes on a laptop. Salted, the hashes
  -- are inert to anyone who takes this table without also taking the app's env.
  add column if not exists identity_hash text;

-- Partial, because the overwhelming majority of rows are null and there is no
-- reason to index them. Unique so the duplicate-account check is enforced by
-- the database rather than only by the application that happens to check first.
create unique index if not exists profiles_identity_hash_key
  on profiles (identity_hash)
  where identity_hash is not null;

create index if not exists profiles_identity_status_idx
  on profiles (identity_status)
  where identity_status <> 'unstarted';

comment on column profiles.identity_hash is
  'Salted SHA-256 of (NIN, BVN) for duplicate-account detection. The source '
  'numbers are never stored. Salt is KYC_HASH_SALT, held outside the database.';

comment on column profiles.identity_status is
  'unstarted | pending | verified | rejected. identity_verified stays as the '
  'boolean other code already reads; this carries the states it cannot express.';

-- Keep the pre-existing boolean consistent with the new status, so nothing that
-- reads `identity_verified` has to learn about `identity_status`.
create or replace function app.sync_identity_verified()
returns trigger
language plpgsql
as $$
begin
  new.identity_verified := (new.identity_status = 'verified');
  return new;
end;
$$;

drop trigger if exists trg_sync_identity_verified on profiles;
create trigger trg_sync_identity_verified
  before insert or update of identity_status on profiles
  for each row execute function app.sync_identity_verified();
