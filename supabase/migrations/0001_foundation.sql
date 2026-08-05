-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 — Foundation: extensions, schemas, enums, shared helper functions.
--
-- Money rule for the whole database: every monetary amount is stored as a
-- BIGINT in the currency's MINOR unit (kobo for NGN, cents for USD). There is
-- no floating point anywhere in the financial path.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";      -- gen_random_uuid(), digest()
create extension if not exists "postgis";       -- geography type + GIST indexes
create extension if not exists "pg_trgm";       -- fuzzy / typo-tolerant search
create extension if not exists "unaccent";      -- accent-insensitive search
create extension if not exists "btree_gin";     -- composite GIN indexes

-- `app` holds internal machinery that must never be exposed through PostgREST.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

-- ── Enums ───────────────────────────────────────────────────────────────────

create type user_role as enum ('user', 'moderator', 'admin', 'superadmin');

create type account_status as enum ('active', 'restricted', 'suspended', 'banned', 'deleted');

create type verification_kind as enum ('email', 'phone', 'identity', 'address', 'business');

create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected', 'expired');

create type job_status as enum (
  'DRAFT',              -- being composed, visible only to the poster
  'PUBLISHED',          -- live, indexing/notification fan-out in progress
  'APPLICATIONS_OPEN',  -- live and accepting applications
  'HIRED',              -- a hustler is assigned, awaiting escrow funding/start
  'IN_PROGRESS',        -- work under way
  'SUBMITTED',          -- hustler submitted completion, awaiting confirmation
  'COMPLETED',          -- confirmed, funds released
  'CANCELLED',
  'DISPUTED',
  'EXPIRED'
);

create type job_urgency as enum ('flexible', 'scheduled', 'today', 'asap');

create type job_schedule_kind as enum ('asap', 'today', 'tomorrow', 'date', 'flexible');

create type budget_kind as enum ('fixed', 'negotiable', 'hourly');

create type job_visibility as enum ('nearby', 'category', 'invite_only', 'public');

create type job_location_kind as enum ('onsite', 'remote', 'hybrid');

create type application_status as enum (
  'submitted', 'shortlisted', 'accepted', 'declined', 'withdrawn', 'expired'
);

create type assignment_status as enum (
  'pending_payment', 'active', 'submitted', 'completed', 'cancelled', 'disputed'
);

-- Financial primitives -------------------------------------------------------

create type currency_code as enum ('NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES');

create type transaction_kind as enum (
  'escrow_funding',   -- poster pays into escrow
  'escrow_release',   -- escrow -> hustler + platform fee
  'refund',           -- escrow -> poster
  'payout',           -- hustler available balance -> bank account
  'payout_reversal',
  'fee',
  'adjustment'        -- admin correction, always audited
);

create type transaction_status as enum (
  'PENDING', 'AUTHORIZED', 'HELD', 'RELEASED', 'FAILED', 'REFUNDED', 'DISPUTED', 'CANCELLED'
);

create type ledger_account_kind as enum (
  'user_available',     -- liability: withdrawable user balance
  'user_pending',       -- liability: earned but still clearing
  'escrow',             -- liability: funds held against a specific job
  'platform_revenue',   -- income: commission earned
  'gateway_receivable', -- asset: money held at the payment provider
  'payout_clearing',    -- liability: withdrawal in flight
  'gateway_fees'        -- expense: provider processing fees
);

create type entry_direction as enum ('debit', 'credit');

create type payout_status as enum (
  'requested', 'processing', 'paid', 'failed', 'reversed', 'cancelled'
);

-- Trust & safety -------------------------------------------------------------

create type dispute_status as enum ('open', 'under_review', 'awaiting_evidence', 'resolved', 'withdrawn');

create type dispute_reason as enum (
  'not_completed', 'poor_quality', 'payment_issue', 'wrong_description',
  'fraud', 'safety_issue', 'cancellation', 'other'
);

create type dispute_resolution as enum (
  'refund_poster', 'release_hustler', 'split', 'no_action', 'cancelled_by_agreement'
);

create type report_target as enum ('user', 'job', 'message', 'review', 'application');

create type report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');

create type risk_level as enum ('low', 'medium', 'high', 'critical');

create type review_direction as enum ('poster_to_hustler', 'hustler_to_poster');

-- Messaging & notifications --------------------------------------------------

create type message_kind as enum ('text', 'image', 'file', 'voice', 'system');

create type conversation_kind as enum ('job', 'direct', 'support');

create type notification_channel as enum ('in_app', 'push', 'email', 'sms');

create type notification_kind as enum (
  'job_nearby', 'application_received', 'application_accepted', 'application_declined',
  'message_received', 'payment_received', 'payment_released', 'payout_processed',
  'job_reminder', 'job_submitted', 'job_completed', 'review_request', 'review_received',
  'dispute_update', 'verification_update', 'security_alert', 'system'
);

-- ── Shared helper functions ────────────────────────────────────────────────

-- Keeps `updated_at` honest without trusting any client.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Immutability guard: attach to tables that must be append-only (ledger,
-- webhook events, audit log). Blocks UPDATE and DELETE at the database level so
-- even a compromised service-role key cannot silently rewrite financial history.
create or replace function app.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table %.% is append-only; % is not permitted',
    tg_table_schema, tg_table_name, tg_op
    using errcode = 'restrict_violation';
end;
$$;

-- Normalises free text into a search-friendly form (lowercase, unaccented).
create or replace function app.normalize_text(input text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(trim(regexp_replace(unaccent(coalesce(input, '')), '\s+', ' ', 'g')))
$$;

-- Builds a geography point from lat/lng. Immutable so it can back a generated
-- column and a GIST index.
create or replace function app.point_from_lat_lng(lat double precision, lng double precision)
returns geography(Point, 4326)
language sql
immutable
parallel safe
as $$
  select case
    when lat is null or lng is null then null
    else st_setsrid(st_makepoint(lng, lat), 4326)::geography
  end
$$;

-- Rounds a coordinate to ~1.1km of precision. Used to publish an *approximate*
-- job/hustler location publicly while the exact address stays private until a
-- working relationship exists.
create or replace function app.fuzz_coordinate(value double precision)
returns double precision
language sql
immutable
parallel safe
as $$
  select round(value::numeric, 2)::double precision
$$;

comment on function app.fuzz_coordinate is
  'Truncates a coordinate to 2 decimal places (~1.1 km) for public exposure.';
