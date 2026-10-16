-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 — Jobs: the marketplace listing, its media, requirements, status
--        history and the saved-job / saved-hustler bookmarks.
-- ═══════════════════════════════════════════════════════════════════════════

create table jobs (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique
                      default 'HS-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)),
  poster_id         uuid not null references profiles(id) on delete cascade,
  category_id       uuid not null references categories(id) on delete restrict,

  title             text not null,
  description       text not null,

  status            job_status not null default 'DRAFT',
  urgency           job_urgency not null default 'flexible',
  location_kind     job_location_kind not null default 'onsite',
  visibility        job_visibility not null default 'nearby',

  -- ── Location ────────────────────────────────────────────────────────────
  -- `exact_*` is private: only the poster, the hired hustler and staff can read
  -- it (enforced by RLS + the `jobs_public` view). `approx_point` is what
  -- discovery queries and the map use.
  address_id        uuid references addresses(id) on delete set null,
  exact_lat         double precision,
  exact_lng         double precision,
  exact_point       geography(Point, 4326)
                      generated always as (app.point_from_lat_lng(exact_lat, exact_lng)) stored,
  approx_point      geography(Point, 4326)
                      generated always as (
                        app.point_from_lat_lng(
                          app.fuzz_coordinate(exact_lat),
                          app.fuzz_coordinate(exact_lng)
                        )
                      ) stored,
  area_label        text,                       -- "Lekki Phase 1"
  city              text,
  state             text,
  country_code      text not null default 'NG',
  location_id       uuid references locations(id) on delete set null,

  -- ── Schedule ────────────────────────────────────────────────────────────
  schedule_kind     job_schedule_kind not null default 'flexible',
  scheduled_for     timestamptz,
  duration_minutes  integer check (duration_minutes is null or duration_minutes between 15 and 10080),

  -- ── Budget (minor units) ────────────────────────────────────────────────
  budget_kind       budget_kind not null default 'fixed',
  budget_min_minor  bigint,
  budget_max_minor  bigint,
  currency          currency_code not null default 'NGN',

  -- ── Denormalised counters, all trigger-maintained ───────────────────────
  view_count        integer not null default 0,
  application_count integer not null default 0,
  save_count        integer not null default 0,
  notified_count    integer not null default 0,     -- hustlers alerted on publish

  -- ── Moderation ──────────────────────────────────────────────────────────
  is_flagged        boolean not null default false,
  flagged_reason    text,
  moderated_by      uuid references profiles(id) on delete set null,
  moderated_at      timestamptz,
  risk_level        risk_level not null default 'low',

  -- ── Lifecycle timestamps ────────────────────────────────────────────────
  published_at      timestamptz,
  expires_at        timestamptz,
  hired_at          timestamptz,
  started_at        timestamptz,
  submitted_at      timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  cancellation_reason text,

  search_vector     tsvector,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint jobs_title_length check (char_length(trim(title)) between 6 and 120),
  constraint jobs_description_length check (char_length(trim(description)) between 20 and 5000),
  constraint jobs_budget_non_negative
    check (coalesce(budget_min_minor, 0) >= 0 and coalesce(budget_max_minor, 0) >= 0),
  constraint jobs_budget_range_ordered
    check (budget_min_minor is null or budget_max_minor is null or budget_max_minor >= budget_min_minor),
  -- A fixed-price job must state a price.
  constraint jobs_fixed_budget_present
    check (budget_kind <> 'fixed' or budget_min_minor is not null),
  -- An on-site job must have coordinates once it is live.
  constraint jobs_onsite_needs_location
    check (
      status = 'DRAFT'
      or location_kind = 'remote'
      or (exact_lat is not null and exact_lng is not null)
    ),
  -- A dated job must carry the date.
  constraint jobs_scheduled_has_date
    check (schedule_kind <> 'date' or scheduled_for is not null),
  constraint jobs_published_has_timestamp
    check (status = 'DRAFT' or published_at is not null),
  constraint jobs_completed_has_timestamp
    check (status <> 'COMPLETED' or completed_at is not null)
);

-- ── Indexes tuned for the actual discovery queries ─────────────────────────

-- The hot path: "open jobs near me, newest first".
create index jobs_discovery_geo_idx
  on jobs using gist (approx_point)
  where deleted_at is null and status in ('PUBLISHED', 'APPLICATIONS_OPEN');

create index jobs_open_recent_idx
  on jobs (published_at desc)
  where deleted_at is null and status in ('PUBLISHED', 'APPLICATIONS_OPEN');

create index jobs_category_open_idx
  on jobs (category_id, published_at desc)
  where deleted_at is null and status in ('PUBLISHED', 'APPLICATIONS_OPEN');

create index jobs_poster_idx on jobs (poster_id, created_at desc) where deleted_at is null;
create index jobs_status_idx on jobs (status) where deleted_at is null;
create index jobs_expiry_sweep_idx on jobs (expires_at)
  where deleted_at is null and status in ('PUBLISHED', 'APPLICATIONS_OPEN');
create index jobs_budget_idx on jobs (currency, budget_max_minor desc nulls last)
  where deleted_at is null and status in ('PUBLISHED', 'APPLICATIONS_OPEN');
create index jobs_search_vector_idx on jobs using gin (search_vector);
create index jobs_title_trgm_idx on jobs using gin (app.normalize_text(title) gin_trgm_ops);
create index jobs_flagged_idx on jobs (is_flagged, created_at desc) where is_flagged;

create trigger jobs_touch before update on jobs
  for each row execute function app.touch_updated_at();

-- Full-text search vector: title weighted above description and area.
create or replace function app.jobs_build_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
      setweight(to_tsvector('simple', app.normalize_text(coalesce(new.title, ''))), 'A')
   || setweight(to_tsvector('simple', app.normalize_text(coalesce(new.area_label, '') || ' ' || coalesce(new.city, ''))), 'B')
   || setweight(to_tsvector('simple', app.normalize_text(coalesce(new.description, ''))), 'C');
  return new;
end;
$$;

create trigger jobs_search_vector
  before insert or update of title, description, area_label, city on jobs
  for each row execute function app.jobs_build_search_vector();

-- ── job media ──────────────────────────────────────────────────────────────

create table job_images (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  storage_path text not null,
  media_type  text not null default 'image' check (media_type in ('image', 'video')),
  width       integer,
  height      integer,
  byte_size   integer check (byte_size is null or byte_size <= 20 * 1024 * 1024),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index job_images_job_idx on job_images (job_id, position);

-- At most 8 attachments per job — enforced in the database, not just the UI.
create or replace function app.enforce_job_image_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from job_images where job_id = new.job_id) >= 8 then
    raise exception 'A job may have at most 8 attachments'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger job_images_limit before insert on job_images
  for each row execute function app.enforce_job_image_limit();

-- ── requirements ───────────────────────────────────────────────────────────

create table job_requirements (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  label       text not null,
  kind        text not null default 'custom'
                check (kind in ('vehicle', 'tools', 'experience', 'availability', 'verification', 'custom')),
  is_mandatory boolean not null default true,
  position    integer not null default 0,

  constraint job_requirements_label_length check (char_length(trim(label)) between 2 and 160)
);

create index job_requirements_job_idx on job_requirements (job_id, position);

-- ── invitations (visibility = invite_only) ─────────────────────────────────

create table job_invitations (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  hustler_id  uuid not null references profiles(id) on delete cascade,
  invited_by  uuid not null references profiles(id) on delete cascade,
  message     text,
  responded_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (job_id, hustler_id)
);

create index job_invitations_hustler_idx on job_invitations (hustler_id, created_at desc);

-- ── status history (append-only audit of the job lifecycle) ────────────────

create table job_status_history (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  from_status  job_status,
  to_status    job_status not null,
  actor_id     uuid references profiles(id) on delete set null,
  actor_kind   text not null default 'user' check (actor_kind in ('user', 'system', 'admin')),
  reason       text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index job_status_history_job_idx on job_status_history (job_id, created_at desc);

create trigger job_status_history_immutable
  before update or delete on job_status_history
  for each row execute function app.forbid_mutation();

-- Records every status change automatically so history can never drift from
-- reality, regardless of which code path performed the update.
create or replace function app.record_job_status_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into job_status_history (job_id, from_status, to_status, actor_id, actor_kind)
    values (new.id, null, new.status, app.current_user_id(),
            case when app.current_user_id() is null then 'system' else 'user' end);
  elsif new.status is distinct from old.status then
    insert into job_status_history (job_id, from_status, to_status, actor_id, actor_kind)
    values (new.id, old.status, new.status, app.current_user_id(),
            case when app.current_user_id() is null then 'system' else 'user' end);
  end if;
  return new;
end;
$$;

create trigger jobs_status_history
  after insert or update of status on jobs
  for each row execute function app.record_job_status_change();

-- ── Job status transition guard ────────────────────────────────────────────
-- The single source of truth for "which status can follow which". Enforced in
-- the database so no API route, admin script or future service can move a job
-- through an impossible transition (e.g. CANCELLED -> COMPLETED).

create or replace function app.is_valid_job_transition(from_status job_status, to_status job_status)
returns boolean
language sql
immutable
parallel safe
as $$
  select case from_status
    when 'DRAFT'             then to_status in ('PUBLISHED', 'CANCELLED')
    when 'PUBLISHED'         then to_status in ('APPLICATIONS_OPEN', 'HIRED', 'CANCELLED', 'EXPIRED')
    when 'APPLICATIONS_OPEN' then to_status in ('HIRED', 'CANCELLED', 'EXPIRED')
    when 'HIRED'             then to_status in ('IN_PROGRESS', 'CANCELLED', 'DISPUTED', 'APPLICATIONS_OPEN')
    when 'IN_PROGRESS'       then to_status in ('SUBMITTED', 'CANCELLED', 'DISPUTED')
    when 'SUBMITTED'         then to_status in ('COMPLETED', 'IN_PROGRESS', 'DISPUTED')
    when 'DISPUTED'          then to_status in ('COMPLETED', 'CANCELLED', 'IN_PROGRESS')
    when 'EXPIRED'           then to_status in ('APPLICATIONS_OPEN', 'CANCELLED')
    when 'COMPLETED'         then false   -- terminal
    when 'CANCELLED'         then false   -- terminal
    else false
  end
$$;

comment on function app.is_valid_job_transition is
  'Authoritative job state machine. A completed or cancelled job is terminal.';

create or replace function app.guard_job_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and not app.is_valid_job_transition(old.status, new.status) then
    raise exception 'Illegal job transition % -> % for job %', old.status, new.status, old.id
      using errcode = 'check_violation';
  end if;

  -- A completed job is frozen: only review/counter columns may still move.
  if old.status = 'COMPLETED' and (
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.budget_min_minor is distinct from old.budget_min_minor
    or new.budget_max_minor is distinct from old.budget_max_minor
    or new.category_id is distinct from old.category_id
  ) then
    raise exception 'A completed job cannot be edited'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger jobs_guard_transition before update on jobs
  for each row execute function app.guard_job_transition();

-- Stamps the lifecycle timestamps so they can never be forged by a client.
create or replace function app.stamp_job_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    case new.status
      when 'PUBLISHED'   then new.published_at := coalesce(new.published_at, now());
      when 'HIRED'       then new.hired_at     := now();
      when 'IN_PROGRESS' then new.started_at   := coalesce(new.started_at, now());
      when 'SUBMITTED'   then new.submitted_at := now();
      when 'COMPLETED'   then new.completed_at := now();
      when 'CANCELLED'   then new.cancelled_at := now();
      else null;
    end case;
  end if;
  return new;
end;
$$;

create trigger jobs_stamp_lifecycle before update on jobs
  for each row execute function app.stamp_job_lifecycle();

-- Keeps profiles.jobs_posted and categories.job_count accurate.
create or replace function app.sync_job_counters()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' then
      update profiles set jobs_posted = jobs_posted + 1 where id = new.poster_id;
      update categories set job_count = job_count + 1 where id = new.category_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'DRAFT' and new.status <> 'DRAFT' then
      update profiles set jobs_posted = jobs_posted + 1 where id = new.poster_id;
      update categories set job_count = job_count + 1 where id = new.category_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_sync_counters
  after insert or update of status on jobs
  for each row execute function app.sync_job_counters();

-- portfolio_items.job_id FK, deferred from 0002.
alter table portfolio_items
  add constraint portfolio_items_job_fk
  foreign key (job_id) references jobs(id) on delete set null;

-- ── bookmarks ──────────────────────────────────────────────────────────────

create table saved_jobs (
  user_id    uuid not null references profiles(id) on delete cascade,
  job_id     uuid not null references jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index saved_jobs_user_idx on saved_jobs (user_id, created_at desc);

create or replace function app.sync_job_save_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update jobs set save_count = save_count + 1 where id = new.job_id;
  else
    update jobs set save_count = greatest(save_count - 1, 0) where id = old.job_id;
  end if;
  return null;
end;
$$;

create trigger saved_jobs_count after insert or delete on saved_jobs
  for each row execute function app.sync_job_save_count();

create table saved_hustlers (
  user_id    uuid not null references profiles(id) on delete cascade,
  hustler_id uuid not null references profiles(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  primary key (user_id, hustler_id),
  constraint saved_hustlers_not_self check (user_id <> hustler_id)
);

create index saved_hustlers_user_idx on saved_hustlers (user_id, created_at desc);

-- ── views (deduplicated per user per day, for honest view counts) ──────────

create table job_views (
  job_id     uuid not null references jobs(id) on delete cascade,
  viewer_id  uuid references profiles(id) on delete cascade,
  viewer_key text not null,                    -- user id, or a hashed anon key
  viewed_on  date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (job_id, viewer_key, viewed_on)
);

create index job_views_job_idx on job_views (job_id, viewed_on desc);

create or replace function app.sync_job_view_count()
returns trigger
language plpgsql
as $$
begin
  update jobs set view_count = view_count + 1 where id = new.job_id;
  return null;
end;
$$;

create trigger job_views_count after insert on job_views
  for each row execute function app.sync_job_view_count();
