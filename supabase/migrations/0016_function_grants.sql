-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 — Corrected EXECUTE privileges on app.* functions.
--
-- 0015 used an allowlist built by reading the RLS policies. That missed a whole
-- category: TRIGGER functions execute as the role that fired them, and any
-- function THEY call is permission-checked against that role too. Inserting a
-- job application fires app.sync_application_count → updates jobs → fires
-- app.guard_job_transition → calls app.is_valid_job_transition, which was not
-- on the allowlist. Result: "permission denied for function
-- is_valid_job_transition" on an ordinary insert.
--
-- The model here:
--
--   • service_role gets EXECUTE on everything. It already bypasses RLS, so
--     withholding function rights buys no security and only creates outages.
--
--   • anon / authenticated get EXECUTE on everything EXCEPT an explicit
--     denylist of privileged writers. A denylist is right for the functions
--     that exist today because they are fully enumerated below; the
--     ALTER DEFAULT PRIVILEGES from 0015 still denies anything added later,
--     so new functions remain secure-by-default and must opt in.
--
--   • Trigger functions themselves need no grant — PostgreSQL checks EXECUTE
--     when the trigger is created, not when it fires.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  /*
   * SECURITY DEFINER functions that perform privileged work while trusting
   * their caller completely. Reaching any of these directly from the API would
   * be a real vulnerability, so they stay denied to anon and authenticated:
   *
   *   post_escrow_refund        moves money out of escrow, no auth check
   *   ensure_ledger_account     mints ledger accounts
   *   recompute_account_balance rewrites a cached balance
   *   recompute_risk_score      writes to profiles.risk_score
   *   notify                    writes a notification to ANY user (spam vector)
   *   rate_limit_hit            could be used to exhaust another user's quota
   *   claim_background_jobs     claims worker queue items
   *   setting_bool/number/text  read platform_settings bypassing RLS, which
   *                             would expose settings marked is_public = false
   */
  denied text[] := array[
    'post_escrow_refund',
    'ensure_ledger_account',
    'recompute_account_balance',
    'recompute_risk_score',
    'notify',
    'rate_limit_hit',
    'claim_background_jobs',
    'setting_bool',
    'setting_number',
    'setting_text'
  ];
  fn record;
  signature text;
begin
  for fn in
    select p.proname,
           pg_get_function_identity_arguments(p.oid) as args,
           -- Trigger functions take no arguments and are invoked by the system.
           exists (select 1 from pg_trigger t where t.tgfoid = p.oid) as is_trigger
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app'
  loop
    signature := format('app.%I(%s)', fn.proname, fn.args);

    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', signature);
    end if;

    -- Trigger functions are never called by name from the API.
    continue when fn.is_trigger;
    continue when fn.proname = any(denied);

    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', signature);
    end if;
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon', signature);
    end if;
  end loop;
end
$$;

-- Belt and braces: make sure the denied set really is denied, even if an
-- earlier migration or a manual grant handed it out.
do $$
declare
  denied text[] := array[
    'post_escrow_refund', 'ensure_ledger_account', 'recompute_account_balance',
    'recompute_risk_score', 'notify', 'rate_limit_hit', 'claim_background_jobs',
    'setting_bool', 'setting_number', 'setting_text'
  ];
  fn record;
begin
  for fn in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname = any(denied)
  loop
    execute format(
      'revoke all on function app.%I(%s) from public, anon, authenticated',
      fn.proname, fn.args
    );
  end loop;
end
$$;

-- The public RPCs live in `public` and are the supported entry points. They are
-- SECURITY DEFINER, so their internal app.* calls run as the definer and are
-- unaffected by the restrictions above.
do $$
declare
  trusted_server_only text[] := array[
    'record_escrow_funding', 'settle_payout', 'mature_pending_earnings',
    'auto_confirm_due_assignments', 'expire_stale_jobs', 'publish_due_reviews',
    'reconcile_ledger'
  ];
  fn record;
begin
  for fn in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    if fn.proname = any(trusted_server_only) then
      execute format(
        'revoke all on function public.%I(%s) from public, anon, authenticated',
        fn.proname, fn.args
      );
      if exists (select 1 from pg_roles where rolname = 'service_role') then
        execute format(
          'grant execute on function public.%I(%s) to service_role', fn.proname, fn.args
        );
      end if;
    end if;
  end loop;
end
$$;

do $$
begin
  notify pgrst, 'reload schema';
exception
  when others then null;
end
$$;
