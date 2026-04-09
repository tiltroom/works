-- Time-entry debt triggers for post-paid projects
-- Accrues debt on insert of closed entries, reverses on update/delete

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
  if tg_op = 'INSERT' and new.ended_at is not null then
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

  if tg_op = 'UPDATE' then
    if old.ended_at is not null and coalesce(new.ended_at, old.ended_at) is not null then
      select p.billing_mode into v_billing_mode
      from public.projects p where p.id = coalesce(new.project_id, old.project_id);

      if v_billing_mode = 'postpaid' or (
        old.project_id <> coalesce(new.project_id, old.project_id)
      ) then
        if old.ended_at is not null then
          v_hours := extract(epoch from (old.ended_at - old.started_at)) / 3600;
          if v_hours > 0 then
            insert into public.project_debt_ledger (project_id, event_type, hours, source_id, source_type, description)
            values (old.project_id, 'time_entry_reversal', -v_hours, old.id, 'time_entry',
                    'Reversal for edited/deleted time entry');
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
                    'Re-accrual for edited time entry');
          end if;
        end if;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' and old.ended_at is not null then
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
