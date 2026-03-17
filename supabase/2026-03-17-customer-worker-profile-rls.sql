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
