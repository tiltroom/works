alter table public.time_entries
  add column if not exists quote_subtask_entry_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_entries_quote_subtask_entry_id_fkey'
      and conrelid = 'public.time_entries'::regclass
  ) then
    alter table public.time_entries
      add constraint time_entries_quote_subtask_entry_id_fkey
      foreign key (quote_subtask_entry_id)
      references public.quote_subtask_entries(id)
      on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_entries_quote_subtask_entry_unique'
      and conrelid = 'public.time_entries'::regclass
  ) then
    alter table public.time_entries
      add constraint time_entries_quote_subtask_entry_unique
      unique (quote_subtask_entry_id);
  end if;
end
$$;

create index if not exists idx_time_entries_quote_subtask_entry_id
on public.time_entries (quote_subtask_entry_id)
where quote_subtask_entry_id is not null;

drop policy if exists "time_entries_insert_worker_or_admin" on public.time_entries;
create policy "time_entries_insert_worker_or_admin"
on public.time_entries for insert
to authenticated
with check (
  quote_subtask_entry_id is null
  and (
    public.is_admin(auth.uid())
    or (
      worker_id = auth.uid()
      and exists (
        select 1 from public.project_workers pw
        where pw.project_id = project_id and pw.worker_id = auth.uid()
      )
    )
  )
);

drop policy if exists "time_entries_update_owner_or_admin" on public.time_entries;
create policy "time_entries_update_owner_or_admin"
on public.time_entries for update
to authenticated
using (
  quote_subtask_entry_id is null
  and (public.is_admin(auth.uid()) or worker_id = auth.uid())
)
with check (
  quote_subtask_entry_id is null
  and (public.is_admin(auth.uid()) or worker_id = auth.uid())
);

drop policy if exists "time_entries_delete_owner_or_admin" on public.time_entries;
create policy "time_entries_delete_owner_or_admin"
on public.time_entries for delete
to authenticated
using (
  quote_subtask_entry_id is null
  and (public.is_admin(auth.uid()) or worker_id = auth.uid())
);

create or replace function public.prevent_time_entry_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ended_at is null or new.quote_subtask_entry_id is not null then
    return new;
  end if;

  if exists (
    select 1
    from public.time_entries te
    where te.worker_id = new.worker_id
      and te.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and te.quote_subtask_entry_id is null
      and te.ended_at is not null
      and tstzrange(te.started_at, te.ended_at, '[)') && tstzrange(new.started_at, new.ended_at, '[)')
  ) then
    raise exception 'time_entry_overlap';
  end if;

  return new;
end;
$$;

create or replace function public.copy_quote_subtask_entries_to_project(
  p_quote_id uuid,
  p_project_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.time_entries (
    project_id,
    worker_id,
    started_at,
    ended_at,
    description,
    source,
    quote_subtask_entry_id
  )
  select
    p_project_id,
    qse.worker_id,
    qse.created_at - (qse.logged_hours::double precision * interval '1 hour'),
    qse.created_at,
    concat_ws(
      E'\n\n',
      'Quote subtask: ' || qs.title,
      nullif(btrim(coalesce(qse.note, '')), '')
    ),
    'manual',
    qse.id
  from public.quote_subtask_entries qse
  join public.quote_subtasks qs on qs.id = qse.quote_subtask_id
  where qs.quote_id = p_quote_id
    and qse.worker_id is not null
  on conflict (quote_subtask_entry_id) do update
  set project_id = excluded.project_id,
      worker_id = excluded.worker_id,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      description = excluded.description,
      source = excluded.source;
$$;

select public.copy_quote_subtask_entries_to_project(q.id, q.linked_project_id)
from public.quotes q
where q.status = 'converted'
  and q.linked_project_id is not null;

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
    if quote_row.linked_project_id is not null then
      perform public.copy_quote_subtask_entries_to_project(p_quote_id, quote_row.linked_project_id);
    end if;

    return quote_row.linked_project_id;
  end if;

  if quote_row.status <> 'signed' then
    raise exception 'quote_not_signed';
  end if;

  if quote_row.customer_signed_at is null or nullif(btrim(coalesce(quote_row.customer_signed_by_name, '')), '') is null then
    raise exception 'quote_not_customer_signed';
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

  perform public.copy_quote_subtask_entries_to_project(p_quote_id, new_project_id);

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
    if quote_row.linked_project_id is not null then
      perform public.copy_quote_subtask_entries_to_project(p_quote_id, quote_row.linked_project_id);
    end if;

    return quote_row.linked_project_id;
  end if;

  if quote_row.status <> 'signed' then
    raise exception 'quote_not_signed';
  end if;

  if quote_row.customer_signed_at is null or nullif(btrim(coalesce(quote_row.customer_signed_by_name, '')), '') is null then
    raise exception 'quote_not_customer_signed';
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

  perform public.copy_quote_subtask_entries_to_project(p_quote_id, new_project_id);

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

    if new_project_id is not null then
      perform public.copy_quote_subtask_entries_to_project(p_quote_id, new_project_id);
    end if;

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
    if quote_row.linked_project_id is not null then
      perform public.copy_quote_subtask_entries_to_project(p_quote_id, quote_row.linked_project_id);
    end if;

    insert into public.processed_stripe_events (event_id)
    values (p_event_id);

    return quote_row.linked_project_id;
  end if;

  if quote_row.status = 'converted' then
    if quote_row.linked_project_id is not null then
      perform public.copy_quote_subtask_entries_to_project(p_quote_id, quote_row.linked_project_id);
    end if;

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
    if quote_row.linked_project_id is not null then
      perform public.copy_quote_subtask_entries_to_project(p_quote_id, quote_row.linked_project_id);
    end if;

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

revoke execute on function public.copy_quote_subtask_entries_to_project(uuid, uuid) from public;
revoke execute on function public.copy_quote_subtask_entries_to_project(uuid, uuid) from anon;
revoke execute on function public.copy_quote_subtask_entries_to_project(uuid, uuid) from authenticated;
revoke execute on function public.convert_quote_to_project_core(uuid, uuid, numeric, text, text, integer, text, text) from public;
revoke execute on function public.convert_quote_to_project_core(uuid, uuid, numeric, text, text, integer, text, text) from anon;
revoke execute on function public.convert_quote_to_project_core(uuid, uuid, numeric, text, text, integer, text, text) from authenticated;
revoke execute on function public.apply_postpaid_quote_conversion(uuid, text) from public;
revoke execute on function public.apply_postpaid_quote_conversion(uuid, text) from anon;
revoke execute on function public.apply_postpaid_quote_conversion(uuid, text) from authenticated;
revoke execute on function public.apply_quote_conversion_payment(text, uuid, uuid, text, integer, text) from public;
revoke execute on function public.apply_quote_conversion_payment(text, uuid, uuid, text, integer, text) from anon;
revoke execute on function public.apply_quote_conversion_payment(text, uuid, uuid, text, integer, text) from authenticated;
revoke execute on function public.apply_manual_quote_conversion(uuid, text) from public;
revoke execute on function public.apply_manual_quote_conversion(uuid, text) from anon;
revoke execute on function public.apply_manual_quote_conversion(uuid, text) from authenticated;
revoke execute on function public.prevent_time_entry_overlap() from public;
revoke execute on function public.prevent_time_entry_overlap() from anon;
revoke execute on function public.prevent_time_entry_overlap() from authenticated;
