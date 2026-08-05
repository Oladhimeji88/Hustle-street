-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 — Two defects found by `pnpm db:verify` against a real database.
--
-- ── Defect 1: column privileges silently widened ──────────────────────────
-- 0013 restricted sensitive columns with column-level GRANTs (profiles.email,
-- profiles.phone, jobs.exact_lat, …). 0015 then issued
-- `GRANT SELECT ON ALL TABLES IN SCHEMA public`, and in PostgreSQL a
-- table-level grant REPLACES the column-level grants rather than intersecting
-- with them. Net effect: anonymous visitors could read every user's email
-- address, phone number and the exact coordinates of every job.
--
-- ── Defect 2: infinite recursion in the jobs policy ───────────────────────
-- `jobs_select_visible` consults `job_invitations` for invite-only listings.
-- `job_invitations_write_poster` was declared FOR ALL — which includes SELECT —
-- and its USING clause queries `jobs`. Reading a job therefore required
-- reading an invitation, which required reading the job. PostgreSQL aborted
-- with "infinite recursion detected in policy for relation jobs", so the
-- public marketplace returned zero rows to logged-out visitors.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Fix 2 first: break the policy cycle ────────────────────────────────────

-- A SECURITY DEFINER lookup runs with the owner's rights and therefore does NOT
-- re-enter RLS on job_invitations. This is the standard way to reference
-- another table from a policy without creating a cycle.
create or replace function app.is_invited_to_job(p_job_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from job_invitations ji
    where ji.job_id = p_job_id and ji.hustler_id = p_user
  )
$$;

grant execute on function app.is_invited_to_job(uuid, uuid) to anon, authenticated, service_role;

drop policy if exists jobs_select_visible on jobs;

create policy jobs_select_visible on jobs
  for select using (
    app.is_staff()
    or poster_id = app.current_user_id()
    or (
      deleted_at is null
      and status in ('PUBLISHED', 'APPLICATIONS_OPEN', 'HIRED', 'IN_PROGRESS',
                     'SUBMITTED', 'COMPLETED', 'EXPIRED', 'DISPUTED')
      and (
        visibility <> 'invite_only'
        or app.is_invited_to_job(jobs.id, app.current_user_id())
      )
      and not app.is_blocked_between(poster_id, app.current_user_id())
    )
  );

-- Split the FOR ALL policy so SELECT is served only by the non-recursive
-- `job_invitations_select` policy.
drop policy if exists job_invitations_write_poster on job_invitations;

create policy job_invitations_insert_poster on job_invitations
  for insert with check (
    exists (select 1 from jobs j
            where j.id = job_invitations.job_id and j.poster_id = app.current_user_id())
  );

create policy job_invitations_update_poster on job_invitations
  for update using (invited_by = app.current_user_id())
  with check (invited_by = app.current_user_id());

create policy job_invitations_delete_poster on job_invitations
  for delete using (invited_by = app.current_user_id());

-- ── Fix 1: restore column-level privacy ───────────────────────────────────
-- Re-applied AFTER 0015's blanket grant so ordering can no longer undo it.
-- Any future migration that issues a table-wide GRANT on these tables must
-- re-run this block.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    return;
  end if;

  -- profiles: drop the table-wide grant, then re-grant only the public columns.
  revoke select on profiles from anon, authenticated;

  grant select (
    id, username, display_name, avatar_url, bio, headline,
    city, area, state, country_code,
    is_hustler, is_poster, service_radius_km,
    hourly_rate_minor, starting_price_minor, currency,
    available_now, accepts_remote,
    rating_avg, rating_count, jobs_completed, jobs_posted,
    response_rate, response_time_secs,
    status, email_verified, phone_verified, identity_verified,
    profile_completed, locale, timezone, last_active_at, created_at
  ) on profiles to anon, authenticated;

  -- jobs: everything except the precise location and the private address link.
  revoke select on jobs from anon, authenticated;

  grant select (
    id, reference, poster_id, category_id, title, description,
    status, urgency, location_kind, visibility,
    approx_point, area_label, city, state, country_code, location_id,
    schedule_kind, scheduled_for, duration_minutes,
    budget_kind, budget_min_minor, budget_max_minor, currency,
    view_count, application_count, save_count, notified_count,
    is_flagged, published_at, expires_at, hired_at, started_at,
    submitted_at, completed_at, cancelled_at, cancellation_reason,
    deleted_at, created_at, updated_at
  ) on jobs to anon, authenticated;

  -- addresses stay entirely private; RLS decides which rows, and a
  -- counterparty reaches them only through the job_precise_location view.
  revoke select on addresses from anon;
end
$$;

-- ── Guard against this class of regression ────────────────────────────────
-- A cheap assertion the verification script and CI can call.

create or replace function app.assert_column_privacy()
returns table (issue text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select format('%s.%s is readable by %s', c.table_name, c.column_name, c.grantee)
  from information_schema.column_privileges c
  where c.table_schema = 'public'
    and c.grantee in ('anon', 'authenticated')
    and c.privilege_type = 'SELECT'
    and (
      (c.table_name = 'profiles' and c.column_name in ('email', 'phone', 'home_lat', 'home_lng',
                                                        'risk_score', 'risk_level',
                                                        'suspended_until', 'suspension_reason'))
      or (c.table_name = 'jobs' and c.column_name in ('exact_lat', 'exact_lng', 'exact_point',
                                                       'address_id'))
    )
$$;

grant execute on function app.assert_column_privacy() to service_role;

do $$
begin
  notify pgrst, 'reload schema';
exception
  when others then null;
end
$$;
