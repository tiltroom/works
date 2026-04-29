-- This must run before 2026-04-24-link-time-entries-to-quote-subtasks.sql.
-- That migration backfills quote_subtask_id on closed time_entries, which fires
-- time_entries_debt_trigger. The previous trigger treated any closed-entry
-- UPDATE as a debt edit, even when only non-billing metadata changed, and the
-- old source/event uniqueness then blocked the attempted re-accrual.

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

drop trigger if exists time_entries_debt_trigger on public.time_entries;
create trigger time_entries_debt_trigger
after insert or update or delete on public.time_entries
for each row
execute procedure public.accrue_time_entry_debt();

revoke execute on function public.accrue_time_entry_debt() from public;
revoke execute on function public.accrue_time_entry_debt() from anon;
revoke execute on function public.accrue_time_entry_debt() from authenticated;
