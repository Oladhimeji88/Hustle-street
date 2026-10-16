-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 — Taxonomy (categories) and the location reference tree.
--
-- Locations are a country → state → city → area hierarchy so the product can
-- launch in Lagos and expand to new cities/countries as pure data changes,
-- never a code change.
-- ═══════════════════════════════════════════════════════════════════════════

create table categories (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references categories(id) on delete set null,
  slug         text not null unique,
  name         text not null,
  description  text,
  icon         text,                    -- lucide icon name
  color        text,                    -- token name used by the design system
  position     integer not null default 0,
  is_active    boolean not null default true,
  -- Category-level guardrails so admins can tune the marketplace without a deploy.
  min_budget_minor bigint,
  requires_identity_verification boolean not null default false,
  job_count    integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint categories_slug_format check (slug ~ '^[a-z0-9-]{2,48}$'),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create index categories_parent_idx on categories (parent_id, position);
create index categories_active_idx on categories (is_active, position);
create index categories_name_trgm_idx on categories using gin (app.normalize_text(name) gin_trgm_ops);

create trigger categories_touch before update on categories
  for each row execute function app.touch_updated_at();

-- skills.category_id FK, deferred from 0002 until categories existed.
alter table skills
  add constraint skills_category_fk
  foreign key (category_id) references categories(id) on delete set null;

create index skills_category_idx on skills (category_id);

-- ── location reference tree ────────────────────────────────────────────────

create table locations (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references locations(id) on delete cascade,
  kind          text not null check (kind in ('country', 'state', 'city', 'area')),
  slug          text not null,
  name          text not null,
  country_code  text not null default 'NG',
  currency      currency_code not null default 'NGN',
  lat           double precision,
  lng           double precision,
  point         geography(Point, 4326)
                  generated always as (app.point_from_lat_lng(lat, lng)) stored,
  -- Approximate radius of the area, used to bound "jobs in Lekki" queries.
  radius_km     numeric(6,2),
  is_active     boolean not null default true,   -- geographic availability switch
  position      integer not null default 0,
  created_at    timestamptz not null default now(),

  unique (country_code, kind, slug)
);

create index locations_parent_idx on locations (parent_id, position);
create index locations_point_idx on locations using gist (point);
create index locations_name_trgm_idx on locations using gin (app.normalize_text(name) gin_trgm_ops);
create index locations_active_kind_idx on locations (is_active, kind);

-- Resolves the nearest active area/city for a coordinate. Used to label a job
-- with a human-readable neighbourhood ("Lekki Phase 1") without ever exposing
-- the precise address.
create or replace function app.nearest_location(
  in_lat double precision,
  in_lng double precision,
  in_kind text default 'area'
)
returns table (id uuid, name text, slug text, distance_m double precision)
language sql
stable
parallel safe
as $$
  select l.id, l.name, l.slug,
         st_distance(l.point, app.point_from_lat_lng(in_lat, in_lng)) as distance_m
  from locations l
  where l.is_active
    and l.kind = in_kind
    and l.point is not null
    and in_lat is not null
    and in_lng is not null
  order by l.point <-> app.point_from_lat_lng(in_lat, in_lng)
  limit 1
$$;
