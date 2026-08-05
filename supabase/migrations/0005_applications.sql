-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 — Applications and assignments.
--
-- An *application* is a hustler's offer on a job. An *assignment* is the
-- agreement created when a poster accepts one; it is the record the payment
-- and review systems hang off. Exactly one active assignment per job.
-- ═══════════════════════════════════════════════════════════════════════════

create table job_applications (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references jobs(id) on delete cascade,
  hustler_id          uuid not null references profiles(id) on delete cascade,

  status              application_status not null default 'submitted',

  -- The offer
  proposed_price_minor bigint not null check (proposed_price_minor >= 0),
  currency            currency_code not null default 'NGN',
  message             text not null,
  can_start_at        timestamptz,
  estimated_minutes   integer check (estimated_minutes is null or estimated_minutes between 15 and 43200),

  -- Snapshot of the hustler at application time. Kept so the poster's
  -- comparison view is stable even if the hustler's profile later changes.
  snapshot_rating     numeric(3,2) not null default 0,
  snapshot_jobs_done  integer not null default 0,
  snapshot_distance_m double precision,

  portfolio_item_ids  uuid[] not null default '{}',
  skill_ids           uuid[] not null default '{}',

  is_shortlisted      boolean not null default false,
  poster_viewed_at    timestamptz,
  responded_at        timestamptz,
  decline_reason      text,
  withdrawn_reason    text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint job_applications_message_length
    check (char_length(trim(message)) between 10 and 2000)
);

-- One live application per hustler per job. A withdrawn/declined application
-- does not block a later re-application if the poster reopens the job.
create unique index job_applications_one_live_per_hustler
  on job_applications (job_id, hustler_id)
  where status in ('submitted', 'shortlisted', 'accepted');

create index job_applications_job_idx on job_applications (job_id, status, created_at desc);
create index job_applications_hustler_idx on job_applications (hustler_id, created_at desc);
create index job_applications_shortlist_idx on job_applications (job_id, is_shortlisted)
  where is_shortlisted;

create trigger job_applications_touch before update on job_applications
  for each row execute function app.touch_updated_at();

-- ── Business rules enforced at the database level ──────────────────────────
-- These are the rules that must hold no matter which client, service or admin
-- script is writing. The API layer validates them too (for good error
-- messages), but the database is what makes them true.

create or replace function app.guard_application_insert()
returns trigger
language plpgsql
as $$
declare
  v_job jobs%rowtype;
begin
  select * into v_job from jobs where id = new.job_id for update;

  if not found or v_job.deleted_at is not null then
    raise exception 'Job not found' using errcode = 'no_data_found';
  end if;

  -- Rule: a user cannot apply to their own job.
  if v_job.poster_id = new.hustler_id then
    raise exception 'You cannot apply to your own job' using errcode = 'check_violation';
  end if;

  -- Rule: only open jobs accept applications.
  if v_job.status not in ('PUBLISHED', 'APPLICATIONS_OPEN') then
    raise exception 'This job is no longer accepting applications'
      using errcode = 'check_violation';
  end if;

  -- Rule: blocked users cannot interact.
  if app.is_blocked_between(v_job.poster_id, new.hustler_id) then
    raise exception 'You cannot apply to this job' using errcode = 'insufficient_privilege';
  end if;

  -- Rule: suspended/banned accounts cannot apply.
  if exists (
    select 1 from profiles p
    where p.id = new.hustler_id
      and (p.status <> 'active' or p.deleted_at is not null)
  ) then
    raise exception 'Your account cannot apply to jobs right now'
      using errcode = 'insufficient_privilege';
  end if;

  -- Invite-only jobs require an invitation.
  if v_job.visibility = 'invite_only'
     and not exists (
       select 1 from job_invitations
       where job_id = new.job_id and hustler_id = new.hustler_id
     ) then
    raise exception 'This job is invite-only' using errcode = 'insufficient_privilege';
  end if;

  new.currency := v_job.currency;

  -- Freeze the reputation snapshot server-side.
  select p.rating_avg, p.jobs_completed
    into new.snapshot_rating, new.snapshot_jobs_done
  from profiles p where p.id = new.hustler_id;

  if v_job.exact_point is not null then
    select st_distance(v_job.exact_point, p.home_point)
      into new.snapshot_distance_m
    from profiles p where p.id = new.hustler_id and p.home_point is not null;
  end if;

  return new;
end;
$$;

create trigger job_applications_guard before insert on job_applications
  for each row execute function app.guard_application_insert();

-- Keeps jobs.application_count accurate and flips PUBLISHED -> APPLICATIONS_OPEN
-- on the first application.
create or replace function app.sync_application_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update jobs
       set application_count = application_count + 1,
           status = case when status = 'PUBLISHED' then 'APPLICATIONS_OPEN'::job_status else status end
     where id = new.job_id;
  elsif tg_op = 'DELETE' then
    update jobs set application_count = greatest(application_count - 1, 0)
     where id = old.job_id;
  end if;
  return null;
end;
$$;

create trigger job_applications_count
  after insert or delete on job_applications
  for each row execute function app.sync_application_count();

-- ── assignments ────────────────────────────────────────────────────────────

create table job_assignments (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references jobs(id) on delete cascade,
  application_id     uuid not null references job_applications(id) on delete restrict,
  hustler_id         uuid not null references profiles(id) on delete restrict,
  poster_id          uuid not null references profiles(id) on delete restrict,

  status             assignment_status not null default 'pending_payment',

  -- The agreed commercial terms, frozen at acceptance. `agreed_price_minor` is
  -- the number every downstream money calculation uses — never the job budget.
  agreed_price_minor bigint not null check (agreed_price_minor > 0),
  currency           currency_code not null default 'NGN',
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0),
  hustler_net_minor  bigint not null default 0 check (hustler_net_minor >= 0),
  commission_rate_bps integer not null default 1000
                        check (commission_rate_bps between 0 and 5000),

  scheduled_for      timestamptz,
  started_at         timestamptz,
  submitted_at       timestamptz,
  completion_note    text,
  completion_media   text[] not null default '{}',
  confirmed_at       timestamptz,
  cancelled_at       timestamptz,
  cancelled_by       uuid references profiles(id) on delete set null,
  cancellation_reason text,

  -- Auto-confirmation guard: if a poster never confirms, a cron job releases
  -- the escrow after this deadline so hustlers are not held hostage.
  auto_confirm_at    timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint job_assignments_fee_arithmetic
    check (platform_fee_minor + hustler_net_minor = agreed_price_minor),
  constraint job_assignments_not_self
    check (poster_id <> hustler_id)
);

-- Exactly one live assignment per job.
create unique index job_assignments_one_active_per_job
  on job_assignments (job_id)
  where status in ('pending_payment', 'active', 'submitted', 'disputed');

create index job_assignments_hustler_idx on job_assignments (hustler_id, status, created_at desc);
create index job_assignments_poster_idx on job_assignments (poster_id, status, created_at desc);
create index job_assignments_auto_confirm_idx on job_assignments (auto_confirm_at)
  where status = 'submitted';

create trigger job_assignments_touch before update on job_assignments
  for each row execute function app.touch_updated_at();

-- On successful completion, bump the hustler's completed-jobs counter exactly
-- once (the `status` guard makes this idempotent under retries).
create or replace function app.sync_assignment_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update profiles set jobs_completed = jobs_completed + 1 where id = new.hustler_id;
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update profiles set cancellation_count = cancellation_count + 1
     where id = coalesce(new.cancelled_by, new.hustler_id);
  end if;

  return new;
end;
$$;

create trigger job_assignments_completion
  after update of status on job_assignments
  for each row execute function app.sync_assignment_completion();

-- ── response-time metrics (drives "responds within ~2 hours" on profiles) ──

create table application_responses (
  application_id uuid primary key references job_applications(id) on delete cascade,
  poster_id      uuid not null references profiles(id) on delete cascade,
  responded_in_secs integer not null check (responded_in_secs >= 0),
  created_at     timestamptz not null default now()
);

create index application_responses_poster_idx on application_responses (poster_id);

create or replace function app.record_application_response()
returns trigger
language plpgsql
as $$
declare
  v_poster uuid;
  v_secs integer;
begin
  if new.status in ('accepted', 'declined', 'shortlisted')
     and old.status = 'submitted' then
    select poster_id into v_poster from jobs where id = new.job_id;
    v_secs := greatest(extract(epoch from (now() - new.created_at))::integer, 0);

    insert into application_responses (application_id, poster_id, responded_in_secs)
    values (new.id, v_poster, v_secs)
    on conflict (application_id) do nothing;

    -- Recompute the poster's rolling response metrics.
    update profiles p
       set response_time_secs = sub.avg_secs,
           response_rate = sub.rate
      from (
        select
          avg(ar.responded_in_secs)::integer as avg_secs,
          least(
            100.0,
            (count(ar.application_id)::numeric * 100.0)
              / nullif((select count(*) from job_applications ja
                        join jobs j on j.id = ja.job_id
                        where j.poster_id = v_poster), 0)
          )::numeric(5,2) as rate
        from application_responses ar
        where ar.poster_id = v_poster
      ) sub
     where p.id = v_poster;
  end if;
  return new;
end;
$$;

create trigger job_applications_response_metrics
  after update of status on job_applications
  for each row execute function app.record_application_response();
