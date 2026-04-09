create or replace function public.apply_debt_first_hour_purchase(
  p_event_id text,
  p_project_id uuid,
  p_customer_id uuid,
  p_hours_added numeric,
  p_checkout_session_id text,
  p_amount_cents integer,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_billing_mode public.billing_mode;
  v_outstanding_debt numeric(10,2);
  v_debt_to_settle numeric(10,2);
begin
  if exists (
    select 1 from public.processed_stripe_events pse where pse.event_id = p_event_id
  ) then
    return false;
  end if;

  select p.billing_mode
  into v_billing_mode
  from public.projects p
  where p.id = p_project_id
    and p.customer_id = p_customer_id;

  if not found then
    raise exception 'project_customer_mismatch';
  end if;

  if v_billing_mode <> 'postpaid' then
    return public.apply_hour_purchase(
      p_event_id,
      p_project_id,
      p_customer_id,
      p_hours_added,
      p_checkout_session_id,
      p_amount_cents,
      p_currency
    );
  end if;

  select coalesce(sum(dl.hours), 0)::numeric(10,2)
  into v_outstanding_debt
  from public.project_debt_ledger dl
  where dl.project_id = p_project_id;

  v_debt_to_settle := least(greatest(v_outstanding_debt, 0), p_hours_added);

  insert into public.hour_purchases (
    project_id,
    customer_id,
    hours_added,
    stripe_checkout_session_id,
    amount_cents,
    currency,
    payment_method,
    admin_comment
  )
  values (
    p_project_id,
    p_customer_id,
    p_hours_added,
    p_checkout_session_id,
    p_amount_cents,
    p_currency,
    'stripe',
    'Post-paid purchase applied to project debt'
  );

  if v_debt_to_settle > 0 then
    insert into public.project_debt_ledger (
      project_id,
      event_type,
      hours,
      source_id,
      source_type,
      source_event_id,
      description
    )
    values (
      p_project_id,
      'payment_settlement',
      -v_debt_to_settle,
      null,
      'stripe_event',
      p_event_id,
      'Stripe checkout ' || coalesce(p_checkout_session_id, p_event_id) || ' settled ' || v_debt_to_settle || 'h of post-paid debt'
    );
  end if;

  insert into public.processed_stripe_events (event_id)
  values (p_event_id);

  return true;
end;
$$;

revoke execute on function public.apply_debt_first_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from public;
revoke execute on function public.apply_debt_first_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from anon;
revoke execute on function public.apply_debt_first_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from authenticated;

create or replace function public.apply_manual_hour_adjustment(
  p_project_id uuid,
  p_customer_id uuid,
  p_hours_added numeric,
  p_admin_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_billing_mode public.billing_mode;
  v_current_assigned_hours numeric(10,2);
  v_outstanding_debt numeric(10,2);
  v_debt_delta numeric(10,2);
  v_admin_comment text;
  purchase_id uuid;
begin
  if p_hours_added = 0 then
    raise exception 'invalid_hours_adjustment';
  end if;

  v_admin_comment := nullif(btrim(coalesce(p_admin_comment, '')), '');

  select p.billing_mode, p.assigned_hours
  into v_billing_mode, v_current_assigned_hours
  from public.projects p
  where p.id = p_project_id
    and p.customer_id = p_customer_id
  limit 1;

  if v_billing_mode is null then
    raise exception 'project_customer_mismatch';
  end if;

  if v_billing_mode = 'postpaid' then
    select coalesce(sum(dl.hours), 0)::numeric(10,2)
    into v_outstanding_debt
    from public.project_debt_ledger dl
    where dl.project_id = p_project_id;

    if p_hours_added > 0 then
      v_debt_delta := -least(greatest(v_outstanding_debt, 0), p_hours_added);
    else
      v_debt_delta := -p_hours_added;
    end if;

    if v_debt_delta <> 0 then
      insert into public.project_debt_ledger (
        project_id,
        event_type,
        hours,
        source_id,
        source_type,
        source_event_id,
        description
      )
      values (
        p_project_id,
        'payment_settlement',
        v_debt_delta,
        null,
        'manual_adjustment',
        null,
        coalesce(v_admin_comment, 'Manual post-paid adjustment')
      );
    end if;
  else
    if v_current_assigned_hours + p_hours_added < 0 then
      raise exception 'project_hours_negative';
    end if;

    update public.projects
    set assigned_hours = assigned_hours + p_hours_added
    where id = p_project_id
      and customer_id = p_customer_id;
  end if;

  insert into public.hour_purchases (
    project_id,
    customer_id,
    hours_added,
    stripe_checkout_session_id,
    amount_cents,
    currency,
    payment_method,
    admin_comment
  )
  values (
    p_project_id,
    p_customer_id,
    p_hours_added,
    null,
    null,
    null,
    'manual',
    v_admin_comment
  )
  returning id into purchase_id;

  return purchase_id;
end;
$$;

revoke execute on function public.apply_manual_hour_adjustment(uuid, uuid, numeric, text) from public;
revoke execute on function public.apply_manual_hour_adjustment(uuid, uuid, numeric, text) from anon;
revoke execute on function public.apply_manual_hour_adjustment(uuid, uuid, numeric, text) from authenticated;
