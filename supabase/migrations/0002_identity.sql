-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 — Identity: profiles, roles, verification, skills, addresses,
--        availability and portfolio.
--
-- `auth.users` (managed by Supabase Auth) is the identity root. `profiles`
-- holds everything the product owns, keyed 1:1 by the auth user id.
-- ═══════════════════════════════════════════════════════════════════════════

-- Allows migrations to run against a bare PostgreSQL instance (CI / integration
-- tests) where the Supabase Auth schema is not present. On a real Supabase
-- project this block is a no-op.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      phone text unique,
      encrypted_password text,
      email_confirmed_at timestamptz,
      phone_confirmed_at timestamptz,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  end if;
end
$$;

-- Resolves the current request's user id. Falls back to NULL for anonymous
-- requests. Wrapped so non-Supabase environments do not break.
create or replace function app.current_user_id()
returns uuid
language plpgsql
stable
as $$
begin
  return nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
exception
  when others then
    return null;
end;
$$;

-- ── profiles ───────────────────────────────────────────────────────────────

create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,

  -- Public identity
  username            text not null,
  display_name        text not null,
  avatar_url          text,
  bio                 text,
  headline            text,                       -- e.g. "Graphic Designer"

  -- Contact (never exposed publicly — see RLS + public views)
  email               text,
  phone               text,

  -- Location. `home_point` is the exact private location; `public_point` is a
  -- deliberately fuzzed copy that is safe to expose in discovery surfaces.
  city                text,
  area                text,                        -- e.g. "Lekki Phase 1"
  state               text,
  country_code        text not null default 'NG',
  home_lat            double precision,
  home_lng            double precision,
  home_point          geography(Point, 4326)
                        generated always as (app.point_from_lat_lng(home_lat, home_lng)) stored,
  public_point        geography(Point, 4326)
                        generated always as (
                          app.point_from_lat_lng(
                            app.fuzz_coordinate(home_lat),
                            app.fuzz_coordinate(home_lng)
                          )
                        ) stored,

  -- Hustler-side configuration
  is_hustler          boolean not null default false,
  is_poster           boolean not null default true,
  service_radius_km   integer not null default 10,
  hourly_rate_minor   bigint,
  starting_price_minor bigint,
  currency            currency_code not null default 'NGN',
  available_now       boolean not null default false,
  accepts_remote      boolean not null default false,

  -- Denormalised reputation. Maintained exclusively by database triggers from
  -- the reviews/jobs tables — never written by application code.
  rating_avg          numeric(3,2) not null default 0 check (rating_avg between 0 and 5),
  rating_count        integer not null default 0 check (rating_count >= 0),
  jobs_completed      integer not null default 0 check (jobs_completed >= 0),
  jobs_posted         integer not null default 0 check (jobs_posted >= 0),
  response_rate       numeric(5,2) not null default 0 check (response_rate between 0 and 100),
  response_time_secs  integer,
  cancellation_count  integer not null default 0,

  -- Account state
  status              account_status not null default 'active',
  suspended_until     timestamptz,
  suspension_reason   text,
  risk_level          risk_level not null default 'low',
  risk_score          integer not null default 0 check (risk_score between 0 and 100),

  -- Verification snapshot (source of truth is `user_verifications`)
  email_verified      boolean not null default false,
  phone_verified      boolean not null default false,
  identity_verified   boolean not null default false,

  onboarding_step     text not null default 'profile',
  profile_completed   boolean not null default false,
  locale              text not null default 'en-NG',
  timezone            text not null default 'Africa/Lagos',

  last_active_at      timestamptz,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_service_radius_sane
    check (service_radius_km between 1 and 200),
  constraint profiles_rates_non_negative
    check (coalesce(hourly_rate_minor, 0) >= 0 and coalesce(starting_price_minor, 0) >= 0),
  constraint profiles_suspension_has_reason
    check (status <> 'suspended' or suspension_reason is not null)
);

create unique index profiles_username_key on profiles (lower(username)) where deleted_at is null;
create index profiles_public_point_idx on profiles using gist (public_point);
create index profiles_home_point_idx on profiles using gist (home_point);
create index profiles_hustler_discovery_idx
  on profiles (is_hustler, status, available_now, rating_avg desc)
  where deleted_at is null and is_hustler;
create index profiles_search_idx
  on profiles using gin (app.normalize_text(display_name || ' ' || coalesce(headline, '')) gin_trgm_ops);
create index profiles_status_idx on profiles (status) where deleted_at is null;
create index profiles_last_active_idx on profiles (last_active_at desc nulls last);

create trigger profiles_touch before update on profiles
  for each row execute function app.touch_updated_at();

comment on column profiles.public_point is
  'Coordinates fuzzed to ~1.1km. This is the ONLY location exposed before a job relationship exists.';
comment on column profiles.rating_avg is
  'Maintained by trigger from reviews. Never write from application code.';

-- ── roles ──────────────────────────────────────────────────────────────────

create table user_roles (
  user_id     uuid not null references profiles(id) on delete cascade,
  role        user_role not null,
  granted_by  uuid references profiles(id) on delete set null,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  primary key (user_id, role)
);

create index user_roles_role_idx on user_roles (role);

-- Authorization helper used by every admin RLS policy. SECURITY DEFINER so it
-- can read user_roles regardless of the caller's own policies, and pinned
-- search_path so it cannot be hijacked by a malicious schema on the path.
create or replace function app.has_role(target_role user_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from user_roles ur
    where ur.user_id = app.current_user_id()
      and (ur.expires_at is null or ur.expires_at > now())
      and (
        ur.role = target_role
        -- superadmin implies admin implies moderator
        or (target_role = 'admin' and ur.role = 'superadmin')
        or (target_role = 'moderator' and ur.role in ('admin', 'superadmin'))
      )
  )
$$;

create or replace function app.is_staff()
returns boolean
language sql
stable
as $$
  select app.has_role('moderator')
$$;

-- ── verification ───────────────────────────────────────────────────────────

create table user_verifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  kind          verification_kind not null,
  status        verification_status not null default 'pending',
  provider      text,                       -- e.g. 'supabase_auth', 'dojah', 'smile_id'
  provider_ref  text,                       -- external verification id
  -- Only non-sensitive metadata. Raw ID documents live in private object
  -- storage; this holds the storage path plus the provider's verdict.
  evidence_path text,
  metadata      jsonb not null default '{}'::jsonb,
  reviewed_by   uuid references profiles(id) on delete set null,
  reviewed_at   timestamptz,
  rejection_reason text,
  verified_at   timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint user_verifications_verified_has_timestamp
    check (status <> 'verified' or verified_at is not null)
);

create unique index user_verifications_active_kind_key
  on user_verifications (user_id, kind)
  where status in ('pending', 'verified');
create index user_verifications_status_idx on user_verifications (status, kind);

create trigger user_verifications_touch before update on user_verifications
  for each row execute function app.touch_updated_at();

-- Mirror the verification verdict onto the profile snapshot columns.
create or replace function app.sync_verification_flags()
returns trigger
language plpgsql
as $$
declare
  is_verified boolean := (new.status = 'verified');
begin
  if new.kind = 'email' then
    update profiles set email_verified = is_verified where id = new.user_id;
  elsif new.kind = 'phone' then
    update profiles set phone_verified = is_verified where id = new.user_id;
  elsif new.kind = 'identity' then
    update profiles set identity_verified = is_verified where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger user_verifications_sync
  after insert or update of status on user_verifications
  for each row execute function app.sync_verification_flags();

-- ── skills ─────────────────────────────────────────────────────────────────

create table skills (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  category_id  uuid,                                   -- FK added in 0003
  is_active    boolean not null default true,
  usage_count  integer not null default 0,
  created_at   timestamptz not null default now()
);

create index skills_name_trgm_idx on skills using gin (app.normalize_text(name) gin_trgm_ops);
create index skills_active_idx on skills (is_active, usage_count desc);

create table user_skills (
  user_id      uuid not null references profiles(id) on delete cascade,
  skill_id     uuid not null references skills(id) on delete cascade,
  years_experience integer check (years_experience between 0 and 60),
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create index user_skills_skill_idx on user_skills (skill_id);

-- ── addresses ──────────────────────────────────────────────────────────────
-- Private, precise addresses. Exposed only to a counterparty with an active
-- job relationship (enforced in RLS, migration 0012).

create table addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  label         text not null default 'Home',
  line1         text not null,
  line2         text,
  area          text,
  city          text not null,
  state         text,
  postal_code   text,
  country_code  text not null default 'NG',
  lat           double precision not null,
  lng           double precision not null,
  point         geography(Point, 4326)
                  generated always as (app.point_from_lat_lng(lat, lng)) stored,
  landmark      text,
  instructions  text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint addresses_lat_range check (lat between -90 and 90),
  constraint addresses_lng_range check (lng between -180 and 180)
);

create index addresses_user_idx on addresses (user_id);
create unique index addresses_one_default_per_user
  on addresses (user_id) where is_default;
create index addresses_point_idx on addresses using gist (point);

create trigger addresses_touch before update on addresses
  for each row execute function app.touch_updated_at();

-- ── availability ───────────────────────────────────────────────────────────

create table availability (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),  -- 0 = Sunday
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute   smallint not null check (end_minute between 1 and 1440),
  created_at   timestamptz not null default now(),

  constraint availability_window_valid check (end_minute > start_minute),
  unique (user_id, weekday, start_minute, end_minute)
);

create index availability_user_idx on availability (user_id, weekday);

-- ── portfolio ──────────────────────────────────────────────────────────────

create table portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null,
  description text,
  media_path  text not null,
  media_type  text not null default 'image',
  link_url    text,
  job_id      uuid,                                     -- FK added in 0004
  position    integer not null default 0,
  created_at  timestamptz not null default now(),

  constraint portfolio_media_type_allowed check (media_type in ('image', 'video', 'link'))
);

create index portfolio_user_idx on portfolio_items (user_id, position);

-- ── auth session tracking (for "log out from all devices") ─────────────────

create table user_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  session_token_hash text not null,        -- SHA-256, never the raw token
  user_agent    text,
  ip_hash       text,                      -- hashed; we never store raw IPs
  device_label  text,
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index user_sessions_user_idx on user_sessions (user_id, revoked_at, last_seen_at desc);
create unique index user_sessions_token_key on user_sessions (session_token_hash);

-- ── blocks ─────────────────────────────────────────────────────────────────

create table user_blocks (
  blocker_id  uuid not null references profiles(id) on delete cascade,
  blocked_id  uuid not null references profiles(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on user_blocks (blocked_id);

-- True if either party has blocked the other. Used to hide jobs, suppress
-- applications and reject messages.
create or replace function app.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from user_blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  )
$$;
