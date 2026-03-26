alter table public.hour_purchases
  alter column stripe_checkout_session_id drop not null,
  alter column amount_cents drop not null,
  alter column currency drop not null;

alter table public.hour_purchases
  add column if not exists payment_method text,
  add column if not exists admin_comment text;

update public.hour_purchases
set payment_method = 'stripe'
where payment_method is null;

alter table public.hour_purchases
  alter column payment_method set default 'stripe',
  alter column payment_method set not null;

alter table public.hour_purchases
  drop constraint if exists hour_purchases_hours_added_check,
  drop constraint if exists hour_purchases_hours_added_nonzero,
  drop constraint if exists hour_purchases_payment_method_check,
  drop constraint if exists hour_purchases_payment_fields_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hour_purchases_payment_method_check'
      and conrelid = 'public.hour_purchases'::regclass
  ) then
    alter table public.hour_purchases
      add constraint hour_purchases_payment_method_check
      check (payment_method in ('stripe', 'manual'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hour_purchases_hours_added_nonzero'
      and conrelid = 'public.hour_purchases'::regclass
  ) then
    alter table public.hour_purchases
      add constraint hour_purchases_hours_added_nonzero
      check (hours_added <> 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hour_purchases_payment_fields_check'
      and conrelid = 'public.hour_purchases'::regclass
  ) then
    alter table public.hour_purchases
      add constraint hour_purchases_payment_fields_check
      check (
        (
          payment_method = 'stripe'
          and hours_added > 0
          and stripe_checkout_session_id is not null
          and amount_cents is not null
          and currency is not null
        )
        or
        (
          payment_method = 'manual'
          and stripe_checkout_session_id is null
          and amount_cents is null
          and currency is null
        )
      );
  end if;
end
$$;

create or replace function public.apply_hour_purchase(
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
begin
  if exists (
    select 1 from public.processed_stripe_events pse where pse.event_id = p_event_id
  ) then
    return false;
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
    p_checkout_session_id,
    p_amount_cents,
    p_currency,
    'stripe',
    null
  );

  update public.projects
  set assigned_hours = assigned_hours + p_hours_added
  where id = p_project_id
    and customer_id = p_customer_id;

  if not found then
    raise exception 'project_customer_mismatch';
  end if;

  insert into public.processed_stripe_events (event_id)
  values (p_event_id);

  return true;
end;
$$;

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
  current_assigned_hours numeric(10,2);
  purchase_id uuid;
begin
  if p_hours_added = 0 then
    raise exception 'invalid_hours_adjustment';
  end if;

  select p.assigned_hours
  into current_assigned_hours
  from public.projects p
  where p.id = p_project_id
    and p.customer_id = p_customer_id
  limit 1;

  if current_assigned_hours is null then
    raise exception 'project_customer_mismatch';
  end if;

  if current_assigned_hours + p_hours_added < 0 then
    raise exception 'project_hours_negative';
  end if;

  update public.projects
  set assigned_hours = assigned_hours + p_hours_added
  where id = p_project_id
    and customer_id = p_customer_id;

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
    nullif(btrim(coalesce(p_admin_comment, '')), '')
  )
  returning id into purchase_id;

  return purchase_id;
end;
$$;

revoke execute on function public.apply_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from public;
revoke execute on function public.apply_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from anon;
revoke execute on function public.apply_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from authenticated;
revoke execute on function public.apply_manual_hour_adjustment(uuid, uuid, numeric, text) from public;
revoke execute on function public.apply_manual_hour_adjustment(uuid, uuid, numeric, text) from anon;
revoke execute on function public.apply_manual_hour_adjustment(uuid, uuid, numeric, text) from authenticated;
