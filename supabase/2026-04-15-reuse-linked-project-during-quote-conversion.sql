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
  new_project_id := quote_row.linked_project_id;

  if new_project_id is null then
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
  end if;

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

create or replace function public.apply_postpaid_quote_conversion(
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
  new_project_id uuid;
  has_prepayment_activity boolean;
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

  if quote_row.billing_mode <> 'postpaid' then
    raise exception 'quote_not_postpaid';
  end if;

  select exists (
    select 1
    from public.quote_prepayment_sessions pps
    where pps.quote_id = p_quote_id
      and pps.status in ('pending', 'paid')
  )
  into has_prepayment_activity;

  if has_prepayment_activity then
    raise exception 'quote_has_prepayment_activity';
  end if;

  new_project_id := quote_row.linked_project_id;

  if new_project_id is null then
    insert into public.projects (
      name,
      description,
      customer_id,
      assigned_hours,
      billing_mode
    )
    values (
      quote_row.title,
      nullif(btrim(coalesce(quote_row.description, '')), ''),
      quote_row.customer_id,
      0,
      'postpaid'
    )
    returning id into new_project_id;
  else
    update public.projects p
    set name = quote_row.title,
        description = nullif(btrim(coalesce(quote_row.description, '')), ''),
        customer_id = quote_row.customer_id,
        billing_mode = 'postpaid'
    where p.id = new_project_id;

    if not found then
      raise exception 'project_customer_mismatch';
    end if;
  end if;

  insert into public.project_workers (project_id, worker_id)
  select new_project_id, qw.worker_id
  from public.quote_workers qw
  where qw.quote_id = p_quote_id
  on conflict (project_id, worker_id) do nothing;

  update public.quotes q
  set status = 'converted',
      linked_project_id = new_project_id,
      converted_at = now(),
      updated_at = now()
  where q.id = p_quote_id;

  return new_project_id;
end;
$$;

revoke execute on function public.convert_quote_to_project_core(uuid, uuid, numeric, text, text, integer, text, text) from public;
revoke execute on function public.convert_quote_to_project_core(uuid, uuid, numeric, text, text, integer, text, text) from anon;
revoke execute on function public.convert_quote_to_project_core(uuid, uuid, numeric, text, text, integer, text, text) from authenticated;
revoke execute on function public.apply_postpaid_quote_conversion(uuid, text) from public;
revoke execute on function public.apply_postpaid_quote_conversion(uuid, text) from anon;
revoke execute on function public.apply_postpaid_quote_conversion(uuid, text) from authenticated;
