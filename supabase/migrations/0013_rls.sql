-- ═══════════════════════════════════════════════════════════════════════════
-- 0013 — Row Level Security.
--
-- Authorization lives here, not in the API layer. Every table is deny-by-
-- default; the policies below are the complete list of what any authenticated
-- user may see or change. The API layer duplicates some of these checks purely
-- to produce good error messages — it is never the thing keeping data safe.
--
-- Note on privacy: `profiles` is readable, but the columns holding email,
-- phone and exact coordinates are protected by the `profiles_public` view plus
-- a column-level GRANT, not by the row policy. Precise job addresses are
-- likewise gated on an active working relationship.
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: do these two users have (or did they have) a working relationship?
-- This is the gate for revealing precise addresses and contact details.
create or replace function app.has_job_relationship(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from job_assignments ja
    where ((ja.poster_id = a and ja.hustler_id = b)
        or (ja.poster_id = b and ja.hustler_id = a))
      and ja.status in ('active', 'submitted', 'completed', 'disputed')
  )
$$;

-- Helper: may this user see the exact location of this job?
create or replace function app.can_see_exact_job_location(p_job_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from jobs j
    where j.id = p_job_id
      and (
        j.poster_id = p_user
        or exists (
          select 1 from job_assignments ja
          where ja.job_id = j.id
            and ja.hustler_id = p_user
            and ja.status in ('active', 'submitted', 'completed', 'disputed')
        )
      )
  ) or app.is_staff()
$$;

-- ── enable RLS everywhere ──────────────────────────────────────────────────

alter table profiles                enable row level security;
alter table user_roles              enable row level security;
alter table user_verifications      enable row level security;
alter table skills                  enable row level security;
alter table user_skills             enable row level security;
alter table addresses               enable row level security;
alter table availability            enable row level security;
alter table portfolio_items         enable row level security;
alter table user_sessions           enable row level security;
alter table user_blocks             enable row level security;
alter table categories              enable row level security;
alter table locations               enable row level security;
alter table jobs                    enable row level security;
alter table job_images              enable row level security;
alter table job_requirements        enable row level security;
alter table job_invitations         enable row level security;
alter table job_status_history      enable row level security;
alter table saved_jobs              enable row level security;
alter table saved_hustlers          enable row level security;
alter table job_views               enable row level security;
alter table job_applications        enable row level security;
alter table job_assignments         enable row level security;
alter table application_responses   enable row level security;
alter table conversations           enable row level security;
alter table conversation_members    enable row level security;
alter table messages                enable row level security;
alter table message_attachments     enable row level security;
alter table message_reads           enable row level security;
alter table typing_indicators       enable row level security;
alter table notification_preferences enable row level security;
alter table notifications           enable row level security;
alter table push_subscriptions      enable row level security;
alter table notification_deliveries enable row level security;
alter table ledger_accounts         enable row level security;
alter table transactions            enable row level security;
alter table ledger_entries          enable row level security;
alter table payout_accounts         enable row level security;
alter table payouts                 enable row level security;
alter table payment_webhook_events  enable row level security;
alter table reviews                 enable row level security;
alter table reports                 enable row level security;
alter table disputes                enable row level security;
alter table dispute_evidence        enable row level security;
alter table dispute_timeline        enable row level security;
alter table fraud_signals           enable row level security;
alter table account_fingerprints    enable row level security;
alter table platform_settings       enable row level security;
alter table platform_settings_history enable row level security;
alter table admin_actions           enable row level security;
alter table audit_logs              enable row level security;
alter table analytics_events        enable row level security;
alter table rate_limits             enable row level security;
alter table search_queries          enable row level security;
alter table background_jobs         enable row level security;

-- ── identity ───────────────────────────────────────────────────────────────

-- Anyone may read a profile row; the sensitive COLUMNS are withheld by grant
-- (see the bottom of this file) and by the `profiles_public` view.
create policy profiles_select_all on profiles
  for select using (deleted_at is null or app.is_staff());

create policy profiles_insert_self on profiles
  for insert with check (id = app.current_user_id());

create policy profiles_update_self on profiles
  for update using (id = app.current_user_id())
  with check (id = app.current_user_id());

create policy profiles_admin_all on profiles
  for all using (app.has_role('admin')) with check (app.has_role('admin'));

create policy user_roles_select_self on user_roles
  for select using (user_id = app.current_user_id() or app.is_staff());

-- Only a superadmin may grant or revoke roles. This is deliberately the single
-- most restricted write in the system.
create policy user_roles_superadmin_write on user_roles
  for all using (app.has_role('superadmin')) with check (app.has_role('superadmin'));

create policy user_verifications_select_own on user_verifications
  for select using (user_id = app.current_user_id() or app.is_staff());

create policy user_verifications_insert_own on user_verifications
  for insert with check (user_id = app.current_user_id());

-- A user may never mark their own verification as verified: only staff can.
create policy user_verifications_staff_update on user_verifications
  for update using (app.is_staff()) with check (app.is_staff());

create policy skills_select_all on skills for select using (true);
create policy skills_admin_write on skills
  for all using (app.has_role('admin')) with check (app.has_role('admin'));

create policy user_skills_select_all on user_skills for select using (true);
create policy user_skills_write_own on user_skills
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

-- Addresses are private. A counterparty may read one only through the job
-- detail path once a working relationship exists.
create policy addresses_select_own on addresses
  for select using (
    user_id = app.current_user_id()
    or app.is_staff()
    or app.has_job_relationship(user_id, app.current_user_id())
  );

create policy addresses_write_own on addresses
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy availability_select_all on availability for select using (true);
create policy availability_write_own on availability
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy portfolio_select_all on portfolio_items for select using (true);
create policy portfolio_write_own on portfolio_items
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy user_sessions_own on user_sessions
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy user_blocks_own on user_blocks
  for all using (blocker_id = app.current_user_id() or app.is_staff())
  with check (blocker_id = app.current_user_id());

-- ── taxonomy ───────────────────────────────────────────────────────────────

create policy categories_select_all on categories for select using (true);
create policy categories_admin_write on categories
  for all using (app.has_role('admin')) with check (app.has_role('admin'));

create policy locations_select_all on locations for select using (true);
create policy locations_admin_write on locations
  for all using (app.has_role('admin')) with check (app.has_role('admin'));

-- ── jobs ───────────────────────────────────────────────────────────────────

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
        or exists (select 1 from job_invitations ji
                   where ji.job_id = jobs.id and ji.hustler_id = app.current_user_id())
      )
      and not app.is_blocked_between(poster_id, app.current_user_id())
    )
  );

create policy jobs_insert_own on jobs
  for insert with check (
    poster_id = app.current_user_id()
    -- A brand new job must start as a draft; publishing goes through
    -- publish_job() so the limits and fan-out always run.
    and status = 'DRAFT'
  );

create policy jobs_update_own on jobs
  for update using (poster_id = app.current_user_id())
  with check (poster_id = app.current_user_id());

create policy jobs_admin_all on jobs
  for all using (app.has_role('admin')) with check (app.has_role('admin'));

create policy job_images_select on job_images
  for select using (
    exists (select 1 from jobs j where j.id = job_images.job_id)
  );

create policy job_images_write_owner on job_images
  for all using (
    exists (select 1 from jobs j where j.id = job_images.job_id
              and j.poster_id = app.current_user_id())
  )
  with check (
    exists (select 1 from jobs j where j.id = job_images.job_id
              and j.poster_id = app.current_user_id())
  );

create policy job_requirements_select on job_requirements
  for select using (exists (select 1 from jobs j where j.id = job_requirements.job_id));

create policy job_requirements_write_owner on job_requirements
  for all using (
    exists (select 1 from jobs j where j.id = job_requirements.job_id
              and j.poster_id = app.current_user_id())
  )
  with check (
    exists (select 1 from jobs j where j.id = job_requirements.job_id
              and j.poster_id = app.current_user_id())
  );

create policy job_invitations_select on job_invitations
  for select using (
    hustler_id = app.current_user_id()
    or invited_by = app.current_user_id()
    or app.is_staff()
  );

create policy job_invitations_write_poster on job_invitations
  for all using (
    exists (select 1 from jobs j where j.id = job_invitations.job_id
              and j.poster_id = app.current_user_id())
  )
  with check (
    exists (select 1 from jobs j where j.id = job_invitations.job_id
              and j.poster_id = app.current_user_id())
  );

create policy job_status_history_select on job_status_history
  for select using (
    app.is_staff()
    or exists (
      select 1 from jobs j where j.id = job_status_history.job_id
        and (j.poster_id = app.current_user_id()
             or exists (select 1 from job_assignments ja
                        where ja.job_id = j.id and ja.hustler_id = app.current_user_id()))
    )
  );

create policy saved_jobs_own on saved_jobs
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy saved_hustlers_own on saved_hustlers
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy job_views_insert on job_views
  for insert with check (viewer_id is null or viewer_id = app.current_user_id());

create policy job_views_select_owner on job_views
  for select using (
    app.is_staff()
    or exists (select 1 from jobs j where j.id = job_views.job_id
                 and j.poster_id = app.current_user_id())
  );

-- ── applications ───────────────────────────────────────────────────────────

-- A hustler sees their own applications. A poster sees applications to their
-- own jobs. Nobody sees anybody else's offers — competitors cannot price-snipe.
create policy job_applications_select on job_applications
  for select using (
    hustler_id = app.current_user_id()
    or app.is_staff()
    or exists (select 1 from jobs j where j.id = job_applications.job_id
                 and j.poster_id = app.current_user_id())
  );

create policy job_applications_insert_own on job_applications
  for insert with check (hustler_id = app.current_user_id());

-- The hustler may withdraw or edit their own pending application; the poster
-- may only move status (accept / decline / shortlist).
create policy job_applications_update_hustler on job_applications
  for update using (hustler_id = app.current_user_id() and status = 'submitted')
  with check (hustler_id = app.current_user_id());

create policy job_applications_update_poster on job_applications
  for update using (
    exists (select 1 from jobs j where j.id = job_applications.job_id
              and j.poster_id = app.current_user_id())
  )
  with check (
    exists (select 1 from jobs j where j.id = job_applications.job_id
              and j.poster_id = app.current_user_id())
  );

create policy job_assignments_select_parties on job_assignments
  for select using (
    poster_id = app.current_user_id()
    or hustler_id = app.current_user_id()
    or app.is_staff()
  );

-- Assignments are only ever written through the RPCs. No direct client writes.
create policy job_assignments_admin_write on job_assignments
  for all using (app.has_role('admin')) with check (app.has_role('admin'));

create policy application_responses_select on application_responses
  for select using (poster_id = app.current_user_id() or app.is_staff());

-- ── messaging ──────────────────────────────────────────────────────────────

create policy conversations_select_member on conversations
  for select using (
    app.is_conversation_member(id, app.current_user_id()) or app.is_staff()
  );

create policy conversations_insert_self on conversations
  for insert with check (created_by = app.current_user_id());

create policy conversations_update_member on conversations
  for update using (app.is_conversation_member(id, app.current_user_id()))
  with check (app.is_conversation_member(id, app.current_user_id()));

create policy conversation_members_select on conversation_members
  for select using (
    user_id = app.current_user_id()
    or app.is_conversation_member(conversation_id, app.current_user_id())
    or app.is_staff()
  );

create policy conversation_members_update_self on conversation_members
  for update using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy conversation_members_insert on conversation_members
  for insert with check (
    -- You may add yourself, or add someone to a conversation you created.
    user_id = app.current_user_id()
    or exists (select 1 from conversations c
               where c.id = conversation_id and c.created_by = app.current_user_id())
  );

create policy messages_select_member on messages
  for select using (
    app.is_conversation_member(conversation_id, app.current_user_id()) or app.is_staff()
  );

create policy messages_insert_member on messages
  for insert with check (
    sender_id = app.current_user_id()
    and app.is_conversation_member(conversation_id, app.current_user_id())
  );

-- Senders may edit/soft-delete only their own messages.
create policy messages_update_own on messages
  for update using (sender_id = app.current_user_id())
  with check (sender_id = app.current_user_id());

create policy messages_moderator_all on messages
  for all using (app.is_staff()) with check (app.is_staff());

create policy message_attachments_select on message_attachments
  for select using (
    exists (select 1 from messages m
            where m.id = message_attachments.message_id
              and app.is_conversation_member(m.conversation_id, app.current_user_id()))
    or app.is_staff()
  );

create policy message_attachments_insert on message_attachments
  for insert with check (
    exists (select 1 from messages m
            where m.id = message_attachments.message_id
              and m.sender_id = app.current_user_id())
  );

create policy message_reads_own on message_reads
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy typing_indicators_member on typing_indicators
  for all using (app.is_conversation_member(conversation_id, app.current_user_id()))
  with check (user_id = app.current_user_id());

-- ── notifications ──────────────────────────────────────────────────────────

create policy notification_preferences_own on notification_preferences
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy notifications_select_own on notifications
  for select using (user_id = app.current_user_id());

-- Users may only mark their own notifications read. Creation is server-side.
create policy notifications_update_own on notifications
  for update using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy push_subscriptions_own on push_subscriptions
  for all using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

create policy notification_deliveries_select_own on notification_deliveries
  for select using (user_id = app.current_user_id() or app.is_staff());

-- ── money ──────────────────────────────────────────────────────────────────
--
-- Read-only for users, and only their own rows. Every write happens inside a
-- SECURITY DEFINER RPC, so there is no INSERT/UPDATE policy at all here — not
-- even for admins. That is deliberate: it makes "adjust a balance by hand"
-- impossible through the API.

create policy ledger_accounts_select_own on ledger_accounts
  for select using (owner_id = app.current_user_id() or app.has_role('admin'));

create policy transactions_select_party on transactions
  for select using (
    payer_id = app.current_user_id()
    or payee_id = app.current_user_id()
    or app.has_role('admin')
  );

create policy ledger_entries_select_own on ledger_entries
  for select using (
    exists (select 1 from ledger_accounts la
            where la.id = ledger_entries.account_id
              and la.owner_id = app.current_user_id())
    or app.has_role('admin')
  );

create policy payout_accounts_own on payout_accounts
  for all using (user_id = app.current_user_id() or app.has_role('admin'))
  with check (user_id = app.current_user_id());

create policy payouts_select_own on payouts
  for select using (user_id = app.current_user_id() or app.has_role('admin'));

-- Webhook evidence is admin-only. Users never see raw provider payloads.
create policy payment_webhook_events_admin on payment_webhook_events
  for select using (app.has_role('admin'));

-- ── trust & safety ─────────────────────────────────────────────────────────

create policy reviews_select_published on reviews
  for select using (
    (is_published and not is_hidden)
    or reviewer_id = app.current_user_id()
    or reviewee_id = app.current_user_id()
    or app.is_staff()
  );

create policy reviews_insert_own on reviews
  for insert with check (reviewer_id = app.current_user_id());

-- A review may be edited by its author only while it is still unpublished.
create policy reviews_update_own on reviews
  for update using (reviewer_id = app.current_user_id() and not is_published)
  with check (reviewer_id = app.current_user_id());

create policy reviews_moderator on reviews
  for all using (app.is_staff()) with check (app.is_staff());

create policy reports_insert_own on reports
  for insert with check (reporter_id = app.current_user_id());

create policy reports_select_own on reports
  for select using (reporter_id = app.current_user_id() or app.is_staff());

create policy reports_staff_manage on reports
  for update using (app.is_staff()) with check (app.is_staff());

create policy disputes_select_parties on disputes
  for select using (
    raised_by = app.current_user_id()
    or against_user = app.current_user_id()
    or app.is_staff()
  );

create policy disputes_insert_party on disputes
  for insert with check (raised_by = app.current_user_id());

create policy disputes_staff_manage on disputes
  for update using (app.is_staff()) with check (app.is_staff());

create policy dispute_evidence_select_parties on dispute_evidence
  for select using (
    app.is_staff()
    or exists (select 1 from disputes d
               where d.id = dispute_evidence.dispute_id
                 and (d.raised_by = app.current_user_id()
                      or d.against_user = app.current_user_id()))
  );

create policy dispute_evidence_insert_party on dispute_evidence
  for insert with check (
    submitted_by = app.current_user_id()
    and exists (select 1 from disputes d
                where d.id = dispute_id
                  and (d.raised_by = app.current_user_id()
                       or d.against_user = app.current_user_id()))
  );

create policy dispute_timeline_select on dispute_timeline
  for select using (
    app.is_staff()
    or exists (select 1 from disputes d
               where d.id = dispute_timeline.dispute_id
                 and (d.raised_by = app.current_user_id()
                      or d.against_user = app.current_user_id()))
  );

-- Fraud data is staff-only. A user must never learn their own risk score or
-- which signals fired — that would be a roadmap for evasion.
create policy fraud_signals_staff on fraud_signals
  for all using (app.is_staff()) with check (app.is_staff());

create policy account_fingerprints_staff on account_fingerprints
  for all using (app.is_staff()) with check (app.is_staff());

-- ── operations ─────────────────────────────────────────────────────────────

create policy platform_settings_select_public on platform_settings
  for select using (is_public or app.has_role('admin'));

create policy platform_settings_admin_write on platform_settings
  for all using (app.has_role('admin')) with check (app.has_role('admin'));

create policy platform_settings_history_admin on platform_settings_history
  for select using (app.has_role('admin'));

create policy admin_actions_select_admin on admin_actions
  for select using (app.has_role('admin'));

create policy admin_actions_insert_admin on admin_actions
  for insert with check (admin_id = app.current_user_id() and app.is_staff());

create policy audit_logs_admin on audit_logs
  for select using (app.has_role('admin'));

create policy analytics_events_insert_any on analytics_events
  for insert with check (user_id is null or user_id = app.current_user_id());

create policy analytics_events_admin_read on analytics_events
  for select using (app.has_role('admin'));

-- Rate limit rows are machinery. No client access at all.
create policy rate_limits_none on rate_limits for select using (false);

create policy search_queries_insert on search_queries
  for insert with check (user_id is null or user_id = app.current_user_id());

create policy search_queries_select_own on search_queries
  for select using (user_id = app.current_user_id() or app.has_role('admin'));

create policy background_jobs_admin on background_jobs
  for select using (app.has_role('admin'));

-- ── column-level privacy ───────────────────────────────────────────────────
--
-- RLS controls which ROWS are visible; these grants control which COLUMNS.
-- The anon/authenticated roles simply have no privilege on the sensitive ones,
-- so even a `select *` cannot leak them.

revoke all on profiles from anon, authenticated;

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

-- The owner needs their own private columns; that is served by the
-- `my_profile` view below, which is filtered to the caller.
grant update (
  display_name, avatar_url, bio, headline, username,
  city, area, state, country_code, home_lat, home_lng,
  is_hustler, is_poster, service_radius_km,
  hourly_rate_minor, starting_price_minor, currency,
  available_now, accepts_remote, locale, timezone,
  onboarding_step, profile_completed, last_active_at
) on profiles to authenticated;

grant insert on profiles to authenticated;

-- A caller's own complete profile, including the private columns.
create or replace view my_profile
with (security_invoker = true)
as
select p.*
from profiles p
where p.id = app.current_user_id();

-- The safe public projection, used by every discovery surface and public page.
create or replace view profiles_public
with (security_invoker = true)
as
select
  p.id, p.username, p.display_name, p.avatar_url, p.bio, p.headline,
  p.city, p.area, p.state, p.country_code,
  p.is_hustler, p.is_poster, p.service_radius_km,
  p.hourly_rate_minor, p.starting_price_minor, p.currency,
  p.available_now, p.accepts_remote,
  p.rating_avg, p.rating_count, p.jobs_completed, p.jobs_posted,
  p.response_rate, p.response_time_secs,
  p.email_verified, p.phone_verified, p.identity_verified,
  p.created_at
from profiles p
where p.deleted_at is null and p.status = 'active';

grant select on profiles_public to anon, authenticated;
grant select on my_profile to authenticated;

-- Exact job coordinates: same idea, enforced by a view rather than by hoping
-- callers remember not to select the column.
revoke select (exact_lat, exact_lng, exact_point, address_id) on jobs from anon, authenticated;

create or replace view job_precise_location
with (security_invoker = true)
as
select j.id as job_id, j.exact_lat, j.exact_lng, a.line1, a.line2, a.landmark, a.instructions
from jobs j
left join addresses a on a.id = j.address_id
where app.can_see_exact_job_location(j.id, app.current_user_id());

grant select on job_precise_location to authenticated;

grant select on wallets to authenticated;
grant select on popular_searches to anon, authenticated;

-- ── function execution grants ──────────────────────────────────────────────

-- Trusted-server functions must not be callable by end users, even though RLS
-- would stop them: revoking EXECUTE removes the attack surface entirely.
revoke execute on function record_escrow_funding(uuid, text, bigint, bigint) from anon, authenticated;
revoke execute on function settle_payout(uuid, boolean, text, text) from anon, authenticated;
revoke execute on function mature_pending_earnings() from anon, authenticated;
revoke execute on function auto_confirm_due_assignments() from anon, authenticated;
revoke execute on function expire_stale_jobs() from anon, authenticated;
revoke execute on function publish_due_reviews() from anon, authenticated;
revoke execute on function reconcile_ledger() from anon, authenticated;
revoke execute on function refund_escrow(uuid, bigint, text) from anon;
revoke execute on function resolve_dispute(uuid, dispute_resolution, bigint, bigint, text) from anon;

-- Discovery is open to logged-out visitors so the public marketplace works.
grant execute on function search_jobs(
  double precision, double precision, numeric, text, uuid[], bigint, bigint,
  job_urgency[], job_location_kind[], numeric, integer, text, integer, integer
) to anon, authenticated;

grant execute on function search_hustlers(
  double precision, double precision, numeric, text, uuid[], uuid[], numeric,
  boolean, bigint, boolean, text, integer, integer
) to anon, authenticated;

grant execute on function search_suggestions(text, integer) to anon, authenticated;
grant execute on function jobs_in_bounds(
  double precision, double precision, double precision, double precision, uuid[], integer
) to anon, authenticated;
