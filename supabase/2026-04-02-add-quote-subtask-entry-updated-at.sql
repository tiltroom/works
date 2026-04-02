alter table public.quote_subtask_entries
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists quote_subtask_entries_set_updated_at on public.quote_subtask_entries;

create trigger quote_subtask_entries_set_updated_at
before update on public.quote_subtask_entries
for each row
execute function public.set_updated_at_now();
