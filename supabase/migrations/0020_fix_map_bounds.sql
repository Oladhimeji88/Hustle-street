-- ═══════════════════════════════════════════════════════════════════════════
-- 0020 — Fix the map viewport query.
--
-- jobs_in_bounds() used:
--   st_intersects(approx_point, st_makeenvelope(...)::geography)
--
-- PostGIS could not plan that: its index support function raised inside
-- gserialized_supportfn.c when asked to handle an ST_Intersects between a
-- geography column and a geography-cast envelope, so every map query failed.
--
-- A viewport is a bounding box, not a distance search, so the natural operator
-- is `&&` in geometry space. It is exactly what a map pan/zoom needs, and it is
-- index-accelerated by the functional GIST index added below.
--
-- Coordinates remain the FUZZED approx_point, so map pins still cannot be used
-- to triangulate a private address.
-- ═══════════════════════════════════════════════════════════════════════════

-- The geography → geometry cast is immutable, so it can back an index.
create index if not exists jobs_approx_point_geom_idx
  on jobs using gist ((approx_point::geometry))
  where deleted_at is null and status in ('PUBLISHED', 'APPLICATIONS_OPEN');

create or replace function jobs_in_bounds(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_category_ids uuid[] default null,
  p_limit integer default 200
)
returns table (
  id uuid,
  title text,
  lat double precision,
  lng double precision,
  budget_min_minor bigint,
  budget_max_minor bigint,
  currency currency_code,
  category_slug text,
  category_icon text,
  urgency job_urgency,
  area_label text
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select
    j.id, j.title,
    st_y(j.approx_point::geometry), st_x(j.approx_point::geometry),
    j.budget_min_minor, j.budget_max_minor, j.currency,
    c.slug, c.icon, j.urgency, j.area_label
  from jobs j
  join categories c on c.id = j.category_id
  where j.deleted_at is null
    and j.status in ('PUBLISHED', 'APPLICATIONS_OPEN')
    and (j.expires_at is null or j.expires_at > now())
    and j.visibility <> 'invite_only'
    and j.approx_point is not null
    -- Bounding-box overlap in geometry space: the right operator for a
    -- rectangular viewport, and GIST-indexable.
    and j.approx_point::geometry
        && st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
    and (p_category_ids is null or j.category_id = any(p_category_ids))
    and (app.current_user_id() is null or j.poster_id <> app.current_user_id())
  order by j.published_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
$$;

grant execute on function jobs_in_bounds(
  double precision, double precision, double precision, double precision, uuid[], integer
) to anon, authenticated, service_role;
