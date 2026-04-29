drop policy if exists "profiles_select_project_related" on public.profiles;
drop policy if exists "profiles_select_self_admin_or_related_customer" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;

create policy "profiles_select_self_admin_or_related_customer"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.time_entries te
    join public.projects p on p.id = te.project_id
    where te.worker_id = profiles.id
      and p.customer_id = auth.uid()
  )
);

create or replace function public.get_project_customer_display_name(p_project_id uuid)
returns table (
  customer_id uuid,
  full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.customer_id, c.full_name
  from public.projects p
  join public.profiles c on c.id = p.customer_id
  where p.id = p_project_id
    and (
      public.is_admin(auth.uid())
      or p.customer_id = auth.uid()
      or exists (
        select 1
        from public.project_workers pw
        where pw.project_id = p.id
          and pw.worker_id = auth.uid()
      )
    )
  limit 1;
$$;

revoke execute on function public.get_project_customer_display_name(uuid) from public;
revoke execute on function public.get_project_customer_display_name(uuid) from anon;
grant execute on function public.get_project_customer_display_name(uuid) to authenticated;
