do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'quote_status'
  ) then
    create type public.quote_status as enum ('draft', 'signed', 'converted');
  end if;
end
$$;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  content_html text,
  content_json jsonb,
  status public.quote_status not null default 'draft',
  total_estimated_hours numeric(10,2) not null default 0,
  total_logged_hours numeric(10,2) not null default 0,
  signed_by_name text,
  signed_at timestamptz,
  signed_by_user_id uuid references public.profiles(id) on delete set null,
  linked_project_id uuid unique references public.projects(id) on delete set null,
  converted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_total_estimated_non_negative check (total_estimated_hours >= 0),
  constraint quotes_total_logged_non_negative check (total_logged_hours >= 0),
  constraint quotes_status_signature_check
    check (
      (
        status = 'draft'
        and signed_by_name is null
        and signed_at is null
        and linked_project_id is null
        and converted_at is null
      )
      or (
        status = 'signed'
        and nullif(btrim(coalesce(signed_by_name, '')), '') is not null
        and signed_at is not null
        and linked_project_id is null
        and converted_at is null
      )
      or (
        status = 'converted'
        and nullif(btrim(coalesce(signed_by_name, '')), '') is not null
        and signed_at is not null
        and linked_project_id is not null
        and converted_at is not null
      )
    )
);

create table if not exists public.quote_workers (
  quote_id uuid not null references public.quotes(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id) on delete set null,
  primary key (quote_id, worker_id)
);

create table if not exists public.quote_subtasks (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  title text not null,
  description text,
  estimated_hours numeric(10,2) not null default 0,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_subtasks_estimated_non_negative check (estimated_hours >= 0)
);

create table if not exists public.quote_subtask_entries (
  id uuid primary key default gen_random_uuid(),
  quote_subtask_id uuid not null references public.quote_subtasks(id) on delete cascade,
  worker_id uuid references public.profiles(id) on delete set null,
  logged_hours numeric(10,2) not null,
  note text,
  created_at timestamptz not null default now(),
  constraint quote_subtask_entries_logged_positive check (logged_hours > 0)
);

create table if not exists public.quote_comments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_role public.app_role not null,
  comment_html text,
  comment_json jsonb,
  created_at timestamptz not null default now(),
  constraint quote_comments_content_required
    check (
      nullif(btrim(coalesce(comment_html, '')), '') is not null
      or comment_json is not null
    )
);

create table if not exists public.quote_prepayment_sessions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  estimated_hours_snapshot numeric(10,2) not null,
  amount_cents integer not null,
  currency text not null,
  status text not null default 'pending',
  stripe_event_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint quote_prepayment_hours_positive check (estimated_hours_snapshot > 0),
  constraint quote_prepayment_amount_positive check (amount_cents > 0),
  constraint quote_prepayment_status_check check (status in ('pending', 'paid')),
  constraint quote_prepayment_paid_consistency
    check (
      (status = 'pending' and paid_at is null)
      or (status = 'paid' and paid_at is not null)
    )
);

create or replace function public.set_updated_at_now()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_quote_worker(p_uid uuid, p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quote_workers pw
    where pw.quote_id = p_quote_id
      and pw.worker_id = p_uid
  );
$$;

create or replace function public.refresh_quote_totals(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  estimated_total numeric(10,2);
  logged_total numeric(10,2);
begin
  select coalesce(sum(ps.estimated_hours), 0)::numeric(10,2)
  into estimated_total
  from public.quote_subtasks ps
  where ps.quote_id = p_quote_id;

  select coalesce(sum(pse.logged_hours), 0)::numeric(10,2)
  into logged_total
  from public.quote_subtask_entries pse
  join public.quote_subtasks ps on ps.id = pse.quote_subtask_id
  where ps.quote_id = p_quote_id;

  update public.quotes p
  set total_estimated_hours = estimated_total,
      total_logged_hours = logged_total,
      updated_at = now()
  where p.id = p_quote_id;
end;
$$;

create or replace function public.quote_subtasks_refresh_totals_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote_id uuid;
begin
  target_quote_id := coalesce(new.quote_id, old.quote_id);
  perform public.refresh_quote_totals(target_quote_id);
  return coalesce(new, old);
end;
$$;

create or replace function public.quote_entries_refresh_totals_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_quote_id uuid;
  old_quote_id uuid;
begin
  if tg_op <> 'DELETE' then
    select ps.quote_id
    into new_quote_id
    from public.quote_subtasks ps
    where ps.id = new.quote_subtask_id;
  end if;

  if tg_op <> 'INSERT' then
    select ps.quote_id
    into old_quote_id
    from public.quote_subtasks ps
    where ps.id = old.quote_subtask_id;
  end if;

  if new_quote_id is not null then
    perform public.refresh_quote_totals(new_quote_id);
  end if;

  if old_quote_id is not null and old_quote_id <> new_quote_id then
    perform public.refresh_quote_totals(old_quote_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.assert_quote_is_draft(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status public.quote_status;
begin
  select p.status
  into current_status
  from public.quotes p
  where p.id = p_quote_id;

  if current_status is null then
    raise exception 'quote_not_found';
  end if;

  if current_status <> 'draft' then
    raise exception 'quote_not_editable';
  end if;
end;
$$;

create or replace function public.quote_subtasks_require_draft_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_quote_is_draft(coalesce(new.quote_id, old.quote_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.quote_comments_require_draft_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_quote_is_draft(coalesce(new.quote_id, old.quote_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.quote_entries_require_draft_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote_id uuid;
begin
  select ps.quote_id
  into target_quote_id
  from public.quote_subtasks ps
  where ps.id = coalesce(new.quote_subtask_id, old.quote_subtask_id);

  perform public.assert_quote_is_draft(target_quote_id);
  return coalesce(new, old);
end;
$$;

create or replace function public.quote_workers_require_draft_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_quote_is_draft(coalesce(new.quote_id, old.quote_id));
  return coalesce(new, old);
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
  project_id uuid;
  estimated_hours_to_credit numeric(10,2);
begin
  if exists (
    select 1
    from public.processed_stripe_events pse
    where pse.event_id = p_event_id
  ) then
    select p.linked_project_id
    into project_id
    from public.quotes p
    where p.id = p_quote_id;

    return project_id;
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
  returning id into project_id;

  insert into public.project_workers (project_id, worker_id)
  select project_id, pw.worker_id
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
    project_id,
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
  where p.id = project_id
    and p.customer_id = p_customer_id;

  if not found then
    raise exception 'project_customer_mismatch';
  end if;

  update public.quotes p
  set status = 'converted',
      linked_project_id = project_id,
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

  return project_id;
end;
$$;

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
before update on public.quotes
for each row
execute procedure public.set_updated_at_now();

drop trigger if exists quote_subtasks_set_updated_at on public.quote_subtasks;
create trigger quote_subtasks_set_updated_at
before update on public.quote_subtasks
for each row
execute procedure public.set_updated_at_now();

drop trigger if exists quote_subtasks_require_draft on public.quote_subtasks;
create trigger quote_subtasks_require_draft
before insert or update or delete on public.quote_subtasks
for each row
execute procedure public.quote_subtasks_require_draft_trigger();

drop trigger if exists quote_subtasks_refresh_totals on public.quote_subtasks;
create trigger quote_subtasks_refresh_totals
after insert or update or delete on public.quote_subtasks
for each row
execute procedure public.quote_subtasks_refresh_totals_trigger();

drop trigger if exists quote_entries_require_draft on public.quote_subtask_entries;
create trigger quote_entries_require_draft
before insert or update or delete on public.quote_subtask_entries
for each row
execute procedure public.quote_entries_require_draft_trigger();

drop trigger if exists quote_entries_refresh_totals on public.quote_subtask_entries;
create trigger quote_entries_refresh_totals
after insert or update or delete on public.quote_subtask_entries
for each row
execute procedure public.quote_entries_refresh_totals_trigger();

drop trigger if exists quote_comments_require_draft on public.quote_comments;
create trigger quote_comments_require_draft
before insert or update or delete on public.quote_comments
for each row
execute procedure public.quote_comments_require_draft_trigger();

drop trigger if exists quote_workers_require_draft on public.quote_workers;
create trigger quote_workers_require_draft
before insert or update or delete on public.quote_workers
for each row
execute procedure public.quote_workers_require_draft_trigger();

alter table public.quotes enable row level security;
alter table public.quote_workers enable row level security;
alter table public.quote_subtasks enable row level security;
alter table public.quote_subtask_entries enable row level security;
alter table public.quote_comments enable row level security;
alter table public.quote_prepayment_sessions enable row level security;

drop policy if exists "quotes_select_related" on public.quotes;
create policy "quotes_select_related"
on public.quotes for select
to authenticated
using (
  public.is_admin(auth.uid())
  or customer_id = auth.uid()
  or public.is_quote_worker(auth.uid(), id)
);

drop policy if exists "quotes_insert_customer_or_admin" on public.quotes;
create policy "quotes_insert_customer_or_admin"
on public.quotes for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  or (
    customer_id = auth.uid()
    and (created_by is null or created_by = auth.uid())
    and status = 'draft'
  )
);

drop policy if exists "quotes_update_customer_or_admin" on public.quotes;
create policy "quotes_update_customer_or_admin"
on public.quotes for update
to authenticated
using (
  public.is_admin(auth.uid())
  or customer_id = auth.uid()
)
with check (
  public.is_admin(auth.uid())
  or customer_id = auth.uid()
);

drop policy if exists "quotes_delete_customer_or_admin" on public.quotes;
create policy "quotes_delete_customer_or_admin"
on public.quotes for delete
to authenticated
using (
  public.is_admin(auth.uid())
  or (customer_id = auth.uid() and status = 'draft')
);

drop policy if exists "quote_workers_select_related" on public.quote_workers;
create policy "quote_workers_select_related"
on public.quote_workers for select
to authenticated
using (
  public.is_admin(auth.uid())
  or worker_id = auth.uid()
  or exists (
    select 1
    from public.quotes p
    where p.id = quote_id
      and p.customer_id = auth.uid()
  )
);

drop policy if exists "quote_workers_manage_customer_or_admin" on public.quote_workers;
create policy "quote_workers_manage_customer_or_admin"
on public.quote_workers for all
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.quotes p
    where p.id = quote_id
      and p.customer_id = auth.uid()
  )
)
with check (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.quotes p
    where p.id = quote_id
      and p.customer_id = auth.uid()
  )
);

drop policy if exists "quote_subtasks_select_related" on public.quote_subtasks;
create policy "quote_subtasks_select_related"
on public.quote_subtasks for select
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.quotes p
    where p.id = quote_id
      and (
        p.customer_id = auth.uid()
        or public.is_quote_worker(auth.uid(), p.id)
      )
  )
);

drop policy if exists "quote_subtasks_manage_related" on public.quote_subtasks;
create policy "quote_subtasks_manage_related"
on public.quote_subtasks for all
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.quotes p
    where p.id = quote_id
      and (
        p.customer_id = auth.uid()
        or public.is_quote_worker(auth.uid(), p.id)
      )
  )
)
with check (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.quotes p
    where p.id = quote_id
      and (
        p.customer_id = auth.uid()
        or public.is_quote_worker(auth.uid(), p.id)
      )
  )
);

drop policy if exists "quote_entries_select_related" on public.quote_subtask_entries;
create policy "quote_entries_select_related"
on public.quote_subtask_entries for select
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.quote_subtasks ps
    join public.quotes p on p.id = ps.quote_id
    where ps.id = quote_subtask_id
      and (
        p.customer_id = auth.uid()
        or public.is_quote_worker(auth.uid(), p.id)
      )
  )
);

drop policy if exists "quote_entries_insert_worker_or_admin" on public.quote_subtask_entries;
create policy "quote_entries_insert_worker_or_admin"
on public.quote_subtask_entries for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  or (
    worker_id = auth.uid()
    and exists (
      select 1
      from public.quote_subtasks ps
      join public.quotes p on p.id = ps.quote_id
      where ps.id = quote_subtask_id
        and public.is_quote_worker(auth.uid(), p.id)
    )
  )
);

drop policy if exists "quote_entries_update_owner_or_admin" on public.quote_subtask_entries;
create policy "quote_entries_update_owner_or_admin"
on public.quote_subtask_entries for update
to authenticated
using (
  public.is_admin(auth.uid())
  or worker_id = auth.uid()
)
with check (
  public.is_admin(auth.uid())
  or worker_id = auth.uid()
);

drop policy if exists "quote_entries_delete_owner_or_admin" on public.quote_subtask_entries;
create policy "quote_entries_delete_owner_or_admin"
on public.quote_subtask_entries for delete
to authenticated
using (
  public.is_admin(auth.uid())
  or worker_id = auth.uid()
);

drop policy if exists "quote_comments_select_related" on public.quote_comments;
create policy "quote_comments_select_related"
on public.quote_comments for select
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.quotes p
    where p.id = quote_id
      and (
        p.customer_id = auth.uid()
        or public.is_quote_worker(auth.uid(), p.id)
      )
  )
);

drop policy if exists "quote_comments_insert_related" on public.quote_comments;
create policy "quote_comments_insert_related"
on public.quote_comments for insert
to authenticated
with check (
  author_id = auth.uid()
  and (
    public.is_admin(auth.uid())
    or exists (
      select 1
      from public.quotes p
      where p.id = quote_id
        and (
          p.customer_id = auth.uid()
          or public.is_quote_worker(auth.uid(), p.id)
        )
    )
  )
);

drop policy if exists "quote_comments_update_owner_or_admin" on public.quote_comments;
create policy "quote_comments_update_owner_or_admin"
on public.quote_comments for update
to authenticated
using (
  public.is_admin(auth.uid())
  or author_id = auth.uid()
)
with check (
  public.is_admin(auth.uid())
  or author_id = auth.uid()
);

drop policy if exists "quote_comments_delete_owner_or_admin" on public.quote_comments;
create policy "quote_comments_delete_owner_or_admin"
on public.quote_comments for delete
to authenticated
using (
  public.is_admin(auth.uid())
  or author_id = auth.uid()
);

drop policy if exists "quote_prepayment_select_related" on public.quote_prepayment_sessions;
create policy "quote_prepayment_select_related"
on public.quote_prepayment_sessions for select
to authenticated
using (
  public.is_admin(auth.uid())
  or customer_id = auth.uid()
);

drop policy if exists "quote_prepayment_insert_customer_or_admin" on public.quote_prepayment_sessions;
create policy "quote_prepayment_insert_customer_or_admin"
on public.quote_prepayment_sessions for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  or (
    customer_id = auth.uid()
    and exists (
      select 1
      from public.quotes p
      where p.id = quote_id
        and p.customer_id = auth.uid()
        and p.status = 'signed'
        and p.linked_project_id is null
    )
  )
);

create index if not exists idx_quotes_customer_id on public.quotes (customer_id);
create index if not exists idx_quotes_status on public.quotes (status);
create index if not exists idx_quote_workers_worker_id on public.quote_workers (worker_id);
create index if not exists idx_quote_subtasks_quote_id on public.quote_subtasks (quote_id);
create index if not exists idx_quote_subtask_entries_subtask_id on public.quote_subtask_entries (quote_subtask_id);
create index if not exists idx_quote_comments_quote_id on public.quote_comments (quote_id);
create index if not exists idx_quote_prepayment_quote_id on public.quote_prepayment_sessions (quote_id);

revoke execute on function public.refresh_quote_totals(uuid) from public;
revoke execute on function public.refresh_quote_totals(uuid) from anon;
revoke execute on function public.refresh_quote_totals(uuid) from authenticated;
revoke execute on function public.assert_quote_is_draft(uuid) from public;
revoke execute on function public.assert_quote_is_draft(uuid) from anon;
revoke execute on function public.assert_quote_is_draft(uuid) from authenticated;
revoke execute on function public.apply_quote_conversion_payment(text, uuid, uuid, text, integer, text) from public;
revoke execute on function public.apply_quote_conversion_payment(text, uuid, uuid, text, integer, text) from anon;
revoke execute on function public.apply_quote_conversion_payment(text, uuid, uuid, text, integer, text) from authenticated;
