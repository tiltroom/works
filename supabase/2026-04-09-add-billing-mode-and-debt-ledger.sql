-- billing_mode enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'billing_mode') then
    create type public.billing_mode as enum ('prepaid', 'postpaid');
  end if;
end
$$;

-- Add billing_mode to quotes (default prepaid for backward compat)
alter table public.quotes
  add column if not exists billing_mode public.billing_mode not null default 'prepaid';

-- Add billing_mode to projects (default prepaid for backward compat)
alter table public.projects
  add column if not exists billing_mode public.billing_mode not null default 'prepaid';

-- Append-only project debt ledger
create table if not exists public.project_debt_ledger (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_type text not null check (event_type in ('time_entry_accrual', 'time_entry_reversal', 'payment_settlement')),
  hours numeric(10,2) not null check (hours <> 0),
  source_id uuid,
  source_type text check (source_type in ('time_entry', 'stripe_event', 'manual_adjustment')),
  source_event_id text,
  description text,
  created_at timestamptz not null default now(),
  constraint project_debt_ledger_source_unique unique (project_id, source_id, event_type)
);

-- Canonical balance read model
create or replace function public.get_project_billing_balance(p_project_id uuid)
returns table (
  project_id uuid,
  billing_mode public.billing_mode,
  prepaid_hours numeric,
  used_hours numeric,
  remaining_prepaid_hours numeric,
  outstanding_debt_hours numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_billing_mode public.billing_mode;
  v_assigned_hours numeric(10,2);
  v_used_hours numeric(10,2);
  v_debt numeric(10,2);
begin
  select p.billing_mode, p.assigned_hours
  into v_billing_mode, v_assigned_hours
  from public.projects p
  where p.id = p_project_id;

  if not found then
    raise exception 'project_not_found';
  end if;

  select coalesce(sum(
    extract(epoch from (te.ended_at - te.started_at)) / 3600
  ), 0)::numeric(10,2)
  into v_used_hours
  from public.time_entries te
  where te.project_id = p_project_id
    and te.ended_at is not null;

  select coalesce(sum(dl.hours), 0)::numeric(10,2)
  into v_debt
  from public.project_debt_ledger dl
  where dl.project_id = p_project_id;

  project_id := p_project_id;
  billing_mode := v_billing_mode;
  prepaid_hours := coalesce(v_assigned_hours, 0);
  used_hours := v_used_hours;
  remaining_prepaid_hours := greatest(coalesce(v_assigned_hours, 0) - v_used_hours, 0);
  outstanding_debt_hours := v_debt;

  return next;
  return;
end;
$$;

-- RLS for project_debt_ledger
alter table public.project_debt_ledger enable row level security;

drop policy if exists "debt_ledger_select_admin" on public.project_debt_ledger;
create policy "debt_ledger_select_admin"
on public.project_debt_ledger for select
to authenticated
using (
  public.is_admin(auth.uid())
);

drop policy if exists "debt_ledger_select_customer" on public.project_debt_ledger;
create policy "debt_ledger_select_customer"
on public.project_debt_ledger for select
to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.customer_id = auth.uid()
  )
);

drop policy if exists "debt_ledger_select_worker" on public.project_debt_ledger;
create policy "debt_ledger_select_worker"
on public.project_debt_ledger for select
to authenticated
using (
  exists (
    select 1 from public.project_workers pw
    where pw.project_id = project_id and pw.worker_id = auth.uid()
  )
);

drop policy if exists "debt_ledger_insert_admin" on public.project_debt_ledger;
create policy "debt_ledger_insert_admin"
on public.project_debt_ledger for insert
to authenticated
with check (public.is_admin(auth.uid()));

-- Indexes
create index if not exists idx_project_debt_ledger_project_id on public.project_debt_ledger (project_id);
create index if not exists idx_project_debt_ledger_source_id on public.project_debt_ledger (source_id);

-- Revoke execute from public/anon/authenticated
revoke execute on function public.get_project_billing_balance(uuid) from public;
revoke execute on function public.get_project_billing_balance(uuid) from anon;
revoke execute on function public.get_project_billing_balance(uuid) from authenticated;
