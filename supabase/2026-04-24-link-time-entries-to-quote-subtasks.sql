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
    quote_subtask_id,
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
    qs.id,
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
      source = excluded.source,
      quote_subtask_id = excluded.quote_subtask_id;
$$;

revoke execute on function public.sync_time_entry_quote_subtask_id() from public;
revoke execute on function public.sync_time_entry_quote_subtask_id() from anon;
revoke execute on function public.sync_time_entry_quote_subtask_id() from authenticated;
revoke execute on function public.copy_quote_subtask_entries_to_project(uuid, uuid) from public;
revoke execute on function public.copy_quote_subtask_entries_to_project(uuid, uuid) from anon;
revoke execute on function public.copy_quote_subtask_entries_to_project(uuid, uuid) from authenticated;
