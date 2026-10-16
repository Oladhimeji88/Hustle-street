-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 — Transactional RPCs.
--
-- Every function here is the ONLY supported way to perform its operation. They
-- are SECURITY DEFINER, they authorise the caller explicitly, they take row
-- locks in a consistent order (job → assignment → transaction → account) to
-- avoid deadlock, and they either complete fully or raise (PostgreSQL rolls the
-- whole function back on exception).
--
-- Application code never writes to `transactions`, `ledger_entries` or
-- `job_assignments` directly.
-- ═══════════════════════════════════════════════════════════════════════════

-- True when the caller is the service role / superuser, i.e. a trusted server
-- process (webhook handler, cron worker) rather than an end user.
create or replace function app.is_service_role()
returns boolean
language plpgsql
stable
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return true;
  end if;
  -- Direct connections used by the migration/cron scripts.
  return current_user in ('postgres', 'supabase_admin', 'service_role');
exception
  when others then
    return false;
end;
$$;

-- Requires an authenticated end user and returns their id.
create or replace function app.require_user()
returns uuid
language plpgsql
stable
as $$
declare
  v_id uuid := app.current_user_id();
begin
  if v_id is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;
  return v_id;
end;
$$;

-- Commission maths, in one place. `floor` means rounding always favours the
-- hustler by at most one kobo, never the platform.
create or replace function app.compute_commission(
  p_amount_minor bigint,
  p_rate_bps integer default null
)
returns table (fee_minor bigint, net_minor bigint, rate_bps integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rate integer := coalesce(p_rate_bps, app.setting_number('commission_rate_bps', 1000)::integer);
  v_fee bigint;
begin
  if p_amount_minor <= 0 then
    raise exception 'Amount must be positive' using errcode = 'check_violation';
  end if;

  v_fee := floor(p_amount_minor::numeric * v_rate / 10000.0)::bigint;
  return query select v_fee, p_amount_minor - v_fee, v_rate;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  JOB LIFECYCLE
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function publish_job(p_job_id uuid)
returns jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.require_user();
  v_job jobs%rowtype;
  v_open_count integer;
  v_max_open integer;
  v_notified integer := 0;
  v_area record;
begin
  select * into v_job from jobs where id = p_job_id for update;

  if not found or v_job.deleted_at is not null then
    raise exception 'Job not found' using errcode = 'no_data_found';
  end if;

  if v_job.poster_id <> v_user then
    raise exception 'You can only publish your own jobs' using errcode = 'insufficient_privilege';
  end if;

  if v_job.status <> 'DRAFT' then
    raise exception 'This job has already been published' using errcode = 'check_violation';
  end if;

  -- Anti-spam: cap simultaneous open listings per poster.
  v_max_open := app.setting_number('max_open_jobs_per_user', 15)::integer;
  select count(*) into v_open_count
  from jobs
  where poster_id = v_user
    and deleted_at is null
    and status in ('PUBLISHED', 'APPLICATIONS_OPEN', 'HIRED', 'IN_PROGRESS');

  if v_open_count >= v_max_open then
    raise exception 'You have reached the limit of % open jobs', v_max_open
      using errcode = 'check_violation';
  end if;

  -- Budget guardrails come from platform settings, not hardcoded constants.
  if v_job.budget_kind = 'fixed' and v_job.budget_min_minor <
       app.setting_number('minimum_job_budget_minor', 0)::bigint then
    raise exception 'Budget is below the platform minimum' using errcode = 'check_violation';
  end if;

  -- Label the job with its nearest known area so the card can read
  -- "Lekki Phase 1" without ever exposing the street address.
  if v_job.exact_lat is not null and v_job.area_label is null then
    select * into v_area from app.nearest_location(v_job.exact_lat, v_job.exact_lng, 'area');
    if found and v_area.distance_m < 8000 then
      update jobs set area_label = v_area.name, location_id = v_area.id where id = p_job_id;
    end if;
  end if;

  update jobs
     set status = 'PUBLISHED',
         published_at = now(),
         expires_at = now() + make_interval(days => app.setting_number('job_expiry_days', 30)::integer)
   where id = p_job_id
  returning * into v_job;

  -- Fan out "new job nearby" to matching hustlers. Capped so a single post can
  -- never generate an unbounded notification storm.
  with targets as (
    select p.id
    from profiles p
    join notification_preferences np on np.user_id = p.id
    where p.is_hustler
      and p.status = 'active'
      and p.deleted_at is null
      and p.id <> v_job.poster_id
      and np.jobs_nearby
      and not app.is_blocked_between(p.id, v_job.poster_id)
      and (
        v_job.location_kind = 'remote' and p.accepts_remote
        or (
          p.home_point is not null
          and v_job.approx_point is not null
          and st_dwithin(p.home_point, v_job.approx_point,
                         (least(np.nearby_radius_km, p.service_radius_km) * 1000)::double precision)
        )
      )
      -- Prefer hustlers who actually work in this category.
      and (
        exists (
          select 1 from user_skills us join skills s on s.id = us.skill_id
          where us.user_id = p.id and s.category_id = v_job.category_id
        )
        or not exists (select 1 from user_skills us where us.user_id = p.id)
      )
    order by p.rating_avg desc, p.jobs_completed desc
    limit 200
  )
  select count(*) into v_notified
  from targets t
  cross join lateral (
    select app.notify(
      t.id, 'job_nearby',
      'New job near you',
      v_job.title,
      '/jobs/' || v_job.id,
      'job', v_job.id, v_job.poster_id, false,
      jsonb_build_object('budget_min_minor', v_job.budget_min_minor,
                         'area', v_job.area_label)
    )
  ) n;

  update jobs set notified_count = v_notified where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

-- ── applying ───────────────────────────────────────────────────────────────

create or replace function apply_to_job(
  p_job_id uuid,
  p_proposed_price_minor bigint,
  p_message text,
  p_can_start_at timestamptz default null,
  p_estimated_minutes integer default null,
  p_skill_ids uuid[] default '{}',
  p_portfolio_item_ids uuid[] default '{}'
)
returns job_applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.require_user();
  v_today_count integer;
  v_max_per_day integer;
  v_application job_applications%rowtype;
begin
  -- Daily application cap (spam + fraud control).
  v_max_per_day := app.setting_number('max_applications_per_day', 30)::integer;
  select count(*) into v_today_count
  from job_applications
  where hustler_id = v_user and created_at > now() - interval '24 hours';

  if v_today_count >= v_max_per_day then
    insert into fraud_signals (user_id, signal, severity, detail)
    values (v_user, 'application_rate_exceeded', 15,
            jsonb_build_object('count', v_today_count));
    raise exception 'You have reached today''s application limit (%). Try again tomorrow.', v_max_per_day
      using errcode = 'check_violation';
  end if;

  -- All the correctness rules (own job, job open, blocks, invites) live in the
  -- `job_applications_guard` trigger so they hold for every write path.
  insert into job_applications (
    job_id, hustler_id, proposed_price_minor, message,
    can_start_at, estimated_minutes, skill_ids, portfolio_item_ids
  )
  values (
    p_job_id, v_user, p_proposed_price_minor, p_message,
    p_can_start_at, p_estimated_minutes,
    coalesce(p_skill_ids, '{}'), coalesce(p_portfolio_item_ids, '{}')
  )
  returning * into v_application;

  return v_application;
end;
$$;

-- ── hiring: the agreement transaction ──────────────────────────────────────

create or replace function accept_application(p_application_id uuid)
returns table (
  assignment_id uuid,
  transaction_id uuid,
  transaction_reference text,
  conversation_id uuid,
  amount_minor bigint,
  platform_fee_minor bigint,
  hustler_net_minor bigint,
  currency currency_code
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.require_user();
  v_app job_applications%rowtype;
  v_job jobs%rowtype;
  v_fee record;
  v_assignment job_assignments%rowtype;
  v_txn transactions%rowtype;
  v_conversation uuid;
  v_hustler profiles%rowtype;
begin
  -- Lock order: application → job. Consistent everywhere to avoid deadlocks.
  select * into v_app from job_applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found' using errcode = 'no_data_found';
  end if;

  select * into v_job from jobs where id = v_app.job_id for update;

  if v_job.poster_id <> v_user then
    raise exception 'Only the job poster can accept an application'
      using errcode = 'insufficient_privilege';
  end if;

  if v_job.status not in ('PUBLISHED', 'APPLICATIONS_OPEN') then
    raise exception 'This job is no longer open for hiring' using errcode = 'check_violation';
  end if;

  if v_app.status not in ('submitted', 'shortlisted') then
    raise exception 'This application can no longer be accepted' using errcode = 'check_violation';
  end if;

  select * into v_hustler from profiles where id = v_app.hustler_id;
  if v_hustler.status <> 'active' or v_hustler.deleted_at is not null then
    raise exception 'This hustler is not available' using errcode = 'check_violation';
  end if;

  -- High-value jobs require an identity-verified hustler.
  if v_app.proposed_price_minor >=
       app.setting_number('require_identity_verification_above_minor', 9223372036854775807)::bigint
     and not v_hustler.identity_verified then
    raise exception 'Jobs at this value require an identity-verified hustler'
      using errcode = 'check_violation';
  end if;

  select * into v_fee from app.compute_commission(v_app.proposed_price_minor);

  -- 1. The agreement.
  insert into job_assignments (
    job_id, application_id, hustler_id, poster_id,
    agreed_price_minor, currency, platform_fee_minor, hustler_net_minor,
    commission_rate_bps, scheduled_for, status
  )
  values (
    v_job.id, v_app.id, v_app.hustler_id, v_job.poster_id,
    v_app.proposed_price_minor, v_app.currency, v_fee.fee_minor, v_fee.net_minor,
    v_fee.rate_bps, coalesce(v_app.can_start_at, v_job.scheduled_for), 'pending_payment'
  )
  returning * into v_assignment;

  -- 2. Application outcomes.
  update job_applications
     set status = 'accepted', responded_at = now()
   where id = v_app.id;

  update job_applications
     set status = 'declined', responded_at = now(),
         decline_reason = 'Another hustler was selected'
   where job_id = v_job.id
     and id <> v_app.id
     and status in ('submitted', 'shortlisted');

  -- 3. Job moves to HIRED. Escrow funding is what unlocks IN_PROGRESS.
  update jobs set status = 'HIRED' where id = v_job.id;

  -- 4. The escrow funding transaction. Idempotency key is derived from the
  --    assignment, so a retried accept can never create a second charge.
  insert into transactions (
    kind, status, currency, amount_minor, fee_minor, net_minor,
    job_id, assignment_id, payer_id, payee_id,
    provider, idempotency_key, metadata
  )
  values (
    'escrow_funding', 'PENDING', v_assignment.currency, v_assignment.agreed_price_minor,
    v_assignment.platform_fee_minor, v_assignment.hustler_net_minor,
    v_job.id, v_assignment.id, v_job.poster_id, v_app.hustler_id,
    app.setting_text('payment_provider', 'paystack'),
    'escrow:' || v_assignment.id::text,
    jsonb_build_object('job_reference', v_job.reference, 'job_title', v_job.title)
  )
  on conflict (idempotency_key) do update
    set updated_at = now()
  returning * into v_txn;

  -- 5. The job conversation. One per job, reused if it already exists.
  select c.id into v_conversation from conversations c where c.job_id = v_job.id limit 1;

  if v_conversation is null then
    insert into conversations (kind, job_id, application_id, subject, created_by)
    values ('job', v_job.id, v_app.id, v_job.title, v_user)
    returning id into v_conversation;

    insert into conversation_members (conversation_id, user_id)
    values (v_conversation, v_job.poster_id), (v_conversation, v_app.hustler_id)
    on conflict do nothing;
  end if;

  insert into messages (conversation_id, kind, system_event, body, metadata)
  values (
    v_conversation, 'system', 'hired',
    v_hustler.display_name || ' was hired for this job.',
    jsonb_build_object('assignment_id', v_assignment.id,
                       'amount_minor', v_assignment.agreed_price_minor)
  );

  insert into audit_logs (actor_id, action, entity_type, entity_id, changes)
  values (v_user, 'application.accepted', 'job_assignment', v_assignment.id,
          jsonb_build_object('application_id', v_app.id,
                             'amount_minor', v_assignment.agreed_price_minor));

  return query select
    v_assignment.id, v_txn.id, v_txn.reference, v_conversation,
    v_assignment.agreed_price_minor, v_assignment.platform_fee_minor,
    v_assignment.hustler_net_minor, v_assignment.currency;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  MONEY
-- ═══════════════════════════════════════════════════════════════════════════

-- Called ONLY by the verified webhook handler once the provider confirms the
-- charge. Idempotent: a replayed webhook is a no-op.
create or replace function record_escrow_funding(
  p_transaction_id uuid,
  p_provider_reference text,
  p_provider_fee_minor bigint default 0,
  p_paid_amount_minor bigint default null
)
returns transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_txn transactions%rowtype;
  v_assignment job_assignments%rowtype;
  v_gateway_account uuid;
  v_escrow_account uuid;
  v_conversation uuid;
begin
  if not app.is_service_role() then
    raise exception 'record_escrow_funding is a trusted-server operation'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_txn from transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found' using errcode = 'no_data_found';
  end if;

  -- Idempotency: already applied, nothing to do.
  if v_txn.status in ('HELD', 'RELEASED', 'REFUNDED') then
    return v_txn;
  end if;

  if v_txn.kind <> 'escrow_funding' then
    raise exception 'Transaction % is not an escrow funding', v_txn.reference
      using errcode = 'check_violation';
  end if;

  -- The provider is authoritative about the amount. If it disagrees with what
  -- we asked for, refuse to apply and flag it rather than guessing.
  if p_paid_amount_minor is not null and p_paid_amount_minor <> v_txn.amount_minor then
    update transactions
       set status = 'FAILED',
           failure_reason = format('Amount mismatch: expected %s, received %s',
                                   v_txn.amount_minor, p_paid_amount_minor)
     where id = v_txn.id;

    insert into fraud_signals (user_id, signal, severity, detail, entity_type, entity_id)
    values (v_txn.payer_id, 'payment_amount_mismatch', 60,
            jsonb_build_object('expected', v_txn.amount_minor, 'received', p_paid_amount_minor),
            'transaction', v_txn.id);

    raise exception 'Payment amount mismatch on %', v_txn.reference
      using errcode = 'check_violation';
  end if;

  select * into v_assignment from job_assignments where id = v_txn.assignment_id for update;

  -- Post the double entry: money arrives at the provider (asset up), and we
  -- owe it into escrow for this assignment (liability up).
  v_gateway_account := app.ensure_ledger_account('gateway_receivable', null, null, v_txn.currency);
  v_escrow_account  := app.ensure_ledger_account('escrow', null, v_assignment.id, v_txn.currency);

  insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
  values
    (v_txn.id, v_gateway_account, 'debit',  v_txn.amount_minor, v_txn.currency,
     'Escrow funded via ' || coalesce(v_txn.provider, 'provider')),
    (v_txn.id, v_escrow_account, 'credit', v_txn.amount_minor, v_txn.currency,
     'Held for job ' || coalesce(v_txn.job_id::text, ''));

  update transactions
     set status = 'HELD',
         provider_reference = coalesce(p_provider_reference, provider_reference),
         provider_fee_minor = coalesce(p_provider_fee_minor, 0)
   where id = v_txn.id
  returning * into v_txn;

  -- The work can now start.
  update job_assignments set status = 'active', started_at = now()
   where id = v_assignment.id;
  update jobs set status = 'IN_PROGRESS' where id = v_assignment.job_id;

  select c.id into v_conversation from conversations c where c.job_id = v_assignment.job_id limit 1;
  if v_conversation is not null then
    insert into messages (conversation_id, kind, system_event, body, metadata)
    values (v_conversation, 'system', 'payment_secured',
            'Payment secured. The job can now begin.',
            jsonb_build_object('amount_minor', v_txn.amount_minor));
  end if;

  perform app.notify(v_assignment.hustler_id, 'payment_received',
    'Payment secured', 'The poster has funded this job. You can start work.',
    '/jobs/' || v_assignment.job_id, 'job', v_assignment.job_id, null, true);

  perform app.notify(v_assignment.poster_id, 'payment_received',
    'Payment secured', 'Your payment is held safely until you confirm the job is done.',
    '/jobs/' || v_assignment.job_id, 'job', v_assignment.job_id, null, true);

  insert into audit_logs (actor_kind, action, entity_type, entity_id, changes)
  values ('webhook', 'escrow.funded', 'transaction', v_txn.id,
          jsonb_build_object('amount_minor', v_txn.amount_minor,
                             'provider_reference', p_provider_reference));

  return v_txn;
end;
$$;

-- ── submission ─────────────────────────────────────────────────────────────

create or replace function submit_job_completion(
  p_assignment_id uuid,
  p_note text default null,
  p_media text[] default '{}'
)
returns job_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.require_user();
  v_assignment job_assignments%rowtype;
  v_conversation uuid;
  v_hours integer;
begin
  select * into v_assignment from job_assignments where id = p_assignment_id for update;

  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  if v_assignment.hustler_id <> v_user then
    raise exception 'Only the assigned hustler can submit this job'
      using errcode = 'insufficient_privilege';
  end if;

  if v_assignment.status <> 'active' then
    raise exception 'This job is not in progress' using errcode = 'check_violation';
  end if;

  v_hours := app.setting_number('auto_confirm_hours', 72)::integer;

  update job_assignments
     set status = 'submitted',
         submitted_at = now(),
         completion_note = p_note,
         completion_media = coalesce(p_media, '{}'),
         auto_confirm_at = now() + make_interval(hours => v_hours)
   where id = p_assignment_id
  returning * into v_assignment;

  update jobs set status = 'SUBMITTED' where id = v_assignment.job_id;

  select c.id into v_conversation from conversations c where c.job_id = v_assignment.job_id limit 1;
  if v_conversation is not null then
    insert into messages (conversation_id, kind, system_event, body, metadata)
    values (v_conversation, 'system', 'work_submitted',
            'The hustler marked this job as done. Awaiting confirmation.',
            jsonb_build_object('assignment_id', v_assignment.id));
  end if;

  perform app.notify(v_assignment.poster_id, 'job_submitted',
    'Job marked as done',
    'Confirm the work to release payment. It releases automatically in ' || v_hours || ' hours.',
    '/jobs/' || v_assignment.job_id, 'job', v_assignment.job_id, v_user, true);

  return v_assignment;
end;
$$;

-- ── release: the money moment ──────────────────────────────────────────────
--
-- `p_actor` is NULL for a poster-initiated confirmation and set by the cron
-- worker for an auto-confirmation. Either way the ledger posting is identical.

create or replace function confirm_job_completion(
  p_assignment_id uuid,
  p_system_auto boolean default false
)
returns table (
  assignment_id uuid,
  release_transaction_id uuid,
  hustler_net_minor bigint,
  platform_fee_minor bigint,
  currency currency_code
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_assignment job_assignments%rowtype;
  v_escrow_txn transactions%rowtype;
  v_release transactions%rowtype;
  v_escrow_account uuid;
  v_pending_account uuid;
  v_revenue_account uuid;
  v_conversation uuid;
begin
  if p_system_auto then
    if not app.is_service_role() then
      raise exception 'Automatic confirmation is a trusted-server operation'
        using errcode = 'insufficient_privilege';
    end if;
    v_user := null;
  else
    v_user := app.require_user();
  end if;

  select * into v_assignment from job_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  if not p_system_auto and v_assignment.poster_id <> v_user then
    raise exception 'Only the job poster can confirm completion'
      using errcode = 'insufficient_privilege';
  end if;

  -- Idempotency: confirming an already-completed job is a no-op, not an error.
  if v_assignment.status = 'completed' then
    select * into v_release from transactions
     where assignment_id = v_assignment.id and kind = 'escrow_release'
     limit 1;
    return query select v_assignment.id, v_release.id, v_assignment.hustler_net_minor,
                        v_assignment.platform_fee_minor, v_assignment.currency;
    return;
  end if;

  if v_assignment.status <> 'submitted' then
    raise exception 'This job has not been submitted for confirmation'
      using errcode = 'check_violation';
  end if;

  -- The funded escrow must exist and still be held.
  select * into v_escrow_txn
  from transactions
  where assignment_id = v_assignment.id and kind = 'escrow_funding' and status = 'HELD'
  for update;

  if not found then
    raise exception 'No held payment found for this job' using errcode = 'check_violation';
  end if;

  -- Create the release transaction. The idempotency key makes a double-release
  -- structurally impossible: the second attempt hits the unique index.
  insert into transactions (
    kind, status, currency, amount_minor, fee_minor, net_minor,
    job_id, assignment_id, payer_id, payee_id, provider, idempotency_key, metadata
  )
  values (
    'escrow_release', 'PENDING', v_assignment.currency, v_assignment.agreed_price_minor,
    v_assignment.platform_fee_minor, v_assignment.hustler_net_minor,
    v_assignment.job_id, v_assignment.id, v_assignment.poster_id, v_assignment.hustler_id,
    v_escrow_txn.provider, 'release:' || v_assignment.id::text,
    jsonb_build_object('auto', p_system_auto, 'escrow_transaction', v_escrow_txn.id)
  )
  returning * into v_release;

  -- Post the release: escrow liability down, hustler's pending balance up,
  -- platform revenue up. Balances to zero by construction.
  v_escrow_account  := app.ensure_ledger_account('escrow', null, v_assignment.id, v_assignment.currency);
  v_pending_account := app.ensure_ledger_account('user_pending', v_assignment.hustler_id, null, v_assignment.currency);
  v_revenue_account := app.ensure_ledger_account('platform_revenue', null, null, v_assignment.currency);

  insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
  values
    (v_release.id, v_escrow_account, 'debit', v_assignment.agreed_price_minor,
     v_assignment.currency, 'Escrow released'),
    (v_release.id, v_pending_account, 'credit', v_assignment.hustler_net_minor,
     v_assignment.currency, 'Job earnings'),
    (v_release.id, v_revenue_account, 'credit', v_assignment.platform_fee_minor,
     v_assignment.currency, 'Platform commission');

  update transactions set status = 'RELEASED' where id = v_release.id returning * into v_release;
  update transactions set status = 'RELEASED' where id = v_escrow_txn.id;

  update job_assignments
     set status = 'completed', confirmed_at = now()
   where id = v_assignment.id;

  update jobs set status = 'COMPLETED' where id = v_assignment.job_id;

  select c.id into v_conversation from conversations c where c.job_id = v_assignment.job_id limit 1;
  if v_conversation is not null then
    insert into messages (conversation_id, kind, system_event, body, metadata)
    values (v_conversation, 'system', 'payment_released',
            'Job completed. Payment released to the hustler.',
            jsonb_build_object('net_minor', v_assignment.hustler_net_minor));
  end if;

  perform app.notify(v_assignment.hustler_id, 'payment_released',
    'You have been paid',
    'Your earnings from this job have been released.',
    '/wallet', 'assignment', v_assignment.id, null, true);

  perform app.notify(v_assignment.hustler_id, 'review_request',
    'How was the poster?', 'Leave a review to help the community.',
    '/jobs/' || v_assignment.job_id || '/review', 'assignment', v_assignment.id);

  perform app.notify(v_assignment.poster_id, 'review_request',
    'How did it go?', 'Leave a review for your hustler.',
    '/jobs/' || v_assignment.job_id || '/review', 'assignment', v_assignment.id);

  insert into audit_logs (actor_id, actor_kind, action, entity_type, entity_id, changes)
  values (v_user, case when p_system_auto then 'system' else 'user' end,
          'escrow.released', 'transaction', v_release.id,
          jsonb_build_object('net_minor', v_assignment.hustler_net_minor,
                             'fee_minor', v_assignment.platform_fee_minor));

  return query select v_assignment.id, v_release.id, v_assignment.hustler_net_minor,
                      v_assignment.platform_fee_minor, v_assignment.currency;
end;
$$;

-- ── refund ─────────────────────────────────────────────────────────────────

-- Internal refund posting. Deliberately has NO authorization check: it is
-- private to the `app` schema and every caller (the admin-facing
-- `refund_escrow`, `cancel_job`, `resolve_dispute`) authorises first. Splitting
-- it this way avoids the trap of a user-facing function trying to escalate its
-- own privileges to reach a refund.
create or replace function app.post_escrow_refund(
  p_assignment_id uuid,
  p_amount_minor bigint default null,
  p_reason text default null
)
returns transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment job_assignments%rowtype;
  v_escrow_txn transactions%rowtype;
  v_refund transactions%rowtype;
  v_amount bigint;
  v_escrow_account uuid;
  v_gateway_account uuid;
begin
  select * into v_assignment from job_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  select * into v_escrow_txn
  from transactions
  where assignment_id = p_assignment_id and kind = 'escrow_funding'
    and status in ('HELD', 'DISPUTED')
  for update;

  if not found then
    raise exception 'No refundable payment found' using errcode = 'check_violation';
  end if;

  v_amount := coalesce(p_amount_minor, v_escrow_txn.amount_minor);

  if v_amount <= 0 or v_amount > v_escrow_txn.amount_minor then
    raise exception 'Refund amount must be between 1 and %', v_escrow_txn.amount_minor
      using errcode = 'check_violation';
  end if;

  insert into transactions (
    kind, status, currency, amount_minor,
    job_id, assignment_id, payer_id, payee_id, provider, idempotency_key, metadata
  )
  values (
    'refund', 'PENDING', v_escrow_txn.currency, v_amount,
    v_assignment.job_id, v_assignment.id, v_assignment.hustler_id, v_assignment.poster_id,
    v_escrow_txn.provider, 'refund:' || v_assignment.id::text || ':' || v_amount::text,
    jsonb_build_object('reason', p_reason, 'escrow_transaction', v_escrow_txn.id)
  )
  returning * into v_refund;

  -- Escrow liability down, provider-held asset down (money goes back to payer).
  v_escrow_account  := app.ensure_ledger_account('escrow', null, v_assignment.id, v_escrow_txn.currency);
  v_gateway_account := app.ensure_ledger_account('gateway_receivable', null, null, v_escrow_txn.currency);

  insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
  values
    (v_refund.id, v_escrow_account, 'debit', v_amount, v_escrow_txn.currency, 'Refund to poster'),
    (v_refund.id, v_gateway_account, 'credit', v_amount, v_escrow_txn.currency, 'Refund settled by provider');

  update transactions set status = 'REFUNDED' where id = v_refund.id returning * into v_refund;

  -- Fully refunded escrow closes out; a partial refund leaves the rest held.
  if v_amount = v_escrow_txn.amount_minor then
    update transactions set status = 'REFUNDED' where id = v_escrow_txn.id;
  end if;

  perform app.notify(v_assignment.poster_id, 'payment_released',
    'Refund issued', 'Your payment for this job is being refunded.',
    '/wallet', 'assignment', v_assignment.id, null, true);

  insert into audit_logs (actor_id, actor_kind, action, entity_type, entity_id, changes)
  values (app.current_user_id(),
          case when app.current_user_id() is null then 'system' else 'admin' end,
          'escrow.refunded', 'transaction', v_refund.id,
          jsonb_build_object('amount_minor', v_amount, 'reason', p_reason));

  return v_refund;
end;
$$;

-- Public, admin-gated entry point for a manual refund.
create or replace function refund_escrow(
  p_assignment_id uuid,
  p_amount_minor bigint default null,
  p_reason text default null
)
returns transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (app.is_service_role() or app.has_role('admin')) then
    raise exception 'Refunds require administrator privileges'
      using errcode = 'insufficient_privilege';
  end if;

  return app.post_escrow_refund(p_assignment_id, p_amount_minor, p_reason);
end;
$$;

-- ── cancellation ───────────────────────────────────────────────────────────

create or replace function cancel_job(p_job_id uuid, p_reason text)
returns jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.require_user();
  v_job jobs%rowtype;
  v_assignment job_assignments%rowtype;
begin
  select * into v_job from jobs where id = p_job_id for update;

  if not found or v_job.deleted_at is not null then
    raise exception 'Job not found' using errcode = 'no_data_found';
  end if;

  if v_job.poster_id <> v_user and not app.has_role('admin') then
    raise exception 'Only the job poster can cancel this job'
      using errcode = 'insufficient_privilege';
  end if;

  if v_job.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'This job is already closed' using errcode = 'check_violation';
  end if;

  if v_job.status = 'DISPUTED' then
    raise exception 'A disputed job can only be closed by resolving the dispute'
      using errcode = 'check_violation';
  end if;

  -- Once work has been submitted, cancelling unilaterally would let a poster
  -- take delivered work for free. The only route from here is confirmation or
  -- a dispute.
  if v_job.status = 'SUBMITTED' then
    raise exception 'This job has been submitted for confirmation. Confirm it, or open a dispute if something is wrong.'
      using errcode = 'check_violation';
  end if;

  select * into v_assignment
  from job_assignments
  where job_id = p_job_id and status in ('pending_payment', 'active')
  for update;

  if found then
    -- Money already held? Refund it before closing anything. The caller was
    -- authorised above, so we go straight to the internal posting function.
    if exists (select 1 from transactions
               where assignment_id = v_assignment.id
                 and kind = 'escrow_funding' and status = 'HELD') then
      perform app.post_escrow_refund(v_assignment.id, null, coalesce(p_reason, 'Job cancelled'));
    end if;

    update job_assignments
       set status = 'cancelled', cancelled_at = now(),
           cancelled_by = v_user, cancellation_reason = p_reason
     where id = v_assignment.id;

    perform app.notify(v_assignment.hustler_id, 'system',
      'Job cancelled', coalesce(p_reason, 'The poster cancelled this job.'),
      '/jobs/' || p_job_id, 'job', p_job_id, v_user, true);
  end if;

  update job_applications
     set status = 'declined', decline_reason = 'Job cancelled', responded_at = now()
   where job_id = p_job_id and status in ('submitted', 'shortlisted');

  update jobs
     set status = 'CANCELLED', cancellation_reason = p_reason
   where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  PAYOUTS
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function request_payout(
  p_amount_minor bigint,
  p_payout_account_id uuid
)
returns payouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.require_user();
  v_account payout_accounts%rowtype;
  v_available bigint;
  v_min bigint;
  v_fee bigint;
  v_payout payouts%rowtype;
  v_txn transactions%rowtype;
  v_avail_account uuid;
  v_clearing_account uuid;
  v_revenue_account uuid;
begin
  if not app.setting_bool('payouts_enabled', true) then
    raise exception 'Withdrawals are temporarily unavailable' using errcode = 'check_violation';
  end if;

  select * into v_account from payout_accounts
   where id = p_payout_account_id and user_id = v_user;

  if not found then
    raise exception 'Payout account not found' using errcode = 'no_data_found';
  end if;

  if not v_account.is_verified then
    raise exception 'This payout account is not verified yet' using errcode = 'check_violation';
  end if;

  -- A restricted or high-risk account cannot withdraw until reviewed.
  if exists (select 1 from profiles
             where id = v_user
               and (status <> 'active'
                    or risk_score >= app.setting_number('high_risk_score_threshold', 50)::integer)) then
    raise exception 'Withdrawals are on hold for this account. Contact support.'
      using errcode = 'insufficient_privilege';
  end if;

  v_min := app.setting_number('minimum_payout_minor', 0)::bigint;
  v_fee := app.setting_number('payout_fee_minor', 0)::bigint;

  if p_amount_minor < v_min then
    raise exception 'Minimum withdrawal is % (minor units)', v_min using errcode = 'check_violation';
  end if;

  if p_amount_minor <= v_fee then
    raise exception 'Withdrawal must exceed the % fee', v_fee using errcode = 'check_violation';
  end if;

  -- Lock the balance row before reading it: this is what prevents two
  -- concurrent withdrawal requests from both passing the balance check.
  v_avail_account := app.ensure_ledger_account('user_available', v_user, null, v_account.currency);
  select balance_minor into v_available from ledger_accounts where id = v_avail_account for update;

  if v_available < p_amount_minor then
    raise exception 'Insufficient balance' using errcode = 'check_violation';
  end if;

  insert into payouts (user_id, payout_account_id, amount_minor, fee_minor, currency, status)
  values (v_user, p_payout_account_id, p_amount_minor, v_fee, v_account.currency, 'requested')
  returning * into v_payout;

  insert into transactions (
    kind, status, currency, amount_minor, fee_minor, net_minor,
    payer_id, payee_id, provider, idempotency_key, metadata
  )
  values (
    'payout', 'PENDING', v_account.currency, p_amount_minor, v_fee, p_amount_minor - v_fee,
    v_user, v_user, v_account.provider, 'payout:' || v_payout.id::text,
    jsonb_build_object('payout_id', v_payout.id, 'bank', v_account.bank_name)
  )
  returning * into v_txn;

  update payouts set transaction_id = v_txn.id where id = v_payout.id returning * into v_payout;

  -- Move the money out of the available balance immediately so it cannot be
  -- spent twice while the transfer is in flight.
  v_clearing_account := app.ensure_ledger_account('payout_clearing', v_user, null, v_account.currency);
  v_revenue_account  := app.ensure_ledger_account('platform_revenue', null, null, v_account.currency);

  insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
  values
    (v_txn.id, v_avail_account, 'debit', p_amount_minor, v_account.currency, 'Withdrawal requested');

  insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
  values
    (v_txn.id, v_clearing_account, 'credit', p_amount_minor - v_fee, v_account.currency, 'Withdrawal in transit');

  if v_fee > 0 then
    insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
    values (v_txn.id, v_revenue_account, 'credit', v_fee, v_account.currency, 'Withdrawal fee');
  end if;

  update transactions set status = 'AUTHORIZED' where id = v_txn.id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, changes)
  values (v_user, 'payout.requested', 'payout', v_payout.id,
          jsonb_build_object('amount_minor', p_amount_minor, 'fee_minor', v_fee));

  return v_payout;
end;
$$;

create or replace function settle_payout(
  p_payout_id uuid,
  p_success boolean,
  p_provider_reference text default null,
  p_failure_reason text default null
)
returns payouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout payouts%rowtype;
  v_txn transactions%rowtype;
  v_clearing uuid;
  v_gateway uuid;
  v_avail uuid;
  v_revenue uuid;
  v_reversal transactions%rowtype;
begin
  if not app.is_service_role() then
    raise exception 'settle_payout is a trusted-server operation'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_payout from payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found' using errcode = 'no_data_found';
  end if;

  if v_payout.status in ('paid', 'reversed') then
    return v_payout;   -- idempotent
  end if;

  select * into v_txn from transactions where id = v_payout.transaction_id for update;

  v_clearing := app.ensure_ledger_account('payout_clearing', v_payout.user_id, null, v_payout.currency);
  v_gateway  := app.ensure_ledger_account('gateway_receivable', null, null, v_payout.currency);
  v_avail    := app.ensure_ledger_account('user_available', v_payout.user_id, null, v_payout.currency);
  v_revenue  := app.ensure_ledger_account('platform_revenue', null, null, v_payout.currency);

  if p_success then
    -- Money has left the provider: clearing liability down, asset down.
    insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
    values
      (v_txn.id, v_clearing, 'debit', v_payout.amount_minor - v_payout.fee_minor,
       v_payout.currency, 'Withdrawal settled'),
      (v_txn.id, v_gateway, 'credit', v_payout.amount_minor - v_payout.fee_minor,
       v_payout.currency, 'Transferred to bank');

    update transactions set status = 'RELEASED' where id = v_txn.id;
    update payouts
       set status = 'paid', provider_reference = p_provider_reference,
           processed_at = coalesce(processed_at, now()), completed_at = now()
     where id = p_payout_id
    returning * into v_payout;

    perform app.notify(v_payout.user_id, 'payout_processed',
      'Withdrawal sent', 'Your money is on its way to your bank account.',
      '/wallet', 'payout', v_payout.id, null, true);
  else
    -- Reverse the hold: put the full amount back into the available balance.
    insert into transactions (
      kind, status, currency, amount_minor, payer_id, payee_id,
      provider, idempotency_key, metadata
    )
    values (
      'payout_reversal', 'PENDING', v_payout.currency, v_payout.amount_minor,
      v_payout.user_id, v_payout.user_id, v_payout.provider,
      'payout_reversal:' || v_payout.id::text,
      jsonb_build_object('payout_id', v_payout.id, 'reason', p_failure_reason)
    )
    returning * into v_reversal;

    insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
    values
      (v_reversal.id, v_clearing, 'debit', v_payout.amount_minor - v_payout.fee_minor,
       v_payout.currency, 'Withdrawal reversed');

    if v_payout.fee_minor > 0 then
      insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
      values (v_reversal.id, v_revenue, 'debit', v_payout.fee_minor,
              v_payout.currency, 'Withdrawal fee refunded');
    end if;

    insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
    values (v_reversal.id, v_avail, 'credit', v_payout.amount_minor,
            v_payout.currency, 'Withdrawal returned');

    update transactions set status = 'RELEASED' where id = v_reversal.id;
    update transactions set status = 'FAILED', failure_reason = p_failure_reason where id = v_txn.id;

    update payouts
       set status = 'failed', failure_reason = p_failure_reason, completed_at = now()
     where id = p_payout_id
    returning * into v_payout;

    perform app.notify(v_payout.user_id, 'payout_processed',
      'Withdrawal failed',
      coalesce(p_failure_reason, 'We could not complete your withdrawal. The money is back in your wallet.'),
      '/wallet', 'payout', v_payout.id, null, true);
  end if;

  insert into audit_logs (actor_kind, action, entity_type, entity_id, changes)
  values ('webhook', case when p_success then 'payout.paid' else 'payout.failed' end,
          'payout', v_payout.id,
          jsonb_build_object('provider_reference', p_provider_reference,
                             'reason', p_failure_reason));

  return v_payout;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  DISPUTES
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function open_dispute(
  p_assignment_id uuid,
  p_reason dispute_reason,
  p_description text
)
returns disputes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.require_user();
  v_assignment job_assignments%rowtype;
  v_against uuid;
  v_dispute disputes%rowtype;
  v_txn uuid;
begin
  select * into v_assignment from job_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'Assignment not found' using errcode = 'no_data_found';
  end if;

  if v_user not in (v_assignment.poster_id, v_assignment.hustler_id) then
    raise exception 'Only the parties to this job can open a dispute'
      using errcode = 'insufficient_privilege';
  end if;

  if v_assignment.status not in ('active', 'submitted', 'completed') then
    raise exception 'This job cannot be disputed at its current stage'
      using errcode = 'check_violation';
  end if;

  -- A completed job can only be disputed inside the review window.
  if v_assignment.status = 'completed'
     and v_assignment.confirmed_at < now() - interval '7 days' then
    raise exception 'The dispute window for this job has closed'
      using errcode = 'check_violation';
  end if;

  v_against := case when v_user = v_assignment.poster_id
                    then v_assignment.hustler_id else v_assignment.poster_id end;

  select id into v_txn from transactions
   where assignment_id = p_assignment_id and kind = 'escrow_funding' limit 1;

  insert into disputes (
    job_id, assignment_id, transaction_id, raised_by, against_user,
    reason, description, amount_minor, currency
  )
  values (
    v_assignment.job_id, p_assignment_id, v_txn, v_user, v_against,
    p_reason, p_description, v_assignment.agreed_price_minor, v_assignment.currency
  )
  returning * into v_dispute;

  perform app.notify(v_against, 'dispute_update',
    'A dispute was opened', 'Please respond with your side and any evidence.',
    '/disputes/' || v_dispute.id, 'dispute', v_dispute.id, v_user, true);

  return v_dispute;
end;
$$;

create or replace function resolve_dispute(
  p_dispute_id uuid,
  p_resolution dispute_resolution,
  p_refund_to_poster_minor bigint default 0,
  p_release_to_hustler_minor bigint default 0,
  p_note text default null
)
returns disputes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := app.require_user();
  v_dispute disputes%rowtype;
  v_assignment job_assignments%rowtype;
  v_escrow_txn transactions%rowtype;
  v_release transactions%rowtype;
  v_fee record;
  v_escrow_account uuid;
  v_pending_account uuid;
  v_revenue_account uuid;
begin
  -- Only authorised admins may resolve disputes.
  if not app.has_role('admin') then
    raise exception 'Only administrators can resolve disputes'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_dispute from disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'Dispute not found' using errcode = 'no_data_found';
  end if;

  if v_dispute.status = 'resolved' then
    return v_dispute;   -- idempotent
  end if;

  select * into v_assignment from job_assignments where id = v_dispute.assignment_id for update;

  select * into v_escrow_txn from transactions
   where assignment_id = v_dispute.assignment_id and kind = 'escrow_funding'
     and status in ('HELD', 'DISPUTED')
  for update;

  if p_refund_to_poster_minor + p_release_to_hustler_minor > v_dispute.amount_minor then
    raise exception 'Split exceeds the disputed amount' using errcode = 'check_violation';
  end if;

  -- Apply the money movements the verdict implies.
  if found and v_escrow_txn.id is not null then
    if p_release_to_hustler_minor > 0 then
      select * into v_fee from app.compute_commission(
        p_release_to_hustler_minor, v_assignment.commission_rate_bps
      );

      insert into transactions (
        kind, status, currency, amount_minor, fee_minor, net_minor,
        job_id, assignment_id, payer_id, payee_id, provider, idempotency_key, metadata
      )
      values (
        'escrow_release', 'PENDING', v_dispute.currency, p_release_to_hustler_minor,
        v_fee.fee_minor, v_fee.net_minor,
        v_dispute.job_id, v_dispute.assignment_id, v_assignment.poster_id, v_assignment.hustler_id,
        v_escrow_txn.provider, 'dispute_release:' || v_dispute.id::text,
        jsonb_build_object('dispute_id', v_dispute.id, 'resolution', p_resolution)
      )
      returning * into v_release;

      v_escrow_account  := app.ensure_ledger_account('escrow', null, v_assignment.id, v_dispute.currency);
      v_pending_account := app.ensure_ledger_account('user_pending', v_assignment.hustler_id, null, v_dispute.currency);
      v_revenue_account := app.ensure_ledger_account('platform_revenue', null, null, v_dispute.currency);

      insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
      values
        (v_release.id, v_escrow_account, 'debit', p_release_to_hustler_minor,
         v_dispute.currency, 'Dispute resolution: released'),
        (v_release.id, v_pending_account, 'credit', v_fee.net_minor,
         v_dispute.currency, 'Dispute resolution: earnings'),
        (v_release.id, v_revenue_account, 'credit', v_fee.fee_minor,
         v_dispute.currency, 'Dispute resolution: commission');

      update transactions set status = 'RELEASED' where id = v_release.id;
    end if;

    if p_refund_to_poster_minor > 0 then
      perform app.post_escrow_refund(v_dispute.assignment_id, p_refund_to_poster_minor,
                                     'Dispute resolution: ' || p_resolution::text);
    end if;

    if p_release_to_hustler_minor > 0 and p_refund_to_poster_minor = 0 then
      update transactions set status = 'RELEASED' where id = v_escrow_txn.id;
    end if;
  end if;

  update disputes
     set status = 'resolved',
         resolution = p_resolution,
         resolution_note = p_note,
         refund_to_poster_minor = p_refund_to_poster_minor,
         release_to_hustler_minor = p_release_to_hustler_minor,
         resolved_by = v_admin,
         resolved_at = now()
   where id = p_dispute_id
  returning * into v_dispute;

  -- Close out the job in the direction the verdict implies.
  update job_assignments
     set status = case when p_release_to_hustler_minor > 0 then 'completed' else 'cancelled' end,
         confirmed_at = case when p_release_to_hustler_minor > 0 then now() else confirmed_at end,
         cancelled_at = case when p_release_to_hustler_minor = 0 then now() else cancelled_at end
   where id = v_dispute.assignment_id;

  update jobs
     set status = case when p_release_to_hustler_minor > 0 then 'COMPLETED'::job_status
                       else 'CANCELLED'::job_status end
   where id = v_dispute.job_id;

  update conversations set is_locked = true, locked_reason = 'Dispute resolved'
   where job_id = v_dispute.job_id;

  perform app.notify(v_dispute.raised_by, 'dispute_update',
    'Dispute resolved', coalesce(p_note, 'A decision has been made on your dispute.'),
    '/disputes/' || v_dispute.id, 'dispute', v_dispute.id, v_admin, true);

  perform app.notify(v_dispute.against_user, 'dispute_update',
    'Dispute resolved', coalesce(p_note, 'A decision has been made on this dispute.'),
    '/disputes/' || v_dispute.id, 'dispute', v_dispute.id, v_admin, true);

  insert into admin_actions (admin_id, action, target_kind, target_id, reason, after_state)
  values (v_admin, 'dispute.resolved', 'dispute', p_dispute_id, p_note,
          jsonb_build_object('resolution', p_resolution,
                             'refund_minor', p_refund_to_poster_minor,
                             'release_minor', p_release_to_hustler_minor));

  return v_dispute;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  SCHEDULED MAINTENANCE (invoked by the cron worker)
-- ═══════════════════════════════════════════════════════════════════════════

-- Moves cleared earnings from the pending balance into the withdrawable one.
create or replace function mature_pending_earnings()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hold_hours integer := app.setting_number('payout_hold_hours', 24)::integer;
  v_count integer := 0;
  rec record;
  v_txn_id uuid;
  v_pending uuid;
  v_available uuid;
begin
  if not app.is_service_role() then
    raise exception 'Trusted-server operation' using errcode = 'insufficient_privilege';
  end if;

  for rec in
    select ja.id as assignment_id, ja.hustler_id, ja.hustler_net_minor, ja.currency
    from job_assignments ja
    join transactions t on t.assignment_id = ja.id and t.kind = 'escrow_release'
    where ja.status = 'completed'
      and t.status = 'RELEASED'
      and t.released_at <= now() - make_interval(hours => v_hold_hours)
      and not exists (
        select 1 from transactions m
        where m.assignment_id = ja.id and m.kind = 'adjustment'
          and m.idempotency_key = 'mature:' || ja.id::text
      )
    limit 500
  loop
    insert into transactions (
      kind, status, currency, amount_minor, payee_id, idempotency_key, assignment_id, metadata
    )
    values (
      'adjustment', 'PENDING', rec.currency, rec.hustler_net_minor, rec.hustler_id,
      'mature:' || rec.assignment_id::text, rec.assignment_id,
      jsonb_build_object('reason', 'pending_to_available')
    )
    on conflict (idempotency_key) do nothing
    returning id into v_txn_id;

    -- Already matured on an earlier run: skip without touching the ledger.
    continue when v_txn_id is null;

    v_pending   := app.ensure_ledger_account('user_pending', rec.hustler_id, null, rec.currency);
    v_available := app.ensure_ledger_account('user_available', rec.hustler_id, null, rec.currency);

    insert into ledger_entries (transaction_id, account_id, direction, amount_minor, currency, narration)
    values
      (v_txn_id, v_pending, 'debit', rec.hustler_net_minor, rec.currency, 'Earnings cleared'),
      (v_txn_id, v_available, 'credit', rec.hustler_net_minor, rec.currency, 'Available to withdraw');

    update transactions set status = 'RELEASED' where id = v_txn_id;
    v_count := v_count + 1;
    v_txn_id := null;
  end loop;

  return v_count;
end;
$$;

-- Releases escrow for jobs the poster never confirmed.
create or replace function auto_confirm_due_assignments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  rec record;
begin
  if not app.is_service_role() then
    raise exception 'Trusted-server operation' using errcode = 'insufficient_privilege';
  end if;

  for rec in
    select id from job_assignments
    where status = 'submitted'
      and auto_confirm_at is not null
      and auto_confirm_at <= now()
      -- Never auto-release a job that is under dispute.
      and not exists (
        select 1 from disputes d
        where d.assignment_id = job_assignments.id
          and d.status in ('open', 'under_review', 'awaiting_evidence')
      )
    limit 200
  loop
    begin
      perform confirm_job_completion(rec.id, true);
      v_count := v_count + 1;
    exception when others then
      insert into audit_logs (actor_kind, action, entity_type, entity_id, changes)
      values ('system', 'assignment.auto_confirm_failed', 'job_assignment', rec.id,
              jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  return v_count;
end;
$$;

create or replace function expire_stale_jobs()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not app.is_service_role() then
    raise exception 'Trusted-server operation' using errcode = 'insufficient_privilege';
  end if;

  -- One statement so the application sweep only touches the jobs this run
  -- actually expired, rather than every historically expired job.
  with expired as (
    update jobs
       set status = 'EXPIRED'
     where deleted_at is null
       and status in ('PUBLISHED', 'APPLICATIONS_OPEN')
       and expires_at is not null
       and expires_at <= now()
    returning id
  ),
  closed_applications as (
    update job_applications
       set status = 'expired'
     where status in ('submitted', 'shortlisted')
       and job_id in (select id from expired)
    returning 1
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

-- Publishes reviews whose double-blind window has closed.
create or replace function publish_due_reviews()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer := app.setting_number('review_publish_window_days', 14)::integer;
  v_count integer;
begin
  if not app.is_service_role() then
    raise exception 'Trusted-server operation' using errcode = 'insufficient_privilege';
  end if;

  with due as (
    update reviews
       set is_published = true, published_at = now()
     where not is_published
       and created_at <= now() - make_interval(days => v_days)
    returning id
  )
  select count(*) into v_count from due;

  return v_count;
end;
$$;

-- Verifies that every cached balance still equals the sum of its entries.
-- Returns only the accounts that disagree — an empty result is a clean bill.
create or replace function reconcile_ledger()
returns table (account_id uuid, cached_minor bigint, computed_minor bigint, drift_minor bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    la.id,
    la.balance_minor,
    coalesce(sum(
      case when le.direction = app.account_normal_direction(la.kind)
           then le.amount_minor else -le.amount_minor end
    ), 0) as computed,
    la.balance_minor - coalesce(sum(
      case when le.direction = app.account_normal_direction(la.kind)
           then le.amount_minor else -le.amount_minor end
    ), 0) as drift
  from ledger_accounts la
  left join ledger_entries le on le.account_id = la.id
  group by la.id, la.balance_minor, la.kind
  having la.balance_minor <> coalesce(sum(
    case when le.direction = app.account_normal_direction(la.kind)
         then le.amount_minor else -le.amount_minor end
  ), 0)
$$;
