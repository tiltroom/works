-- Debt-first hour purchase: settles outstanding project debt before crediting prepaid hours
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
  v_prepaid_credit numeric(10,2);
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

  v_debt_to_settle := least(v_outstanding_debt, p_hours_added);
  v_prepaid_credit := p_hours_added - v_debt_to_settle;

  if v_debt_to_settle > 0 then
    insert into public.project_debt_ledger (
      project_id, event_type, hours, source_id, source_type, source_event_id, description
    )
    values (
      p_project_id,
      'payment_settlement',
      -v_debt_to_settle,
      null,
      'stripe_event',
      p_event_id,
      'Stripe settlement from checkout ' || coalesce(p_checkout_session_id, p_event_id)
    );
  end if;

  if v_prepaid_credit > 0 then
    insert into public.hour_purchases (
      project_id, customer_id, hours_added,
      stripe_checkout_session_id, amount_cents, currency,
      payment_method, admin_comment
    )
    values (
      p_project_id, p_customer_id, v_prepaid_credit,
      p_checkout_session_id, p_amount_cents, p_currency,
      'stripe',
      'Debt-first purchase: ' || v_prepaid_credit || 'h credit after ' || v_debt_to_settle || 'h debt settlement'
    );

    update public.projects
    set assigned_hours = assigned_hours + v_prepaid_credit
    where id = p_project_id
      and customer_id = p_customer_id;

    if not found then
      raise exception 'project_customer_mismatch';
    end if;
  end if;

  insert into public.processed_stripe_events (event_id)
  values (p_event_id);

  return true;
end;
$$;

revoke execute on function public.apply_debt_first_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from public;
revoke execute on function public.apply_debt_first_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from anon;
revoke execute on function public.apply_debt_first_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from authenticated;
