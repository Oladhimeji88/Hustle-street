-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 — Trust & safety: reviews, reports, disputes, fraud signals.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── reviews ────────────────────────────────────────────────────────────────

create table reviews (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references job_assignments(id) on delete cascade,
  job_id         uuid not null references jobs(id) on delete cascade,
  reviewer_id    uuid not null references profiles(id) on delete cascade,
  reviewee_id    uuid not null references profiles(id) on delete cascade,
  direction      review_direction not null,

  rating         smallint not null check (rating between 1 and 5),
  body           text,

  -- Category scores. Which set applies depends on `direction`:
  --   poster_to_hustler → quality, communication, reliability, professionalism
  --   hustler_to_poster → communication, payment, respect, job_accuracy
  quality        smallint check (quality between 1 and 5),
  communication  smallint check (communication between 1 and 5),
  reliability    smallint check (reliability between 1 and 5),
  professionalism smallint check (professionalism between 1 and 5),
  payment_promptness smallint check (payment_promptness between 1 and 5),
  respect        smallint check (respect between 1 and 5),
  job_accuracy   smallint check (job_accuracy between 1 and 5),

  -- Reviews stay hidden until both sides have submitted (or the 14-day window
  -- closes). This is what stops retaliatory rating.
  is_published   boolean not null default false,
  published_at   timestamptz,

  is_hidden      boolean not null default false,   -- moderator takedown
  hidden_reason  text,
  flagged_count  integer not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint reviews_not_self check (reviewer_id <> reviewee_id),
  constraint reviews_body_length check (body is null or char_length(body) <= 2000)
);

-- Rule: one review per direction per assignment. Prevents duplicate reviews.
create unique index reviews_one_per_direction
  on reviews (assignment_id, reviewer_id);

create index reviews_reviewee_idx on reviews (reviewee_id, is_published, created_at desc);
create index reviews_job_idx on reviews (job_id);

create trigger reviews_touch before update on reviews
  for each row execute function app.touch_updated_at();

-- Rule: you may only review someone you actually completed a job with.
create or replace function app.guard_review_insert()
returns trigger
language plpgsql
as $$
declare
  v_assignment job_assignments%rowtype;
begin
  select * into v_assignment from job_assignments where id = new.assignment_id;

  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  if v_assignment.status <> 'completed' then
    raise exception 'You can only review after the job is completed'
      using errcode = 'check_violation';
  end if;

  -- The reviewer/reviewee pair must match the assignment's two parties, and the
  -- direction must match who is reviewing whom.
  if new.direction = 'poster_to_hustler' then
    if new.reviewer_id <> v_assignment.poster_id or new.reviewee_id <> v_assignment.hustler_id then
      raise exception 'Review parties do not match the job' using errcode = 'check_violation';
    end if;
  else
    if new.reviewer_id <> v_assignment.hustler_id or new.reviewee_id <> v_assignment.poster_id then
      raise exception 'Review parties do not match the job' using errcode = 'check_violation';
    end if;
  end if;

  new.job_id := v_assignment.job_id;
  return new;
end;
$$;

create trigger reviews_guard before insert on reviews
  for each row execute function app.guard_review_insert();

-- Double-blind publication: publish both reviews the moment the second one
-- lands. The 14-day fallback is handled by the cron worker.
create or replace function app.maybe_publish_reviews()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from reviews where assignment_id = new.assignment_id) >= 2 then
    update reviews
       set is_published = true, published_at = now()
     where assignment_id = new.assignment_id
       and not is_published;
  end if;
  return null;
end;
$$;

create trigger reviews_publish after insert on reviews
  for each row execute function app.maybe_publish_reviews();

-- Recomputes the reviewee's aggregate rating from published, non-hidden reviews.
create or replace function app.sync_profile_rating()
returns trigger
language plpgsql
as $$
declare
  v_user uuid;
begin
  -- NEW is unassigned on DELETE and OLD is unassigned on INSERT, so pick the
  -- record explicitly rather than COALESCE-ing across both.
  if tg_op = 'DELETE' then
    v_user := old.reviewee_id;
  else
    v_user := new.reviewee_id;
  end if;

  update profiles p
     set rating_avg = coalesce(sub.avg_rating, 0),
         rating_count = coalesce(sub.total, 0)
    from (
      select avg(rating)::numeric(3,2) as avg_rating, count(*) as total
      from reviews
      where reviewee_id = v_user and is_published and not is_hidden
    ) sub
   where p.id = v_user;
  return null;
end;
$$;

create trigger reviews_sync_rating
  after insert or delete or update of is_published, is_hidden, rating on reviews
  for each row execute function app.sync_profile_rating();

-- ── reports ────────────────────────────────────────────────────────────────

create table reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references profiles(id) on delete cascade,
  target_kind   report_target not null,
  target_id     uuid not null,
  -- Denormalised so moderators can act on the person even if the content goes.
  target_user_id uuid references profiles(id) on delete set null,

  reason        text not null,
  details       text,
  evidence_paths text[] not null default '{}',

  status        report_status not null default 'open',
  priority      smallint not null default 3 check (priority between 1 and 5),

  assigned_to   uuid references profiles(id) on delete set null,
  resolution    text,
  resolved_by   uuid references profiles(id) on delete set null,
  resolved_at   timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint reports_reason_length check (char_length(trim(reason)) between 3 and 200)
);

-- One open report per reporter per target: stops report-spam brigading.
create unique index reports_one_open_per_reporter
  on reports (reporter_id, target_kind, target_id)
  where status in ('open', 'reviewing');

create index reports_queue_idx on reports (status, priority, created_at);
create index reports_target_idx on reports (target_kind, target_id);
create index reports_target_user_idx on reports (target_user_id) where target_user_id is not null;

create trigger reports_touch before update on reports
  for each row execute function app.touch_updated_at();

-- ── disputes ───────────────────────────────────────────────────────────────

create table disputes (
  id             uuid primary key default gen_random_uuid(),
  reference      text not null unique
                   default 'DSP-' || upper(encode(gen_random_bytes(4), 'hex')),

  job_id         uuid not null references jobs(id) on delete restrict,
  assignment_id  uuid not null references job_assignments(id) on delete restrict,
  transaction_id uuid references transactions(id) on delete set null,

  raised_by      uuid not null references profiles(id) on delete restrict,
  against_user   uuid not null references profiles(id) on delete restrict,

  reason         dispute_reason not null,
  description    text not null,
  status         dispute_status not null default 'open',

  -- Amounts under dispute and the eventual split, in minor units.
  amount_minor   bigint not null check (amount_minor > 0),
  currency       currency_code not null default 'NGN',
  refund_to_poster_minor bigint check (refund_to_poster_minor >= 0),
  release_to_hustler_minor bigint check (release_to_hustler_minor >= 0),

  resolution     dispute_resolution,
  resolution_note text,
  assigned_to    uuid references profiles(id) on delete set null,
  resolved_by    uuid references profiles(id) on delete set null,
  resolved_at    timestamptz,

  -- SLA clock the admin queue sorts by.
  respond_by     timestamptz not null default now() + interval '48 hours',

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint disputes_description_length check (char_length(trim(description)) between 20 and 4000),
  constraint disputes_split_within_amount
    check (
      coalesce(refund_to_poster_minor, 0) + coalesce(release_to_hustler_minor, 0)
      <= amount_minor
    ),
  constraint disputes_resolved_has_verdict
    check (status <> 'resolved' or (resolution is not null and resolved_by is not null))
);

-- One live dispute per assignment.
create unique index disputes_one_open_per_assignment
  on disputes (assignment_id)
  where status in ('open', 'under_review', 'awaiting_evidence');

create index disputes_queue_idx on disputes (status, respond_by);
create index disputes_party_idx on disputes (raised_by, created_at desc);
create index disputes_against_idx on disputes (against_user, created_at desc);

create trigger disputes_touch before update on disputes
  for each row execute function app.touch_updated_at();

create table dispute_evidence (
  id           uuid primary key default gen_random_uuid(),
  dispute_id   uuid not null references disputes(id) on delete cascade,
  submitted_by uuid not null references profiles(id) on delete cascade,
  kind         text not null default 'note'
                 check (kind in ('note', 'image', 'file', 'message_ref', 'transaction_ref')),
  body         text,
  storage_path text,
  reference_id uuid,
  created_at   timestamptz not null default now()
);

create index dispute_evidence_dispute_idx on dispute_evidence (dispute_id, created_at);

-- Evidence cannot be edited or withdrawn once submitted.
create trigger dispute_evidence_immutable
  before update or delete on dispute_evidence
  for each row execute function app.forbid_mutation();

create table dispute_timeline (
  id          uuid primary key default gen_random_uuid(),
  dispute_id  uuid not null references disputes(id) on delete cascade,
  actor_id    uuid references profiles(id) on delete set null,
  actor_kind  text not null default 'user' check (actor_kind in ('user', 'admin', 'system')),
  event       text not null,
  detail      text,
  created_at  timestamptz not null default now()
);

create index dispute_timeline_dispute_idx on dispute_timeline (dispute_id, created_at);

create or replace function app.record_dispute_event()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into dispute_timeline (dispute_id, actor_id, event, detail)
    values (new.id, new.raised_by, 'opened', new.reason::text);

    -- Freeze the job and the money the moment a dispute is opened.
    update jobs set status = 'DISPUTED' where id = new.job_id
      and status in ('IN_PROGRESS', 'SUBMITTED', 'HIRED');
    update job_assignments set status = 'disputed' where id = new.assignment_id
      and status in ('active', 'submitted');
    update transactions set status = 'DISPUTED'
      where assignment_id = new.assignment_id and status = 'HELD';

  elsif new.status is distinct from old.status then
    insert into dispute_timeline (dispute_id, actor_id, event, detail)
    values (new.id, coalesce(new.resolved_by, new.assigned_to), new.status::text,
            new.resolution_note);
  end if;

  return null;
end;
$$;

create trigger disputes_timeline
  after insert or update of status on disputes
  for each row execute function app.record_dispute_event();

-- ── fraud signals ──────────────────────────────────────────────────────────

create table fraud_signals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  signal      text not null,
  severity    smallint not null default 10 check (severity between 1 and 100),
  detail      jsonb not null default '{}'::jsonb,
  entity_type text,
  entity_id   uuid,
  -- Signals decay: a burst of activity 6 months ago should not follow a user
  -- forever. The scoring function only counts signals inside this window.
  expires_at  timestamptz not null default now() + interval '90 days',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  dismissed   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index fraud_signals_user_idx on fraud_signals (user_id, created_at desc);
create index fraud_signals_open_idx on fraud_signals (severity desc, created_at desc)
  where not dismissed and reviewed_at is null;

-- Device / network fingerprints, used to spot multi-accounting. IPs are hashed
-- with a server-side pepper before they ever reach the database.
create table account_fingerprints (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  fingerprint  text not null,
  kind         text not null check (kind in ('device', 'ip', 'phone_prefix', 'payout_account')),
  seen_count   integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, kind, fingerprint)
);

create index account_fingerprints_lookup_idx on account_fingerprints (kind, fingerprint);

-- Recomputes a user's risk score from unexpired signals plus behavioural
-- counters. Deterministic and explainable — no black box.
create or replace function app.recompute_risk_score(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signal_score integer;
  v_shared_devices integer;
  v_cancellations integer;
  v_disputes integer;
  v_score integer;
  v_level risk_level;
begin
  select coalesce(sum(severity), 0)::integer into v_signal_score
  from fraud_signals
  where user_id = p_user_id and not dismissed and expires_at > now();

  -- Accounts sharing a device/payout fingerprint with this one.
  select count(distinct af2.user_id)::integer into v_shared_devices
  from account_fingerprints af1
  join account_fingerprints af2
    on af1.fingerprint = af2.fingerprint
   and af1.kind = af2.kind
   and af2.user_id <> af1.user_id
  where af1.user_id = p_user_id
    and af1.kind in ('device', 'payout_account');

  select cancellation_count into v_cancellations from profiles where id = p_user_id;

  select count(*)::integer into v_disputes
  from disputes
  where against_user = p_user_id and status = 'resolved'
    and resolution in ('refund_poster', 'split');

  v_score := least(100,
      v_signal_score
    + (v_shared_devices * 12)
    + (coalesce(v_cancellations, 0) * 5)
    + (v_disputes * 15)
  );

  v_level := case
    when v_score >= 75 then 'critical'::risk_level
    when v_score >= 50 then 'high'::risk_level
    when v_score >= 25 then 'medium'::risk_level
    else 'low'::risk_level
  end;

  update profiles set risk_score = v_score, risk_level = v_level where id = p_user_id;
  return v_score;
end;
$$;

create or replace function app.on_fraud_signal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is not null then
    perform app.recompute_risk_score(new.user_id);
  end if;
  return null;
end;
$$;

create trigger fraud_signals_rescore after insert on fraud_signals
  for each row execute function app.on_fraud_signal();
