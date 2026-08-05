-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 — Privileges on the `app` schema.
--
-- 0001 revoked everything on `app` to keep internal machinery private. That was
-- too blunt: PostgreSQL evaluates RLS policy expressions, index expressions and
-- generated columns as the *querying* role, so every ordinary read started
-- failing with "permission denied for schema app".
--
-- The correct posture is narrow rather than absent:
--
--   • USAGE on the schema for every API role — unavoidable, because policies
--     and expression indexes reference app.* by name.
--   • EXECUTE on ONLY the handful of read-only helpers that policies and
--     indexes actually invoke.
--   • EXECUTE revoked on everything else, in particular the SECURITY DEFINER
--     helpers that perform privileged writes with no authorization check of
--     their own (app.post_escrow_refund is the sharpest example — it moves
--     money and trusts its caller entirely).
--
-- This is safe because the public RPCs are themselves SECURITY DEFINER: nested
-- calls inside them run with the definer's rights, so locking the caller out of
-- app.* does not break search_jobs(), accept_application() and friends.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  api_roles text[] := array['anon', 'authenticated', 'service_role'];
  r text;
begin
  foreach r in array api_roles loop
    -- Supabase provides these roles; a vanilla PostgreSQL used for tests does not.
    if not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;

    execute format('grant usage on schema app to %I', r);

    -- Deny by default, including anything added by a future migration.
    execute format('revoke all on all functions in schema app from %I', r);
    execute format(
      'alter default privileges in schema app revoke execute on functions from %I', r
    );
  end loop;

  -- Functions PUBLIC must never reach, even by accident.
  execute 'revoke all on all functions in schema app from public';
  execute 'alter default privileges in schema app revoke execute on functions from public';
end
$$;

-- ── The allowlist ──────────────────────────────────────────────────────────
-- Everything below is either a pure function or returns only data the caller
-- could already see. Nothing here writes.

do $$
declare
  -- Referenced directly by RLS policies.
  policy_helpers text[] := array[
    'app.current_user_id()',
    'app.has_role(user_role)',
    'app.is_staff()',
    'app.is_conversation_member(uuid, uuid)',
    'app.is_blocked_between(uuid, uuid)',
    'app.has_job_relationship(uuid, uuid)',
    'app.can_see_exact_job_location(uuid, uuid)'
  ];
  -- Referenced by index expressions and generated columns, so they are
  -- evaluated by whoever runs the INSERT/UPDATE or uses the index.
  expression_helpers text[] := array[
    'app.normalize_text(text)',
    'app.immutable_unaccent(text)',
    'app.point_from_lat_lng(double precision, double precision)',
    'app.fuzz_coordinate(double precision)'
  ];
  fn text;
  r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;

    foreach fn in array policy_helpers || expression_helpers loop
      execute format('grant execute on function %s to %I', fn, r);
    end loop;
  end loop;
end
$$;

-- ── Table privileges ───────────────────────────────────────────────────────
-- RLS decides which ROWS a role sees; these grants decide whether it may touch
-- the table at all. Supabase grants these by default for tables created before
-- the API roles exist, but ours are created by migration, so set them here.

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      continue;
    end if;

    execute format('grant usage on schema public to %I', r);
    execute format('grant select on all tables in schema public to %I', r);
    execute format('grant usage, select on all sequences in schema public to %I', r);
    execute format(
      'alter default privileges in schema public grant select on tables to %I', r
    );
  end loop;

  -- Writes are for signed-in users only; RLS narrows them to their own rows.
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant insert, update, delete on all tables in schema public to authenticated';
    execute 'alter default privileges in schema public '
            'grant insert, update, delete on tables to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant all on all tables in schema public to service_role';
    execute 'alter default privileges in schema public grant all on tables to service_role';
  end if;
end
$$;

-- ── Re-lock the append-only and money tables ───────────────────────────────
-- The blanket grant above is convenient but too generous for the tables whose
-- integrity the whole product rests on. Writes to these happen exclusively
-- through SECURITY DEFINER RPCs, so no API role needs direct DML.

do $$
declare
  locked_tables text[] := array[
    'ledger_accounts', 'ledger_entries', 'transactions', 'payouts',
    'payment_webhook_events', 'job_assignments', 'job_status_history',
    'audit_logs', 'admin_actions', 'platform_settings_history',
    'dispute_evidence', 'dispute_timeline', 'fraud_signals',
    'account_fingerprints', 'rate_limits', 'background_jobs',
    'application_responses', 'notification_deliveries'
  ];
  t text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    return;
  end if;

  foreach t in array locked_tables loop
    execute format('revoke insert, update, delete on %I from authenticated, anon', t);
  end loop;

  -- Users legitimately create these directly (RLS constrains them to their own
  -- rows), so they are deliberately absent from the list above:
  --   jobs, job_applications, messages, reviews, reports, disputes,
  --   saved_jobs, addresses, push_subscriptions, notifications (update only)
end
$$;

-- ── PostgREST schema cache ─────────────────────────────────────────────────
-- PostgREST caches the schema and will keep returning 404/PGRST205 for tables
-- created by this migration run until it reloads.

do $$
begin
  if exists (select 1 from pg_class where relname = 'pgrst_ddl_watch') then
    return;   -- Supabase's own watcher will handle it
  end if;
  notify pgrst, 'reload schema';
exception
  when others then null;
end
$$;
