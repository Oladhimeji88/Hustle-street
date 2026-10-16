-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 — Operations: platform settings, admin actions, audit log, analytics,
--        rate limiting and search telemetry.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── platform settings ──────────────────────────────────────────────────────
-- A typed key/value store so operators can retune commission, limits and
-- geographic availability without a deploy. `is_public` controls whether the
-- value may be read by the browser.

create table platform_settings (
  key           text primary key,
  value         jsonb not null,
  value_type    text not null check (value_type in ('number', 'string', 'boolean', 'json')),
  category      text not null default 'general',
  label         text not null,
  description   text,
  is_public     boolean not null default false,
  min_value     numeric,
  max_value     numeric,
  updated_by    uuid references profiles(id) on delete set null,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index platform_settings_category_idx on platform_settings (category);
create index platform_settings_public_idx on platform_settings (is_public) where is_public;

create trigger platform_settings_touch before update on platform_settings
  for each row execute function app.touch_updated_at();

-- Typed accessors used across the schema and the API layer.
create or replace function app.setting_number(p_key text, p_default numeric default 0)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select (value #>> '{}')::numeric from platform_settings where key = p_key), p_default)
$$;

create or replace function app.setting_bool(p_key text, p_default boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select (value #>> '{}')::boolean from platform_settings where key = p_key), p_default)
$$;

create or replace function app.setting_text(p_key text, p_default text default null)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select value #>> '{}' from platform_settings where key = p_key), p_default)
$$;

-- Settings changes are consequential (they move money). Every write is audited.
create table platform_settings_history (
  id          uuid primary key default gen_random_uuid(),
  key         text not null,
  old_value   jsonb,
  new_value   jsonb not null,
  changed_by  uuid references profiles(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

create index platform_settings_history_key_idx on platform_settings_history (key, created_at desc);

create trigger platform_settings_history_immutable
  before update or delete on platform_settings_history
  for each row execute function app.forbid_mutation();

create or replace function app.record_setting_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.value is not distinct from old.value then
    return new;
  end if;

  insert into platform_settings_history (key, old_value, new_value, changed_by)
  values (new.key, case when tg_op = 'UPDATE' then old.value else null end,
          new.value, coalesce(new.updated_by, app.current_user_id()));
  return new;
end;
$$;

create trigger platform_settings_audit
  before insert or update of value on platform_settings
  for each row execute function app.record_setting_change();

-- ── admin actions ──────────────────────────────────────────────────────────

create table admin_actions (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid not null references profiles(id) on delete restrict,
  action        text not null,
  target_kind   text not null,
  target_id     uuid,
  reason        text,
  before_state  jsonb,
  after_state   jsonb,
  ip_hash       text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index admin_actions_admin_idx on admin_actions (admin_id, created_at desc);
create index admin_actions_target_idx on admin_actions (target_kind, target_id, created_at desc);
create index admin_actions_recent_idx on admin_actions (created_at desc);

create trigger admin_actions_immutable
  before update or delete on admin_actions
  for each row execute function app.forbid_mutation();

-- ── general audit log ──────────────────────────────────────────────────────

create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  actor_kind  text not null default 'user' check (actor_kind in ('user', 'admin', 'system', 'webhook')),
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  changes     jsonb,
  ip_hash     text,
  user_agent  text,
  request_id  text,
  created_at  timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on audit_logs (actor_id, created_at desc);
create index audit_logs_created_idx on audit_logs (created_at desc);

create trigger audit_logs_immutable
  before update or delete on audit_logs
  for each row execute function app.forbid_mutation();

-- ── analytics ──────────────────────────────────────────────────────────────
-- Product events land here first. Forwarding to an external tool (PostHog) is
-- an optional side effect, so analytics outages never lose data and the schema
-- stays the source of truth for funnel metrics.

create table analytics_events (
  id           bigint generated always as identity primary key,
  event        text not null,
  user_id      uuid references profiles(id) on delete set null,
  anonymous_id text,
  session_id   text,
  properties   jsonb not null default '{}'::jsonb,
  -- Coarse context only. No raw IPs, no precise coordinates.
  platform     text,
  city         text,
  country_code text,
  app_version  text,
  occurred_at  timestamptz not null default now()
);

create index analytics_events_event_idx on analytics_events (event, occurred_at desc);
create index analytics_events_user_idx on analytics_events (user_id, occurred_at desc);
create index analytics_events_time_idx on analytics_events (occurred_at desc);

-- ── rate limiting ──────────────────────────────────────────────────────────
-- Fixed-window counters shared across every server instance. Keys are hashed
-- identifiers (user id or hashed IP) plus the bucket name.

create table rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  expires_at   timestamptz not null,
  primary key (key, window_start)
);

create index rate_limits_expiry_idx on rate_limits (expires_at);

-- Atomic increment-and-test. Returns TRUE when the request is allowed.
create or replace function app.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
  v_expires timestamptz;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_expires := v_window_start + make_interval(secs => p_window_seconds);

  insert into rate_limits (key, window_start, hits, expires_at)
  values (p_key, v_window_start, 1, v_expires)
  on conflict (key, window_start)
  do update set hits = rate_limits.hits + 1
  returning rate_limits.hits into v_hits;

  return query select v_hits <= p_limit, greatest(p_limit - v_hits, 0), v_expires;
end;
$$;

-- ── search telemetry ───────────────────────────────────────────────────────

create table search_queries (
  id           bigint generated always as identity primary key,
  user_id      uuid references profiles(id) on delete set null,
  query        text not null,
  normalized   text not null,
  result_count integer not null default 0,
  clicked_id   uuid,
  filters      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index search_queries_normalized_idx on search_queries (normalized, created_at desc);
create index search_queries_user_idx on search_queries (user_id, created_at desc);

-- Popular searches, used to power the empty-state suggestions.
create view popular_searches as
select normalized as query, count(*) as search_count
from search_queries
where created_at > now() - interval '30 days'
  and result_count > 0
  and char_length(normalized) >= 3
group by normalized
having count(*) >= 3
order by count(*) desc
limit 20;

-- ── background job queue ───────────────────────────────────────────────────

create table background_jobs (
  id           uuid primary key default gen_random_uuid(),
  queue        text not null default 'default',
  task         text not null,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'queued'
                 check (status in ('queued', 'running', 'succeeded', 'failed', 'dead')),
  attempts     integer not null default 0,
  max_attempts integer not null default 5,
  run_after    timestamptz not null default now(),
  locked_at    timestamptz,
  locked_by    text,
  last_error   text,
  completed_at timestamptz,
  -- Optional dedupe key so "remind about job X" is only ever queued once.
  dedupe_key   text,
  created_at   timestamptz not null default now()
);

create index background_jobs_claim_idx on background_jobs (queue, status, run_after)
  where status in ('queued', 'running');
create unique index background_jobs_dedupe_key
  on background_jobs (dedupe_key) where dedupe_key is not null and status in ('queued', 'running');

-- Claims a batch of due jobs atomically. SKIP LOCKED lets multiple workers run
-- concurrently without stepping on each other.
create or replace function app.claim_background_jobs(
  p_queue text,
  p_worker text,
  p_limit integer default 10
)
returns setof background_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update background_jobs bj
     set status = 'running',
         locked_at = now(),
         locked_by = p_worker,
         attempts = bj.attempts + 1
   where bj.id in (
     select id from background_jobs
     where queue = p_queue
       and status = 'queued'
       and run_after <= now()
     order by run_after
     for update skip locked
     limit p_limit
   )
  returning bj.*;
end;
$$;

-- ── seed the default platform settings ─────────────────────────────────────

insert into platform_settings (key, value, value_type, category, label, description, is_public, min_value, max_value) values
  ('commission_rate_bps', '1000'::jsonb, 'number', 'money',
   'Platform commission (basis points)',
   '1000 bps = 10%. Deducted from the agreed job price when escrow is released.',
   true, 0, 3000),

  ('minimum_job_budget_minor', '100000'::jsonb, 'number', 'money',
   'Minimum job budget (minor units)', '₦1,000 in kobo.', true, 0, null),

  ('maximum_job_budget_minor', '500000000'::jsonb, 'number', 'money',
   'Maximum job budget (minor units)', '₦5,000,000 in kobo.', true, 0, null),

  ('minimum_payout_minor', '100000'::jsonb, 'number', 'money',
   'Minimum withdrawal (minor units)', '₦1,000 in kobo.', true, 0, null),

  ('payout_fee_minor', '5000'::jsonb, 'number', 'money',
   'Flat withdrawal fee (minor units)', '₦50 in kobo — covers the provider transfer fee.',
   true, 0, null),

  ('payout_hold_hours', '24'::jsonb, 'number', 'money',
   'Payout clearing period (hours)',
   'Earnings sit in the pending balance for this long after release before they become withdrawable.',
   true, 0, 720),

  ('auto_confirm_hours', '72'::jsonb, 'number', 'jobs',
   'Auto-confirm window (hours)',
   'If a poster does not confirm a submitted job within this window, escrow is released automatically.',
   true, 12, 336),

  ('job_expiry_days', '30'::jsonb, 'number', 'jobs',
   'Job listing lifetime (days)', 'Open jobs expire after this many days.', true, 1, 180),

  ('max_open_jobs_per_user', '15'::jsonb, 'number', 'jobs',
   'Max simultaneous open jobs per poster', null, false, 1, 500),

  ('max_applications_per_day', '30'::jsonb, 'number', 'jobs',
   'Max applications per hustler per day', 'Spam control.', false, 1, 500),

  ('nearby_default_radius_km', '10'::jsonb, 'number', 'discovery',
   'Default discovery radius (km)', null, true, 1, 200),

  ('nearby_max_radius_km', '50'::jsonb, 'number', 'discovery',
   'Maximum discovery radius (km)', null, true, 1, 500),

  ('review_publish_window_days', '14'::jsonb, 'number', 'trust',
   'Double-blind review window (days)',
   'Reviews publish when both sides submit, or automatically after this many days.',
   true, 1, 90),

  ('require_identity_verification_above_minor', '20000000'::jsonb, 'number', 'trust',
   'Identity verification threshold (minor units)',
   'Jobs above ₦200,000 require an identity-verified hustler.', true, 0, null),

  ('high_risk_score_threshold', '50'::jsonb, 'number', 'trust',
   'Risk score that flags an account for review', null, false, 0, 100),

  ('signup_enabled', 'true'::jsonb, 'boolean', 'general',
   'Allow new signups', null, true, null, null),

  ('payouts_enabled', 'true'::jsonb, 'boolean', 'money',
   'Allow withdrawals', 'Kill switch for the payout pipeline.', false, null, null),

  ('maintenance_mode', 'false'::jsonb, 'boolean', 'general',
   'Maintenance mode', null, true, null, null),

  ('supported_country_codes', '["NG"]'::jsonb, 'json', 'general',
   'Countries open for business', null, true, null, null),

  ('default_currency', '"NGN"'::jsonb, 'string', 'general',
   'Default currency', null, true, null, null),

  -- Recommendation weights (must sum to 100). Tunable without a deploy.
  ('reco_weight_location', '30'::jsonb, 'number', 'discovery',
   'Recommendation weight: location', null, false, 0, 100),
  ('reco_weight_skills', '30'::jsonb, 'number', 'discovery',
   'Recommendation weight: skills', null, false, 0, 100),
  ('reco_weight_rating', '15'::jsonb, 'number', 'discovery',
   'Recommendation weight: rating', null, false, 0, 100),
  ('reco_weight_availability', '15'::jsonb, 'number', 'discovery',
   'Recommendation weight: availability', null, false, 0, 100),
  ('reco_weight_experience', '10'::jsonb, 'number', 'discovery',
   'Recommendation weight: experience', null, false, 0, 100)
on conflict (key) do nothing;
