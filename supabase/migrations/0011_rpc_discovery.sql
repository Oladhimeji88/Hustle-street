-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 — Discovery RPCs: geospatial search, ranking and recommendations.
--
-- Every function here returns APPROXIMATE location only. Exact coordinates and
-- street addresses are never selected into a discovery result set — they only
-- become visible through the job-detail path once a working relationship
-- exists (see 0013_rls.sql).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── job search ─────────────────────────────────────────────────────────────

create or replace function search_jobs(
  p_lat            double precision default null,
  p_lng            double precision default null,
  p_radius_km      numeric default null,
  p_query          text default null,
  p_category_ids   uuid[] default null,
  p_min_budget_minor bigint default null,
  p_max_budget_minor bigint default null,
  p_urgency        job_urgency[] default null,
  p_location_kind  job_location_kind[] default null,
  p_min_poster_rating numeric default null,
  p_posted_within_hours integer default null,
  p_sort           text default 'relevant',   -- relevant|nearest|newest|highest_paying|urgent
  p_limit          integer default 20,
  p_offset         integer default 0
)
returns table (
  id uuid,
  reference text,
  title text,
  description text,
  status job_status,
  urgency job_urgency,
  location_kind job_location_kind,
  category_id uuid,
  category_name text,
  category_slug text,
  category_icon text,
  budget_kind budget_kind,
  budget_min_minor bigint,
  budget_max_minor bigint,
  currency currency_code,
  area_label text,
  city text,
  distance_m double precision,
  schedule_kind job_schedule_kind,
  scheduled_for timestamptz,
  application_count integer,
  view_count integer,
  published_at timestamptz,
  expires_at timestamptz,
  poster_id uuid,
  poster_name text,
  poster_avatar text,
  poster_rating numeric,
  poster_jobs_posted integer,
  poster_identity_verified boolean,
  cover_image text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with
  viewer as (select app.current_user_id() as uid),
  origin as (
    select case
      when p_lat is not null and p_lng is not null
        then app.point_from_lat_lng(p_lat, p_lng)
      else null
    end as pt
  ),
  bounds as (
    select least(
      coalesce(p_radius_km, app.setting_number('nearby_default_radius_km', 10)),
      app.setting_number('nearby_max_radius_km', 50)
    )::double precision * 1000 as radius_m
  ),
  normalized_query as (
    select nullif(app.normalize_text(p_query), '') as q
  ),
  filtered as (
    select
      j.*,
      c.name as c_name, c.slug as c_slug, c.icon as c_icon,
      p.display_name as p_name, p.avatar_url as p_avatar,
      p.rating_avg as p_rating, p.jobs_posted as p_jobs, p.identity_verified as p_verified,
      case
        when o.pt is null or j.approx_point is null then null
        else st_distance(j.approx_point, o.pt)
      end as dist_m,
      nq.q as nq
    from jobs j
    join categories c on c.id = j.category_id
    join profiles p on p.id = j.poster_id
    cross join origin o
    cross join bounds b
    cross join viewer v
    cross join normalized_query nq
    where j.deleted_at is null
      and j.status in ('PUBLISHED', 'APPLICATIONS_OPEN')
      and (j.expires_at is null or j.expires_at > now())
      and j.visibility <> 'invite_only'
      and p.status = 'active'
      -- Never surface a user's own jobs in the "find work" feed.
      and (v.uid is null or j.poster_id <> v.uid)
      -- Respect blocks in both directions.
      and (v.uid is null or not app.is_blocked_between(v.uid, j.poster_id))
      -- Geographic filter. Remote jobs bypass the radius entirely.
      and (
        o.pt is null
        or j.location_kind = 'remote'
        or (j.approx_point is not null and st_dwithin(j.approx_point, o.pt, b.radius_m))
      )
      and (p_category_ids is null or j.category_id = any(p_category_ids))
      and (p_urgency is null or j.urgency = any(p_urgency))
      and (p_location_kind is null or j.location_kind = any(p_location_kind))
      and (p_min_budget_minor is null
           or coalesce(j.budget_max_minor, j.budget_min_minor) >= p_min_budget_minor)
      and (p_max_budget_minor is null
           or coalesce(j.budget_min_minor, j.budget_max_minor) <= p_max_budget_minor)
      and (p_min_poster_rating is null or p.rating_avg >= p_min_poster_rating)
      and (p_posted_within_hours is null
           or j.published_at >= now() - make_interval(hours => p_posted_within_hours))
      -- Text search: full-text first, trigram similarity as the typo-tolerant
      -- fallback so "plumer" still finds "plumber".
      and (
        nq.q is null
        or j.search_vector @@ plainto_tsquery('simple', nq.q)
        or app.normalize_text(j.title) % nq.q
        or app.normalize_text(c.name) % nq.q
      )
  ),
  counted as (select count(*) as n from filtered)
select
  f.id, f.reference, f.title, f.description, f.status, f.urgency, f.location_kind,
  f.category_id, f.c_name, f.c_slug, f.c_icon,
  f.budget_kind, f.budget_min_minor, f.budget_max_minor, f.currency,
  f.area_label, f.city, f.dist_m,
  f.schedule_kind, f.scheduled_for,
  f.application_count, f.view_count, f.published_at, f.expires_at,
  f.poster_id, f.p_name, f.p_avatar, f.p_rating, f.p_jobs, f.p_verified,
  (select ji.storage_path from job_images ji
    where ji.job_id = f.id order by ji.position limit 1) as cover_image,
  counted.n
from filtered f
cross join counted
order by
  case when p_sort = 'nearest'        then f.dist_m end asc nulls last,
  case when p_sort = 'newest'         then f.published_at end desc nulls last,
  case when p_sort = 'highest_paying' then coalesce(f.budget_max_minor, f.budget_min_minor) end desc nulls last,
  case when p_sort = 'urgent'         then
    case f.urgency when 'asap' then 0 when 'today' then 1 when 'scheduled' then 2 else 3 end
  end asc,
  -- Default "relevant": text match quality, then urgency, then proximity, then
  -- recency. Deliberately deterministic so results are stable across pages.
  case when p_sort = 'relevant' and f.nq is not null
    then ts_rank(f.search_vector, plainto_tsquery('simple', f.nq)) end desc nulls last,
  case when p_sort = 'relevant' then
    case f.urgency when 'asap' then 0 when 'today' then 1 when 'scheduled' then 2 else 3 end
  end asc,
  case when p_sort = 'relevant' then f.dist_m end asc nulls last,
  f.published_at desc nulls last,
  f.id
limit least(greatest(coalesce(p_limit, 20), 1), 100)
offset greatest(coalesce(p_offset, 0), 0)
$$;

comment on function search_jobs is
  'Primary discovery query. Returns fuzzed distance only — no exact coordinates.';

-- ── hustler search ─────────────────────────────────────────────────────────

create or replace function search_hustlers(
  p_lat          double precision default null,
  p_lng          double precision default null,
  p_radius_km    numeric default null,
  p_query        text default null,
  p_category_ids uuid[] default null,
  p_skill_ids    uuid[] default null,
  p_min_rating   numeric default null,
  p_available_now boolean default null,
  p_max_price_minor bigint default null,
  p_verified_only boolean default false,
  p_sort         text default 'relevant',   -- relevant|nearest|rating|experience|price
  p_limit        integer default 20,
  p_offset       integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  headline text,
  bio text,
  area text,
  city text,
  distance_m double precision,
  rating_avg numeric,
  rating_count integer,
  jobs_completed integer,
  response_rate numeric,
  response_time_secs integer,
  available_now boolean,
  accepts_remote boolean,
  starting_price_minor bigint,
  hourly_rate_minor bigint,
  currency currency_code,
  identity_verified boolean,
  phone_verified boolean,
  service_radius_km integer,
  skills text[],
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with
  viewer as (select app.current_user_id() as uid),
  origin as (
    select case
      when p_lat is not null and p_lng is not null then app.point_from_lat_lng(p_lat, p_lng)
      else null
    end as pt
  ),
  bounds as (
    select least(
      coalesce(p_radius_km, app.setting_number('nearby_default_radius_km', 10)),
      app.setting_number('nearby_max_radius_km', 50)
    )::double precision * 1000 as radius_m
  ),
  normalized_query as (select nullif(app.normalize_text(p_query), '') as q),
  filtered as (
    select
      p.*,
      case
        when o.pt is null or p.public_point is null then null
        else st_distance(p.public_point, o.pt)
      end as dist_m,
      nq.q as nq,
      array(
        select s.name from user_skills us
        join skills s on s.id = us.skill_id
        where us.user_id = p.id
        order by us.is_primary desc, s.name
        limit 8
      ) as skill_names
    from profiles p
    cross join origin o
    cross join bounds b
    cross join viewer v
    cross join normalized_query nq
    where p.deleted_at is null
      and p.is_hustler
      and p.status = 'active'
      and (v.uid is null or p.id <> v.uid)
      and (v.uid is null or not app.is_blocked_between(v.uid, p.id))
      and (
        o.pt is null
        or p.accepts_remote
        or (p.public_point is not null and st_dwithin(p.public_point, o.pt, b.radius_m))
      )
      and (p_min_rating is null or p.rating_avg >= p_min_rating)
      and (p_available_now is null or p.available_now = p_available_now)
      and (not p_verified_only or p.identity_verified)
      and (p_max_price_minor is null
           or coalesce(p.starting_price_minor, p.hourly_rate_minor, 0) <= p_max_price_minor)
      and (
        p_skill_ids is null
        or exists (select 1 from user_skills us
                   where us.user_id = p.id and us.skill_id = any(p_skill_ids))
      )
      and (
        p_category_ids is null
        or exists (select 1 from user_skills us
                   join skills s on s.id = us.skill_id
                   where us.user_id = p.id and s.category_id = any(p_category_ids))
      )
      and (
        nq.q is null
        or app.normalize_text(p.display_name) % nq.q
        or app.normalize_text(coalesce(p.headline, '')) % nq.q
        or exists (
          select 1 from user_skills us join skills s on s.id = us.skill_id
          where us.user_id = p.id and app.normalize_text(s.name) % nq.q
        )
      )
  ),
  counted as (select count(*) as n from filtered)
select
  f.id, f.username, f.display_name, f.avatar_url, f.headline, f.bio,
  f.area, f.city, f.dist_m,
  f.rating_avg, f.rating_count, f.jobs_completed, f.response_rate, f.response_time_secs,
  f.available_now, f.accepts_remote,
  f.starting_price_minor, f.hourly_rate_minor, f.currency,
  f.identity_verified, f.phone_verified, f.service_radius_km,
  f.skill_names,
  counted.n
from filtered f
cross join counted
order by
  case when p_sort = 'nearest'    then f.dist_m end asc nulls last,
  case when p_sort = 'rating'     then f.rating_avg end desc,
  case when p_sort = 'experience' then f.jobs_completed end desc,
  case when p_sort = 'price'      then coalesce(f.starting_price_minor, f.hourly_rate_minor) end asc nulls last,
  case when p_sort = 'relevant'   then (f.available_now)::int end desc,
  case when p_sort = 'relevant'   then f.dist_m end asc nulls last,
  case when p_sort = 'relevant'   then f.rating_avg end desc,
  f.jobs_completed desc,
  f.id
limit least(greatest(coalesce(p_limit, 20), 1), 100)
offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ── recommendations ────────────────────────────────────────────────────────
--
-- Deterministic, explainable scoring. Weights live in platform_settings so they
-- can be retuned from the admin dashboard, and the component sub-scores are
-- returned alongside the total so the UI can say *why* a job was surfaced.
-- Swapping in an ML model later means replacing the score expression only —
-- the contract stays identical.

create or replace function recommend_jobs(
  p_hustler_id uuid default null,
  p_limit integer default 20
)
returns table (
  job_id uuid,
  title text,
  category_name text,
  budget_min_minor bigint,
  budget_max_minor bigint,
  currency currency_code,
  area_label text,
  distance_m double precision,
  urgency job_urgency,
  application_count integer,
  published_at timestamptz,
  score numeric,
  score_location numeric,
  score_skills numeric,
  score_rating numeric,
  score_availability numeric,
  score_experience numeric,
  reason text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with
  me as (
    select p.*
    from profiles p
    where p.id = coalesce(p_hustler_id, app.current_user_id())
  ),
  w as (
    select
      app.setting_number('reco_weight_location', 30) as w_loc,
      app.setting_number('reco_weight_skills', 30) as w_skill,
      app.setting_number('reco_weight_rating', 15) as w_rating,
      app.setting_number('reco_weight_availability', 15) as w_avail,
      app.setting_number('reco_weight_experience', 10) as w_exp
  ),
  my_categories as (
    -- Categories the hustler has skills in, or has successfully worked in.
    select distinct s.category_id
    from user_skills us join skills s on s.id = us.skill_id
    where us.user_id = (select id from me) and s.category_id is not null
    union
    select distinct j.category_id
    from job_assignments ja join jobs j on j.id = ja.job_id
    where ja.hustler_id = (select id from me) and ja.status = 'completed'
  ),
  candidates as (
    select
      j.id, j.title, j.category_id, j.budget_min_minor, j.budget_max_minor, j.currency,
      j.area_label, j.urgency, j.application_count, j.published_at, j.location_kind,
      j.poster_id,
      c.name as category_name,
      case
        when me.home_point is null or j.approx_point is null then null
        else st_distance(j.approx_point, me.home_point)
      end as dist_m
    from jobs j
    join categories c on c.id = j.category_id
    cross join me
    where j.deleted_at is null
      and j.status in ('PUBLISHED', 'APPLICATIONS_OPEN')
      and (j.expires_at is null or j.expires_at > now())
      and j.poster_id <> me.id
      and j.visibility <> 'invite_only'
      and not app.is_blocked_between(me.id, j.poster_id)
      -- Already applied? Do not re-recommend.
      and not exists (
        select 1 from job_applications ja
        where ja.job_id = j.id and ja.hustler_id = me.id
          and ja.status in ('submitted', 'shortlisted', 'accepted')
      )
      and (
        j.location_kind = 'remote'
        or me.home_point is null
        or st_dwithin(j.approx_point, me.home_point, (me.service_radius_km * 1000)::double precision)
      )
  ),
  scored as (
    select
      cd.*,
      -- Location: linear decay across the hustler's own service radius.
      case
        when cd.location_kind = 'remote' then 1.0
        when cd.dist_m is null then 0.5
        else greatest(0, 1 - (cd.dist_m / nullif(me.service_radius_km * 1000.0, 0)))
      end::numeric as s_loc,
      -- Skills: does the job's category match what this hustler does?
      case
        when cd.category_id in (select category_id from my_categories) then 1.0
        when exists (select 1 from my_categories) then 0.15
        else 0.5   -- new hustler with no signal yet: stay neutral
      end::numeric as s_skill,
      -- Rating: the hustler's own standing, so strong hustlers see more.
      (least(me.rating_avg, 5) / 5.0)::numeric as s_rating,
      -- Availability: urgent jobs matter more when the hustler is available now.
      case
        when me.available_now and cd.urgency in ('asap', 'today') then 1.0
        when me.available_now then 0.75
        when cd.urgency in ('asap', 'today') then 0.35
        else 0.6
      end::numeric as s_avail,
      -- Experience: fewer applicants = better odds; reward low-competition jobs.
      greatest(0, 1 - (least(cd.application_count, 20) / 20.0))::numeric as s_exp
    from candidates cd
    cross join me
  )
select
  s.id, s.title, s.category_name,
  s.budget_min_minor, s.budget_max_minor, s.currency,
  s.area_label, s.dist_m, s.urgency, s.application_count, s.published_at,
  round(
    (s.s_loc * w.w_loc + s.s_skill * w.w_skill + s.s_rating * w.w_rating
     + s.s_avail * w.w_avail + s.s_exp * w.w_exp), 2
  ) as score,
  round(s.s_loc * w.w_loc, 2),
  round(s.s_skill * w.w_skill, 2),
  round(s.s_rating * w.w_rating, 2),
  round(s.s_avail * w.w_avail, 2),
  round(s.s_exp * w.w_exp, 2),
  -- A short, honest explanation of the top contributing factor.
  case
    when s.s_skill >= 0.9 and s.s_loc >= 0.7 then 'Matches your skills and close to you'
    when s.s_skill >= 0.9 then 'Matches your skills'
    when s.s_loc >= 0.8 then 'Very close to you'
    when s.urgency in ('asap', 'today') then 'Needed urgently'
    when s.s_exp >= 0.8 then 'Few applicants so far'
    else 'Available near you'
  end as reason
from scored s
cross join w
order by score desc, s.published_at desc
limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

create or replace function recommend_hustlers_for_job(
  p_job_id uuid,
  p_limit integer default 20
)
returns table (
  hustler_id uuid,
  username text,
  display_name text,
  avatar_url text,
  headline text,
  rating_avg numeric,
  jobs_completed integer,
  distance_m double precision,
  available_now boolean,
  starting_price_minor bigint,
  response_rate numeric,
  identity_verified boolean,
  score numeric,
  reason text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with
  job as (select j.* from jobs j where j.id = p_job_id),
  w as (
    select
      app.setting_number('reco_weight_location', 30) as w_loc,
      app.setting_number('reco_weight_skills', 30) as w_skill,
      app.setting_number('reco_weight_rating', 15) as w_rating,
      app.setting_number('reco_weight_availability', 15) as w_avail,
      app.setting_number('reco_weight_experience', 10) as w_exp
  ),
  scored as (
    select
      p.id, p.username, p.display_name, p.avatar_url, p.headline,
      p.rating_avg, p.jobs_completed, p.available_now, p.starting_price_minor,
      p.response_rate, p.identity_verified,
      case
        when j.approx_point is null or p.public_point is null then null
        else st_distance(p.public_point, j.approx_point)
      end as dist_m,
      case
        when j.location_kind = 'remote' and p.accepts_remote then 1.0
        when j.approx_point is null or p.public_point is null then 0.5
        else greatest(0, 1 - (st_distance(p.public_point, j.approx_point)
                              / nullif(p.service_radius_km * 1000.0, 0)))
      end::numeric as s_loc,
      case
        when exists (
          select 1 from user_skills us join skills s on s.id = us.skill_id
          where us.user_id = p.id and s.category_id = j.category_id
        ) then 1.0
        else 0.2
      end::numeric as s_skill,
      (least(p.rating_avg, 5) / 5.0)::numeric as s_rating,
      case when p.available_now then 1.0 else 0.4 end::numeric as s_avail,
      least(p.jobs_completed / 50.0, 1.0)::numeric as s_exp
    from profiles p
    cross join job j
    where p.deleted_at is null
      and p.is_hustler
      and p.status = 'active'
      and p.id <> j.poster_id
      and not app.is_blocked_between(j.poster_id, p.id)
      and (
        j.location_kind = 'remote'
        or j.approx_point is null
        or p.public_point is null
        or st_dwithin(p.public_point, j.approx_point, (p.service_radius_km * 1000)::double precision)
      )
  )
select
  s.id, s.username, s.display_name, s.avatar_url, s.headline,
  s.rating_avg, s.jobs_completed, s.dist_m, s.available_now,
  s.starting_price_minor, s.response_rate, s.identity_verified,
  round(
    (s.s_loc * w.w_loc + s.s_skill * w.w_skill + s.s_rating * w.w_rating
     + s.s_avail * w.w_avail + s.s_exp * w.w_exp), 2
  ) as score,
  case
    when s.s_skill >= 0.9 and s.available_now then 'Skilled in this category and available now'
    when s.s_skill >= 0.9 then 'Skilled in this category'
    when s.available_now then 'Available now nearby'
    when s.jobs_completed >= 25 then 'Highly experienced'
    else 'Nearby hustler'
  end as reason
from scored s
cross join w
order by score desc, s.rating_avg desc, s.jobs_completed desc
limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- ── unified search (jobs + hustlers + categories + skills) ─────────────────

create or replace function search_suggestions(p_query text, p_limit integer default 8)
returns table (kind text, id uuid, label text, sublabel text, slug text, icon text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with q as (select nullif(app.normalize_text(p_query), '') as term)
(
  select 'category'::text, c.id, c.name, 'Category'::text, c.slug, c.icon
  from categories c, q
  where c.is_active and (q.term is null or app.normalize_text(c.name) % q.term
                         or app.normalize_text(c.name) like q.term || '%')
  order by similarity(app.normalize_text(c.name), coalesce((select term from q), '')) desc,
           c.job_count desc
  limit 3
)
union all
(
  select 'skill'::text, s.id, s.name, 'Skill'::text, s.slug, null::text
  from skills s, q
  where s.is_active and q.term is not null
    and (app.normalize_text(s.name) % q.term or app.normalize_text(s.name) like q.term || '%')
  order by similarity(app.normalize_text(s.name), (select term from q)) desc, s.usage_count desc
  limit 3
)
union all
(
  select 'location'::text, l.id, l.name,
         initcap(l.kind)::text, l.slug, null::text
  from locations l, q
  where l.is_active and q.term is not null
    and (app.normalize_text(l.name) % q.term or app.normalize_text(l.name) like q.term || '%')
  order by similarity(app.normalize_text(l.name), (select term from q)) desc
  limit 3
)
union all
(
  select 'job'::text, j.id, j.title, coalesce(j.area_label, j.city), null::text, null::text
  from jobs j, q
  where j.deleted_at is null
    and j.status in ('PUBLISHED', 'APPLICATIONS_OPEN')
    and q.term is not null
    and (j.search_vector @@ plainto_tsquery('simple', q.term)
         or app.normalize_text(j.title) % q.term)
  order by j.published_at desc
  limit 4
)
limit least(greatest(coalesce(p_limit, 8), 1), 20)
$$;

-- ── map clustering ─────────────────────────────────────────────────────────
-- Returns jobs inside a viewport, already snapped to the fuzzed grid so the map
-- can never be used to triangulate an exact address.

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
set search_path = public, pg_temp
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
    and st_intersects(
      j.approx_point,
      st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
    )
    and (p_category_ids is null or j.category_id = any(p_category_ids))
    and (app.current_user_id() is null or j.poster_id <> app.current_user_id())
  order by j.published_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
$$;
