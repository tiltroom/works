create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'customer', 'worker');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'worker',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists custom_hourly_rate_cents integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_custom_hourly_rate_positive'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_custom_hourly_rate_positive
      check (custom_hourly_rate_cents is null or custom_hourly_rate_cents > 0);
  end if;
end
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  assigned_hours numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.project_workers (
  project_id uuid not null references public.projects(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (project_id, worker_id)
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz not null,
  ended_at timestamptz,
  description text,
  source text not null check (source in ('timer', 'manual')),
  created_at timestamptz not null default now(),
  constraint valid_time_range check (ended_at is null or ended_at > started_at)
);

create table if not exists public.hour_purchases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  hours_added numeric(10,2) not null check (hours_added > 0),
  stripe_checkout_session_id text not null unique,
  amount_cents integer not null,
  currency text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.processed_stripe_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role public.app_role not null,
  full_name text,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

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
    currency
  )
  values (
    p_project_id,
    p_customer_id,
    p_hours_added,
    p_checkout_session_id,
    p_amount_cents,
    p_currency
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_value public.app_role;
  invited_role public.app_role;
  invited_name text;
begin
  select i.role, i.full_name
  into invited_role, invited_name
  from public.invitations i
  where lower(i.email) = lower(new.email)
  limit 1;

  if invited_role is null then
    raise exception 'invite_required';
  end if;

  role_value := invited_role;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(invited_name, coalesce(new.raw_user_meta_data->>'full_name', '')),
    role_value
  )
  on conflict (id) do nothing;

  update public.invitations
  set accepted_at = now()
  where lower(email) = lower(new.email) and accepted_at is null;

  return new;
exception
  when invalid_text_representation then
    insert into public.profiles (id, full_name, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      'worker'
    )
    on conflict (id) do nothing;

    update public.invitations
    set accepted_at = now()
    where lower(email) = lower(new.email) and accepted_at is null;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid and p.role = 'admin'
  );
$$;

create or replace function public.is_invited(email_input text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invitations i
    where lower(i.email) = lower(email_input)
  );
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_workers enable row level security;
alter table public.time_entries enable row level security;
alter table public.hour_purchases enable row level security;
alter table public.invitations enable row level security;
alter table public.processed_stripe_events enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()))
with check (
  public.is_admin(auth.uid())
  or (
    id = auth.uid()
    and role = (
      select p.role from public.profiles p where p.id = auth.uid()
    )
  )
);

drop policy if exists "projects_select_related" on public.projects;
create policy "projects_select_related"
on public.projects for select
to authenticated
using (
  public.is_admin(auth.uid())
  or customer_id = auth.uid()
  or exists (
    select 1
    from public.project_workers pw
    where pw.project_id = id and pw.worker_id = auth.uid()
  )
);

drop policy if exists "projects_insert_admin" on public.projects;
create policy "projects_insert_admin"
on public.projects for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists "projects_update_admin" on public.projects;
create policy "projects_update_admin"
on public.projects for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "projects_delete_admin" on public.projects;
create policy "projects_delete_admin"
on public.projects for delete
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "project_workers_select_related" on public.project_workers;
create policy "project_workers_select_related"
on public.project_workers for select
to authenticated
using (
  public.is_admin(auth.uid())
  or worker_id = auth.uid()
);

drop policy if exists "project_workers_manage_admin" on public.project_workers;
create policy "project_workers_manage_admin"
on public.project_workers for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "time_entries_select_related" on public.time_entries;
create policy "time_entries_select_related"
on public.time_entries for select
to authenticated
using (
  public.is_admin(auth.uid())
  or worker_id = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = project_id and p.customer_id = auth.uid()
  )
);

drop policy if exists "time_entries_insert_worker_or_admin" on public.time_entries;
create policy "time_entries_insert_worker_or_admin"
on public.time_entries for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  or (
    worker_id = auth.uid()
    and exists (
      select 1 from public.project_workers pw
      where pw.project_id = project_id and pw.worker_id = auth.uid()
    )
  )
);

drop policy if exists "time_entries_update_owner_or_admin" on public.time_entries;
create policy "time_entries_update_owner_or_admin"
on public.time_entries for update
to authenticated
using (public.is_admin(auth.uid()) or worker_id = auth.uid())
with check (public.is_admin(auth.uid()) or worker_id = auth.uid());

drop policy if exists "time_entries_delete_owner_or_admin" on public.time_entries;
create policy "time_entries_delete_owner_or_admin"
on public.time_entries for delete
to authenticated
using (public.is_admin(auth.uid()) or worker_id = auth.uid());

drop policy if exists "hour_purchases_select_related" on public.hour_purchases;
create policy "hour_purchases_select_related"
on public.hour_purchases for select
to authenticated
using (
  public.is_admin(auth.uid())
  or customer_id = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = project_id and p.customer_id = auth.uid()
  )
);

drop policy if exists "hour_purchases_insert_admin_or_customer" on public.hour_purchases;
create policy "hour_purchases_insert_admin_or_customer"
on public.hour_purchases for insert
to authenticated
with check (public.is_admin(auth.uid()) or customer_id = auth.uid());

drop policy if exists "invitations_admin_select" on public.invitations;
create policy "invitations_admin_select"
on public.invitations for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "invitations_admin_insert" on public.invitations;
create policy "invitations_admin_insert"
on public.invitations for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists "invitations_admin_update" on public.invitations;
create policy "invitations_admin_update"
on public.invitations for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "processed_events_select_admin" on public.processed_stripe_events;
create policy "processed_events_select_admin"
on public.processed_stripe_events for select
to authenticated
using (public.is_admin(auth.uid()));

create index if not exists idx_projects_customer_id on public.projects (customer_id);
create index if not exists idx_project_workers_worker_id on public.project_workers (worker_id);
create index if not exists idx_time_entries_project_id on public.time_entries (project_id);
create index if not exists idx_time_entries_worker_id on public.time_entries (worker_id);
create index if not exists idx_hour_purchases_project_id on public.hour_purchases (project_id);
create index if not exists idx_invitations_email on public.invitations (lower(email));
create unique index if not exists idx_time_entries_single_open_timer
  on public.time_entries (worker_id)
  where ended_at is null;

create or replace function public.prevent_time_entry_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ended_at is null then
    return new;
  end if;

  if exists (
    select 1
    from public.time_entries te
    where te.worker_id = new.worker_id
      and te.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and te.ended_at is not null
      and tstzrange(te.started_at, te.ended_at, '[)') && tstzrange(new.started_at, new.ended_at, '[)')
  ) then
    raise exception 'time_entry_overlap';
  end if;

  return new;
end;
$$;

drop trigger if exists time_entries_no_overlap on public.time_entries;
create trigger time_entries_no_overlap
before insert or update on public.time_entries
for each row
execute procedure public.prevent_time_entry_overlap();

revoke execute on function public.apply_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from public;
revoke execute on function public.apply_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from anon;
revoke execute on function public.apply_hour_purchase(text, uuid, uuid, numeric, text, integer, text) from authenticated;
