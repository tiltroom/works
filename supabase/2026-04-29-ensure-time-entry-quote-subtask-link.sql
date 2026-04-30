-- Repair deployments where the direct quote-subtask link was skipped or
-- PostgREST still has the old time_entries schema cached.
--
-- Keep this migration self-contained for databases that missed
-- 2026-04-23-fix-time-entry-debt-accrual-edits.sql: the quote_subtask_id
-- backfill below updates closed time_entries, so the older debt trigger would
-- treat the metadata-only update as an edited time entry and try to append a
-- duplicate time_entry_accrual row.

alter table public.project_debt_ledger
  drop constraint if exists project_debt_ledger_source_unique;

create index if not exists idx_project_debt_ledger_source_event
  on public.project_debt_ledger (project_id, source_id, event_type)
  where source_id is not null;

create or replace function public.accrue_time_entry_debt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_billing_mode public.billing_mode;
  v_hours numeric(10,2);
begin
  if tg_op = 'INSERT' then
    if new.ended_at is not null then
      select p.billing_mode into v_billing_mode
      from public.projects p where p.id = new.project_id;

      if v_billing_mode = 'postpaid' then
        v_hours := extract(epoch from (new.ended_at - new.started_at)) / 3600;
        if v_hours > 0 then
          insert into public.project_debt_ledger (project_id, event_type, hours, source_id, source_type, description)
          values (new.project_id, 'time_entry_accrual', v_hours, new.id, 'time_entry',
                  'Time entry accrued for ' || v_hours || 'h');
        end if;
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.project_id is not distinct from new.project_id
      and old.started_at is not distinct from new.started_at
      and old.ended_at is not distinct from new.ended_at then
      return new;
    end if;

    if old.ended_at is not null then
      select p.billing_mode into v_billing_mode
      from public.projects p where p.id = old.project_id;

      if v_billing_mode = 'postpaid' then
        v_hours := extract(epoch from (old.ended_at - old.started_at)) / 3600;
        if v_hours > 0 then
          insert into public.project_debt_ledger (project_id, event_type, hours, source_id, source_type, description)
          values (old.project_id, 'time_entry_reversal', -v_hours, old.id, 'time_entry',
                  'Reversal for edited time entry');
        end if;
      end if;
    end if;

    if new.ended_at is not null then
      select p.billing_mode into v_billing_mode
      from public.projects p where p.id = new.project_id;

      if v_billing_mode = 'postpaid' then
        v_hours := extract(epoch from (new.ended_at - new.started_at)) / 3600;
        if v_hours > 0 then
          insert into public.project_debt_ledger (project_id, event_type, hours, source_id, source_type, description)
          values (new.project_id, 'time_entry_accrual', v_hours, new.id, 'time_entry',
                  'Accrual for stopped or edited time entry');
        end if;
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.ended_at is not null then
      select p.billing_mode into v_billing_mode
      from public.projects p where p.id = old.project_id;

      if v_billing_mode = 'postpaid' then
        v_hours := extract(epoch from (old.ended_at - old.started_at)) / 3600;
        if v_hours > 0 then
          insert into public.project_debt_ledger (project_id, event_type, hours, source_id, source_type, description)
          values (old.project_id, 'time_entry_reversal', -v_hours, old.id, 'time_entry',
                  'Reversal for deleted time entry');
        end if;
      end if;
    end if;

    return old;
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.accrue_time_entry_debt() from public;
revoke execute on function public.accrue_time_entry_debt() from anon;
revoke execute on function public.accrue_time_entry_debt() from authenticated;

alter table public.time_entries
  add column if not exists quote_subtask_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_entries_quote_subtask_id_fkey'
      and conrelid = 'public.time_entries'::regclass
  ) then
    alter table public.time_entries
      add constraint time_entries_quote_subtask_id_fkey
      foreign key (quote_subtask_id)
      references public.quote_subtasks(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_time_entries_quote_subtask_id
on public.time_entries (quote_subtask_id)
where quote_subtask_id is not null;

update public.time_entries te
set quote_subtask_id = qse.quote_subtask_id
from public.quote_subtask_entries qse
where te.quote_subtask_entry_id = qse.id
  and te.quote_subtask_id is null;

create or replace function public.sync_time_entry_quote_subtask_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quote_subtask_entry_id is null then
    return new;
  end if;

  select qse.quote_subtask_id
  into new.quote_subtask_id
  from public.quote_subtask_entries qse
  where qse.id = new.quote_subtask_entry_id;

  return new;
end;
$$;

drop trigger if exists time_entries_sync_quote_subtask_id on public.time_entries;
create trigger time_entries_sync_quote_subtask_id
before insert or update of quote_subtask_entry_id on public.time_entries
for each row
execute procedure public.sync_time_entry_quote_subtask_id();

revoke execute on function public.sync_time_entry_quote_subtask_id() from public;
revoke execute on function public.sync_time_entry_quote_subtask_id() from anon;
revoke execute on function public.sync_time_entry_quote_subtask_id() from authenticated;

notify pgrst, 'reload schema';
