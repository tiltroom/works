create or replace function public.convert_quote_to_project_core(
  p_quote_id uuid,
  p_customer_id uuid,
  p_hours_added numeric,
  p_payment_method text,
  p_checkout_session_id text default null,
  p_amount_cents integer default null,
  p_currency text default null,
  p_admin_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quotes%rowtype;
  new_project_id uuid;
  normalized_comment text;
begin
  if p_payment_method not in ('stripe', 'manual') then
    raise exception 'invalid_payment_method';
  end if;

  select *
  into quote_row
  from public.quotes q
  where q.id = p_quote_id
  for update;

  if not found then
    raise exception 'quote_not_found';
  end if;

  if quote_row.customer_id <> p_customer_id then
    raise exception 'quote_customer_mismatch';
  end if;

  if quote_row.status = 'converted' then
    return quote_row.linked_project_id;
  end if;

  if quote_row.status <> 'signed' then
    raise exception 'quote_not_signed';
  end if;

  if p_hours_added <= 0 then
    raise exception 'quote_invalid_hours';
  end if;

  normalized_comment := nullif(btrim(coalesce(p_admin_comment, '')), '');

  insert into public.projects (
    name,
    description,
    customer_id,
    assigned_hours
  )
  values (
    quote_row.title,
    nullif(btrim(coalesce(quote_row.description, '')), ''),
    p_customer_id,
    0
  )
  returning id into new_project_id;

  insert into public.project_workers (project_id, worker_id)
  select new_project_id, qw.worker_id
  from public.quote_workers qw
  where qw.quote_id = p_quote_id
  on conflict (project_id, worker_id) do nothing;

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
    new_project_id,
    p_customer_id,
    p_hours_added,
    p_checkout_session_id,
    p_amount_cents,
    p_currency,
    p_payment_method,
    normalized_comment
  );

  update public.projects p
  set assigned_hours = p.assigned_hours + p_hours_added
  where p.id = new_project_id
    and p.customer_id = p_customer_id;

  if not found then
    raise exception 'project_customer_mismatch';
  end if;

  update public.quotes q
  set status = 'converted',
      linked_project_id = new_project_id,
      converted_at = now(),
      updated_at = now()
  where q.id = p_quote_id;

  return new_project_id;
end;
$$;

create or replace function public.apply_quote_conversion_payment(
  p_event_id text,
  p_quote_id uuid,
  p_customer_id uuid,
  p_checkout_session_id text,
  p_amount_cents integer,
  p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quotes%rowtype;
  prepayment_row public.quote_prepayment_sessions%rowtype;
  new_project_id uuid;
  estimated_hours_to_credit numeric(10,2);
begin
  if exists (
    select 1
    from public.processed_stripe_events pse
    where pse.event_id = p_event_id
  ) then
    select p.linked_project_id
    into new_project_id
    from public.quotes p
    where p.id = p_quote_id;

    return new_project_id;
  end if;

  select *
  into quote_row
  from public.quotes p
  where p.id = p_quote_id
  for update;

  if not found then
    raise exception 'quote_not_found';
  end if;

  if quote_row.customer_id <> p_customer_id then
    raise exception 'quote_customer_mismatch';
  end if;

  select *
  into prepayment_row
  from public.quote_prepayment_sessions pps
  where pps.quote_id = p_quote_id
    and pps.customer_id = p_customer_id
    and pps.stripe_checkout_session_id = p_checkout_session_id
  for update;

  if not found then
    raise exception 'quote_prepayment_not_found';
  end if;

  if prepayment_row.amount_cents <> p_amount_cents
    or lower(prepayment_row.currency) <> lower(p_currency) then
    raise exception 'quote_prepayment_mismatch';
  end if;

  if prepayment_row.status = 'paid' then
    insert into public.processed_stripe_events (event_id)
    values (p_event_id);

    return quote_row.linked_project_id;
  end if;

  if quote_row.status = 'converted' then
    update public.quote_prepayment_sessions
    set status = 'paid',
        paid_at = coalesce(prepayment_row.paid_at, now()),
        stripe_event_id = p_event_id
    where id = prepayment_row.id;

    insert into public.processed_stripe_events (event_id)
    values (p_event_id);

    return quote_row.linked_project_id;
  end if;

  if quote_row.status <> 'signed' then
    raise exception 'quote_not_signed';
  end if;

  estimated_hours_to_credit := prepayment_row.estimated_hours_snapshot;

  if estimated_hours_to_credit <= 0 then
    raise exception 'quote_invalid_hours';
  end if;

  new_project_id := public.convert_quote_to_project_core(
    p_quote_id => p_quote_id,
    p_customer_id => p_customer_id,
    p_hours_added => estimated_hours_to_credit,
    p_payment_method => 'stripe',
    p_checkout_session_id => p_checkout_session_id,
    p_amount_cents => p_amount_cents,
    p_currency => p_currency,
    p_admin_comment => format('Quote conversion %s', p_quote_id::text)
  );

  update public.quote_prepayment_sessions pps
  set status = 'paid',
      paid_at = now(),
      stripe_event_id = p_event_id
  where pps.id = prepayment_row.id;

  insert into public.processed_stripe_events (event_id)
  values (p_event_id);

  return new_project_id;
end;
$$;

create or replace function public.apply_manual_quote_conversion(
  p_quote_id uuid,
  p_admin_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quotes%rowtype;
  prepayment_exists boolean;
  manual_comment text;
begin
  select *
  into quote_row
  from public.quotes q
  where q.id = p_quote_id
  for update;

  if not found then
    raise exception 'quote_not_found';
  end if;

  if quote_row.status = 'converted' then
    return quote_row.linked_project_id;
  end if;

  if quote_row.status <> 'signed' then
    raise exception 'quote_not_signed';
  end if;

  if quote_row.total_estimated_hours <= 0 then
    raise exception 'quote_invalid_hours';
  end if;

  select exists (
    select 1
    from public.quote_prepayment_sessions pps
    where pps.quote_id = p_quote_id
      and pps.status in ('pending', 'paid')
  )
  into prepayment_exists;

  if prepayment_exists then
    raise exception 'quote_has_prepayment_activity';
  end if;

  manual_comment := format(
    'Manual quote conversion %s%s',
    p_quote_id::text,
    case
      when nullif(btrim(coalesce(p_admin_comment, '')), '') is null then ''
      else ': ' || nullif(btrim(coalesce(p_admin_comment, '')), '')
    end
  );

  return public.convert_quote_to_project_core(
    p_quote_id => p_quote_id,
    p_customer_id => quote_row.customer_id,
    p_hours_added => quote_row.total_estimated_hours,
    p_payment_method => 'manual',
    p_admin_comment => manual_comment
  );
end;
$$;

revoke execute on function public.convert_quote_to_project_core(uuid, uuid, numeric, text, text, integer, text, text) from public;
revoke execute on function public.convert_quote_to_project_core(uuid, uuid, numeric, text, text, integer, text, text) from anon;
revoke execute on function public.convert_quote_to_project_core(uuid, uuid, numeric, text, text, integer, text, text) from authenticated;
revoke execute on function public.apply_manual_quote_conversion(uuid, text) from public;
revoke execute on function public.apply_manual_quote_conversion(uuid, text) from anon;
revoke execute on function public.apply_manual_quote_conversion(uuid, text) from authenticated;
