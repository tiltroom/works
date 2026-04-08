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
  select new_project_id, pw.worker_id
  from public.quote_workers pw
  where pw.quote_id = p_quote_id
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
    estimated_hours_to_credit,
    p_checkout_session_id,
    p_amount_cents,
    p_currency,
    'stripe',
    format('Quote conversion %s', p_quote_id::text)
  );

  update public.projects p
  set assigned_hours = p.assigned_hours + estimated_hours_to_credit
  where p.id = new_project_id
    and p.customer_id = p_customer_id;

  if not found then
    raise exception 'project_customer_mismatch';
  end if;

  update public.quotes p
  set status = 'converted',
      linked_project_id = new_project_id,
      converted_at = now(),
      updated_at = now()
  where p.id = p_quote_id;

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
