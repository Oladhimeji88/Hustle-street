-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 — Notifications: in-app feed, per-channel preferences, push
--        subscriptions and the outbound delivery queue.
--
-- Design: writing a row into `notifications` is the only thing product code
-- does. A trigger expands that row into `notification_deliveries` for every
-- channel the user has enabled, and a background worker drains that queue.
-- This keeps notification *intent* separate from *delivery*, so a failing SMS
-- provider can never break a job flow.
-- ═══════════════════════════════════════════════════════════════════════════

create table notification_preferences (
  user_id      uuid primary key references profiles(id) on delete cascade,

  -- Per-channel master switches
  in_app_enabled boolean not null default true,
  push_enabled   boolean not null default true,
  email_enabled  boolean not null default true,
  sms_enabled    boolean not null default false,

  -- Per-topic switches
  jobs_nearby       boolean not null default true,
  application_updates boolean not null default true,
  messages          boolean not null default true,
  payments          boolean not null default true,
  reviews           boolean not null default true,
  marketing         boolean not null default false,

  -- Quiet hours, in the user's local timezone. Non-critical notifications are
  -- deferred; security alerts and payment events always go out.
  quiet_hours_start smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end   smallint check (quiet_hours_end between 0 and 23),

  -- Radius for "new job nearby" alerts.
  nearby_radius_km  integer not null default 10 check (nearby_radius_km between 1 and 100),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger notification_preferences_touch before update on notification_preferences
  for each row execute function app.touch_updated_at();

-- ── in-app feed ────────────────────────────────────────────────────────────

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        notification_kind not null,
  title       text not null,
  body        text,
  -- Deep link into the PWA, e.g. /jobs/<id>/applications
  action_url  text,
  image_url   text,

  -- Loose references so a notification can point at whatever it is about
  -- without a forest of nullable foreign keys.
  entity_type text,
  entity_id   uuid,
  actor_id    uuid references profiles(id) on delete set null,

  metadata    jsonb not null default '{}'::jsonb,
  -- Critical notifications ignore quiet hours and preference switches
  -- (security alerts, payment released, dispute opened).
  is_critical boolean not null default false,

  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_feed_idx
  on notifications (user_id, created_at desc);
create index notifications_unread_idx
  on notifications (user_id) where read_at is null;
create index notifications_entity_idx on notifications (entity_type, entity_id);

-- ── push subscriptions (Web Push / VAPID) ──────────────────────────────────

create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  -- Set when the push service returns 404/410; the worker stops targeting it.
  failed_at   timestamptz,
  failure_count integer not null default 0,
  last_used_at timestamptz,
  created_at  timestamptz not null default now(),

  unique (endpoint)
);

create index push_subscriptions_user_idx on push_subscriptions (user_id)
  where failed_at is null;

-- ── delivery queue ─────────────────────────────────────────────────────────

create table notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  channel         notification_channel not null,
  status          text not null default 'queued'
                    check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts        integer not null default 0,
  scheduled_for   timestamptz not null default now(),
  sent_at         timestamptz,
  failed_reason   text,
  provider_ref    text,
  created_at      timestamptz not null default now(),

  unique (notification_id, channel)
);

-- The worker's claim query: oldest queued item that is due.
create index notification_deliveries_queue_idx
  on notification_deliveries (status, scheduled_for)
  where status in ('queued', 'sending');

-- Expands one notification into per-channel delivery rows, honouring the
-- user's preferences and quiet hours.
create or replace function app.fanout_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prefs notification_preferences%rowtype;
  v_tz text;
  v_local_hour smallint;
  v_in_quiet boolean := false;
  v_delay timestamptz := now();
  v_topic_enabled boolean := true;
begin
  select * into prefs from notification_preferences where user_id = new.user_id;

  -- No preference row yet: fall back to sensible defaults (in-app + push).
  if not found then
    insert into notification_preferences (user_id) values (new.user_id)
    on conflict (user_id) do nothing;
    select * into prefs from notification_preferences where user_id = new.user_id;
  end if;

  -- Topic-level opt-out.
  v_topic_enabled := case
    when new.kind = 'job_nearby' then prefs.jobs_nearby
    when new.kind in ('application_received', 'application_accepted', 'application_declined')
      then prefs.application_updates
    when new.kind = 'message_received' then prefs.messages
    when new.kind in ('payment_received', 'payment_released', 'payout_processed')
      then prefs.payments
    when new.kind in ('review_request', 'review_received') then prefs.reviews
    else true
  end;

  if not v_topic_enabled and not new.is_critical then
    return null;
  end if;

  -- Quiet hours (skipped for critical notifications).
  if prefs.quiet_hours_start is not null and prefs.quiet_hours_end is not null
     and not new.is_critical then
    select timezone into v_tz from profiles where id = new.user_id;
    v_local_hour := extract(hour from (now() at time zone coalesce(v_tz, 'Africa/Lagos')))::smallint;

    v_in_quiet := case
      when prefs.quiet_hours_start < prefs.quiet_hours_end
        then v_local_hour >= prefs.quiet_hours_start and v_local_hour < prefs.quiet_hours_end
      else v_local_hour >= prefs.quiet_hours_start or v_local_hour < prefs.quiet_hours_end
    end;

    if v_in_quiet then
      -- Defer to the end of quiet hours rather than dropping.
      v_delay := date_trunc('day', now() at time zone coalesce(v_tz, 'Africa/Lagos'))
                 + make_interval(hours => prefs.quiet_hours_end);
      if v_delay <= now() then
        v_delay := v_delay + interval '1 day';
      end if;
    end if;
  end if;

  -- In-app is always immediate: the row already exists in `notifications`.
  if prefs.in_app_enabled then
    insert into notification_deliveries (notification_id, user_id, channel, status, sent_at)
    values (new.id, new.user_id, 'in_app', 'sent', now())
    on conflict do nothing;
  end if;

  if prefs.push_enabled
     and exists (select 1 from push_subscriptions
                 where user_id = new.user_id and failed_at is null) then
    insert into notification_deliveries (notification_id, user_id, channel, scheduled_for)
    values (new.id, new.user_id, 'push', v_delay)
    on conflict do nothing;
  end if;

  -- Email is reserved for meaningful events, not every in-app ping.
  if prefs.email_enabled and new.kind in (
       'application_accepted', 'payment_received', 'payment_released', 'payout_processed',
       'job_completed', 'review_request', 'dispute_update', 'verification_update',
       'security_alert'
     ) then
    insert into notification_deliveries (notification_id, user_id, channel, scheduled_for)
    values (new.id, new.user_id, 'email', v_delay)
    on conflict do nothing;
  end if;

  -- SMS only for the highest-stakes events, and only if explicitly enabled.
  if prefs.sms_enabled and new.kind in ('security_alert', 'payment_released', 'application_accepted') then
    insert into notification_deliveries (notification_id, user_id, channel, scheduled_for)
    values (new.id, new.user_id, 'sms', v_delay)
    on conflict do nothing;
  end if;

  return null;
end;
$$;

create trigger notifications_fanout after insert on notifications
  for each row execute function app.fanout_notification();

-- Convenience API used by the domain layer and other triggers.
create or replace function app.notify(
  p_user_id uuid,
  p_kind notification_kind,
  p_title text,
  p_body text default null,
  p_action_url text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_actor_id uuid default null,
  p_critical boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into notifications (
    user_id, kind, title, body, action_url,
    entity_type, entity_id, actor_id, is_critical, metadata
  )
  values (
    p_user_id, p_kind, p_title, p_body, p_action_url,
    p_entity_type, p_entity_id, p_actor_id, p_critical, p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ── event-driven notifications ─────────────────────────────────────────────

-- Poster gets told when someone applies.
create or replace function app.notify_on_application()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs%rowtype;
  v_hustler_name text;
begin
  select * into v_job from jobs where id = new.job_id;
  select display_name into v_hustler_name from profiles where id = new.hustler_id;

  perform app.notify(
    v_job.poster_id,
    'application_received',
    v_hustler_name || ' applied to your job',
    v_job.title,
    '/jobs/' || v_job.id || '/applications',
    'job', v_job.id, new.hustler_id, false,
    jsonb_build_object('application_id', new.id, 'proposed_price_minor', new.proposed_price_minor)
  );
  return null;
end;
$$;

create trigger job_applications_notify after insert on job_applications
  for each row execute function app.notify_on_application();

-- Hustler gets told when their application is decided.
create or replace function app.notify_on_application_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
begin
  if new.status = old.status then
    return null;
  end if;

  select title into v_title from jobs where id = new.job_id;

  if new.status = 'accepted' then
    perform app.notify(
      new.hustler_id, 'application_accepted',
      'You''ve got the job!', v_title,
      '/jobs/' || new.job_id, 'job', new.job_id, null, true
    );
  elsif new.status = 'declined' then
    perform app.notify(
      new.hustler_id, 'application_declined',
      'Application not selected', v_title,
      '/jobs/' || new.job_id, 'job', new.job_id
    );
  end if;

  return null;
end;
$$;

create trigger job_applications_notify_decision
  after update of status on job_applications
  for each row execute function app.notify_on_application_decision();

-- New message → notify the other participants.
create or replace function app.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender text;
  member record;
begin
  if new.kind = 'system' or new.sender_id is null then
    return null;
  end if;

  select display_name into v_sender from profiles where id = new.sender_id;

  for member in
    select cm.user_id
    from conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
      and cm.left_at is null
      and not cm.is_muted
  loop
    perform app.notify(
      member.user_id, 'message_received',
      v_sender,
      left(coalesce(new.body, 'Sent an attachment'), 120),
      '/messages/' || new.conversation_id,
      'conversation', new.conversation_id, new.sender_id
    );
  end loop;

  return null;
end;
$$;

create trigger messages_notify after insert on messages
  for each row execute function app.notify_on_message();
