create or replace function public.get_profile_role(p_uid uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = p_uid;
$$;

create or replace function public.can_access_project_discussion(p_uid uuid, p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.is_admin(p_uid)
    or exists (
      select 1
      from public.projects p
      where p.id = p_project_id
        and p.customer_id = p_uid
    )
    or exists (
      select 1
      from public.project_workers pw
      where pw.project_id = p_project_id
        and pw.worker_id = p_uid
    )
  );
$$;

alter table public.quote_comments
  add column if not exists original_comment_html text,
  add column if not exists original_comment_json jsonb,
  add column if not exists edited_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.quote_comment_edits (
  id uuid primary key default gen_random_uuid(),
  quote_comment_id uuid not null references public.quote_comments(id) on delete cascade,
  editor_id uuid references public.profiles(id) on delete set null,
  previous_comment_html text,
  previous_comment_json jsonb,
  next_comment_html text,
  next_comment_json jsonb,
  created_at timestamptz not null default now(),
  constraint quote_comment_edits_previous_content_required
    check (
      nullif(btrim(coalesce(previous_comment_html, '')), '') is not null
      or previous_comment_json is not null
    ),
  constraint quote_comment_edits_next_content_required
    check (
      nullif(btrim(coalesce(next_comment_html, '')), '') is not null
      or next_comment_json is not null
    )
);

create table if not exists public.project_discussion_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_role public.app_role not null,
  message_html text,
  message_json jsonb,
  original_message_html text,
  original_message_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint project_discussion_messages_content_required
    check (
      nullif(btrim(coalesce(message_html, '')), '') is not null
      or message_json is not null
    )
);

create table if not exists public.project_discussion_message_edits (
  id uuid primary key default gen_random_uuid(),
  project_discussion_message_id uuid not null references public.project_discussion_messages(id) on delete cascade,
  editor_id uuid references public.profiles(id) on delete set null,
  previous_message_html text,
  previous_message_json jsonb,
  next_message_html text,
  next_message_json jsonb,
  created_at timestamptz not null default now(),
  constraint project_discussion_message_edits_previous_content_required
    check (
      nullif(btrim(coalesce(previous_message_html, '')), '') is not null
      or previous_message_json is not null
    ),
  constraint project_discussion_message_edits_next_content_required
    check (
      nullif(btrim(coalesce(next_message_html, '')), '') is not null
      or next_message_json is not null
    )
);

create or replace function public.quote_comments_sync_author_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role public.app_role;
begin
  if tg_op = 'INSERT' then
    current_role := public.get_profile_role(auth.uid());

    if current_role is null then
      raise exception 'profile_not_found';
    end if;

    new.author_id = auth.uid();
    new.author_role = current_role;
  else
    new.author_id = old.author_id;
    new.author_role = old.author_role;
  end if;

  return new;
end;
$$;

create or replace function public.project_discussion_messages_sync_author_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role public.app_role;
begin
  if tg_op = 'INSERT' then
    current_role := public.get_profile_role(auth.uid());

    if current_role is null then
      raise exception 'profile_not_found';
    end if;

    new.author_id = auth.uid();
    new.author_role = current_role;
  else
    new.author_id = old.author_id;
    new.author_role = old.author_role;
  end if;

  return new;
end;
$$;

create or replace function public.quote_comments_track_edits_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();

  if new.comment_html is distinct from old.comment_html
    or new.comment_json is distinct from old.comment_json then
    if old.edited_at is null then
      new.original_comment_html = old.comment_html;
      new.original_comment_json = old.comment_json;
    else
      new.original_comment_html = old.original_comment_html;
      new.original_comment_json = old.original_comment_json;
    end if;

    new.edited_at = now();
  else
    new.original_comment_html = old.original_comment_html;
    new.original_comment_json = old.original_comment_json;
    new.edited_at = old.edited_at;
  end if;

  return new;
end;
$$;

create or replace function public.write_quote_comment_edit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.comment_html is distinct from old.comment_html
    or new.comment_json is distinct from old.comment_json then
    insert into public.quote_comment_edits (
      quote_comment_id,
      editor_id,
      previous_comment_html,
      previous_comment_json,
      next_comment_html,
      next_comment_json
    )
    values (
      old.id,
      auth.uid(),
      old.comment_html,
      old.comment_json,
      new.comment_html,
      new.comment_json
    );
  end if;

  return new;
end;
$$;

create or replace function public.project_discussion_messages_track_edits_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();

  if new.message_html is distinct from old.message_html
    or new.message_json is distinct from old.message_json then
    if old.edited_at is null then
      new.original_message_html = old.message_html;
      new.original_message_json = old.message_json;
    else
      new.original_message_html = old.original_message_html;
      new.original_message_json = old.original_message_json;
    end if;

    new.edited_at = now();
  else
    new.original_message_html = old.original_message_html;
    new.original_message_json = old.original_message_json;
    new.edited_at = old.edited_at;
  end if;

  return new;
end;
$$;

create or replace function public.write_project_discussion_message_edit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.message_html is distinct from old.message_html
    or new.message_json is distinct from old.message_json then
    insert into public.project_discussion_message_edits (
      project_discussion_message_id,
      editor_id,
      previous_message_html,
      previous_message_json,
      next_message_html,
      next_message_json
    )
    values (
      old.id,
      auth.uid(),
      old.message_html,
      old.message_json,
      new.message_html,
      new.message_json
    );
  end if;

  return new;
end;
$$;

drop trigger if exists quote_comments_track_edits on public.quote_comments;
drop trigger if exists quote_comments_sync_author on public.quote_comments;
create trigger quote_comments_sync_author
before insert or update on public.quote_comments
for each row
execute function public.quote_comments_sync_author_trigger();

create trigger quote_comments_track_edits
before update on public.quote_comments
for each row
execute function public.quote_comments_track_edits_trigger();

drop trigger if exists quote_comments_write_edit_history on public.quote_comments;
create trigger quote_comments_write_edit_history
after update on public.quote_comments
for each row
execute function public.write_quote_comment_edit_trigger();

drop trigger if exists project_discussion_messages_track_edits on public.project_discussion_messages;
drop trigger if exists project_discussion_messages_sync_author on public.project_discussion_messages;
create trigger project_discussion_messages_sync_author
before insert or update on public.project_discussion_messages
for each row
execute function public.project_discussion_messages_sync_author_trigger();

create trigger project_discussion_messages_track_edits
before update on public.project_discussion_messages
for each row
execute function public.project_discussion_messages_track_edits_trigger();

drop trigger if exists project_discussion_messages_write_edit_history on public.project_discussion_messages;
create trigger project_discussion_messages_write_edit_history
after update on public.project_discussion_messages
for each row
execute function public.write_project_discussion_message_edit_trigger();

alter table public.quote_comment_edits enable row level security;
alter table public.project_discussion_messages enable row level security;
alter table public.project_discussion_message_edits enable row level security;

drop policy if exists "quote_comments_update_owner_or_admin" on public.quote_comments;
create policy "quote_comments_update_owner_or_admin"
on public.quote_comments for update
to authenticated
using (
  (public.is_admin(auth.uid()) or author_id = auth.uid())
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
)
with check (
  (public.is_admin(auth.uid()) or author_id = auth.uid())
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

drop policy if exists "quote_comments_delete_owner_or_admin" on public.quote_comments;
create policy "quote_comments_delete_owner_or_admin"
on public.quote_comments for delete
to authenticated
using (
  (public.is_admin(auth.uid()) or author_id = auth.uid())
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

drop policy if exists "quote_comment_edits_select_related" on public.quote_comment_edits;
create policy "quote_comment_edits_select_related"
on public.quote_comment_edits for select
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.quote_comments qc
    join public.quotes q on q.id = qc.quote_id
    where qc.id = quote_comment_id
      and (
        q.customer_id = auth.uid()
        or public.is_quote_worker(auth.uid(), q.id)
      )
  )
);

drop policy if exists "project_discussion_messages_select_related" on public.project_discussion_messages;
create policy "project_discussion_messages_select_related"
on public.project_discussion_messages for select
to authenticated
using (public.can_access_project_discussion(auth.uid(), project_id));

drop policy if exists "project_discussion_messages_insert_related" on public.project_discussion_messages;
create policy "project_discussion_messages_insert_related"
on public.project_discussion_messages for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.can_access_project_discussion(auth.uid(), project_id)
);

drop policy if exists "project_discussion_messages_update_owner_or_admin" on public.project_discussion_messages;
create policy "project_discussion_messages_update_owner_or_admin"
on public.project_discussion_messages for update
to authenticated
using (
  (public.is_admin(auth.uid()) or author_id = auth.uid())
  and public.can_access_project_discussion(auth.uid(), project_id)
)
with check (
  (public.is_admin(auth.uid()) or author_id = auth.uid())
  and public.can_access_project_discussion(auth.uid(), project_id)
);

drop policy if exists "project_discussion_messages_delete_owner_or_admin" on public.project_discussion_messages;
create policy "project_discussion_messages_delete_owner_or_admin"
on public.project_discussion_messages for delete
to authenticated
using (
  (public.is_admin(auth.uid()) or author_id = auth.uid())
  and public.can_access_project_discussion(auth.uid(), project_id)
);

drop policy if exists "project_discussion_message_edits_select_related" on public.project_discussion_message_edits;
create policy "project_discussion_message_edits_select_related"
on public.project_discussion_message_edits for select
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.project_discussion_messages pdm
    where pdm.id = project_discussion_message_id
      and public.can_access_project_discussion(auth.uid(), pdm.project_id)
  )
);

create index if not exists idx_quote_comments_edited_at on public.quote_comments (edited_at);
create index if not exists idx_quote_comment_edits_quote_comment_id on public.quote_comment_edits (quote_comment_id);
create index if not exists idx_project_discussion_messages_project_id on public.project_discussion_messages (project_id);
create index if not exists idx_project_discussion_messages_edited_at on public.project_discussion_messages (edited_at);
create index if not exists idx_project_discussion_message_edits_message_id on public.project_discussion_message_edits (project_discussion_message_id);

revoke execute on function public.can_access_project_discussion(uuid, uuid) from public;
revoke execute on function public.can_access_project_discussion(uuid, uuid) from anon;
revoke execute on function public.can_access_project_discussion(uuid, uuid) from authenticated;
revoke execute on function public.get_profile_role(uuid) from public;
revoke execute on function public.get_profile_role(uuid) from anon;
revoke execute on function public.get_profile_role(uuid) from authenticated;
revoke execute on function public.quote_comments_sync_author_trigger() from public;
revoke execute on function public.quote_comments_sync_author_trigger() from anon;
revoke execute on function public.quote_comments_sync_author_trigger() from authenticated;
revoke execute on function public.quote_comments_track_edits_trigger() from public;
revoke execute on function public.quote_comments_track_edits_trigger() from anon;
revoke execute on function public.quote_comments_track_edits_trigger() from authenticated;
revoke execute on function public.write_quote_comment_edit_trigger() from public;
revoke execute on function public.write_quote_comment_edit_trigger() from anon;
revoke execute on function public.write_quote_comment_edit_trigger() from authenticated;
revoke execute on function public.project_discussion_messages_sync_author_trigger() from public;
revoke execute on function public.project_discussion_messages_sync_author_trigger() from anon;
revoke execute on function public.project_discussion_messages_sync_author_trigger() from authenticated;
revoke execute on function public.project_discussion_messages_track_edits_trigger() from public;
revoke execute on function public.project_discussion_messages_track_edits_trigger() from anon;
revoke execute on function public.project_discussion_messages_track_edits_trigger() from authenticated;
revoke execute on function public.write_project_discussion_message_edit_trigger() from public;
revoke execute on function public.write_project_discussion_message_edit_trigger() from anon;
revoke execute on function public.write_project_discussion_message_edit_trigger() from authenticated;
