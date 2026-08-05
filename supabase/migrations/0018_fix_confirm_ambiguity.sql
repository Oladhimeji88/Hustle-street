-- ═══════════════════════════════════════════════════════════════════════════
-- 0018 — Fix a plpgsql name collision in confirm_job_completion.
--
-- The function declares OUT parameters named assignment_id and currency, which
-- shadow identically-named columns on . Any bare reference in a
-- WHERE clause was therefore ambiguous, and PostgreSQL aborted the release with
--   column reference "assignment_id" is ambiguous
-- meaning escrow could be funded but never released. Qualifying the table
-- references with an alias resolves it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.confirm_job_completion(p_assignment_id uuid, p_system_auto boolean DEFAULT false)
 RETURNS TABLE(assignment_id uuid, release_transaction_id uuid, hustler_net_minor bigint, platform_fee_minor bigint, currency currency_code)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    select * into v_release from transactions t
     where t.assignment_id = v_assignment.id and t.kind = 'escrow_release'
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
  from transactions t
  where t.assignment_id = v_assignment.id and t.kind = 'escrow_funding' and t.status = 'HELD'
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
$function$
;
