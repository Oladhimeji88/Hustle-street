-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 — Messaging: conversations, membership, messages, attachments,
--        read state and typing presence.
--
-- Every job conversation is bound to its job so the chat, the agreement and
-- the money are one continuous thread.
-- ═══════════════════════════════════════════════════════════════════════════

create table conversations (
  id            uuid primary key default gen_random_uuid(),
  kind          conversation_kind not null default 'job',
  job_id        uuid references jobs(id) on delete cascade,
  application_id uuid references job_applications(id) on delete set null,
  subject       text,
  created_by    uuid references profiles(id) on delete set null,

  last_message_at   timestamptz,
  last_message_preview text,
  message_count integer not null default 0,

  is_locked     boolean not null default false,   -- set when a dispute closes
  locked_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint conversations_job_kind_consistent
    check ((kind = 'job') = (job_id is not null))
);

create index conversations_job_idx on conversations (job_id);
create index conversations_recent_idx on conversations (last_message_at desc nulls last);

create trigger conversations_touch before update on conversations
  for each row execute function app.touch_updated_at();

-- ── membership ─────────────────────────────────────────────────────────────

create table conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  role            text not null default 'participant'
                    check (role in ('participant', 'support', 'observer')),
  last_read_at    timestamptz,
  last_read_message_id uuid,
  unread_count    integer not null default 0 check (unread_count >= 0),
  is_muted        boolean not null default false,
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx
  on conversation_members (user_id, left_at, unread_count desc);

-- Membership check used by every messaging RLS policy. SECURITY DEFINER avoids
-- the infinite recursion you get when a policy on `conversation_members`
-- queries `conversation_members`.
create or replace function app.is_conversation_member(target_conversation uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from conversation_members cm
    where cm.conversation_id = target_conversation
      and cm.user_id = target_user
      and cm.left_at is null
  )
$$;

-- ── messages ───────────────────────────────────────────────────────────────

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid references profiles(id) on delete set null,
  kind            message_kind not null default 'text',
  body            text,

  -- Client-generated idempotency key. Lets the PWA retry a queued offline send
  -- without ever creating a duplicate message.
  client_nonce    text,

  reply_to_id     uuid references messages(id) on delete set null,
  -- System messages carry structured payloads ("Payment secured", "Job
  -- submitted") so the UI can render them richly and translate them later.
  system_event    text,
  metadata        jsonb not null default '{}'::jsonb,

  is_edited       boolean not null default false,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  flagged         boolean not null default false,

  created_at      timestamptz not null default now(),

  constraint messages_body_present
    check (kind <> 'text' or char_length(trim(coalesce(body, ''))) > 0),
  constraint messages_body_length
    check (body is null or char_length(body) <= 4000),
  constraint messages_system_has_sender
    check (kind <> 'system' or sender_id is null)
);

create index messages_conversation_idx on messages (conversation_id, created_at desc);
create unique index messages_client_nonce_key
  on messages (conversation_id, sender_id, client_nonce)
  where client_nonce is not null;
create index messages_search_idx
  on messages using gin (app.normalize_text(coalesce(body, '')) gin_trgm_ops);
create index messages_flagged_idx on messages (flagged, created_at desc) where flagged;

create table message_attachments (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references messages(id) on delete cascade,
  storage_path text not null,
  file_name   text,
  mime_type   text not null,
  byte_size   integer not null check (byte_size > 0 and byte_size <= 25 * 1024 * 1024),
  width       integer,
  height      integer,
  duration_ms integer,                    -- voice notes
  created_at  timestamptz not null default now()
);

create index message_attachments_message_idx on message_attachments (message_id);

-- ── send-time guards ───────────────────────────────────────────────────────

create or replace function app.guard_message_insert()
returns trigger
language plpgsql
as $$
declare
  v_conv conversations%rowtype;
  v_other uuid;
begin
  select * into v_conv from conversations where id = new.conversation_id;

  if not found then
    raise exception 'Conversation not found' using errcode = 'no_data_found';
  end if;

  if v_conv.is_locked and new.kind <> 'system' then
    raise exception 'This conversation is locked' using errcode = 'insufficient_privilege';
  end if;

  if new.kind <> 'system' then
    if new.sender_id is null then
      raise exception 'A message requires a sender' using errcode = 'not_null_violation';
    end if;

    if not app.is_conversation_member(new.conversation_id, new.sender_id) then
      raise exception 'You are not a member of this conversation'
        using errcode = 'insufficient_privilege';
    end if;

    -- Refuse delivery if either side has blocked the other.
    select cm.user_id into v_other
    from conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
      and cm.left_at is null
    limit 1;

    if v_other is not null and app.is_blocked_between(new.sender_id, v_other) then
      raise exception 'You cannot message this user' using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger messages_guard before insert on messages
  for each row execute function app.guard_message_insert();

-- Fans out conversation metadata + unread counters on every send.
create or replace function app.sync_message_fanout()
returns trigger
language plpgsql
as $$
begin
  update conversations
     set last_message_at = new.created_at,
         last_message_preview = left(
           coalesce(
             nullif(trim(new.body), ''),
             case new.kind
               when 'image' then '📷 Photo'
               when 'file'  then '📎 Attachment'
               when 'voice' then '🎤 Voice note'
               when 'system' then coalesce(new.system_event, 'Update')
               else 'Message'
             end
           ), 140),
         message_count = message_count + 1
   where id = new.conversation_id;

  update conversation_members
     set unread_count = unread_count + 1
   where conversation_id = new.conversation_id
     and left_at is null
     and (new.sender_id is null or user_id <> new.sender_id);

  return null;
end;
$$;

create trigger messages_fanout after insert on messages
  for each row execute function app.sync_message_fanout();

-- ── read receipts ──────────────────────────────────────────────────────────

create table message_reads (
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index message_reads_user_idx on message_reads (user_id, read_at desc);

-- Marks every message in a conversation as read for the caller and zeroes the
-- unread counter in one round trip.
create or replace function mark_conversation_read(target_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.current_user_id();
  v_last uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  if not app.is_conversation_member(target_conversation, v_user) then
    raise exception 'Not a member of this conversation' using errcode = 'insufficient_privilege';
  end if;

  insert into message_reads (message_id, user_id)
  select m.id, v_user
  from messages m
  where m.conversation_id = target_conversation
    and m.deleted_at is null
    and (m.sender_id is null or m.sender_id <> v_user)
  on conflict do nothing;

  select id into v_last
  from messages
  where conversation_id = target_conversation
  order by created_at desc
  limit 1;

  update conversation_members
     set unread_count = 0,
         last_read_at = now(),
         last_read_message_id = v_last
   where conversation_id = target_conversation and user_id = v_user;
end;
$$;

-- ── typing presence (ephemeral; swept by cron) ─────────────────────────────

create table typing_indicators (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  expires_at      timestamptz not null default now() + interval '8 seconds',
  primary key (conversation_id, user_id)
);

create index typing_indicators_expiry_idx on typing_indicators (expires_at);
