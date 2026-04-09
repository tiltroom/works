create or replace function public.apply_postpaid_quote_conversion(
  p_quote_id uuid,
  p_admin_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quotes%rowtype;
  new_project_id uuid;
  normalized_comment text;
begin
  select *
  into quote_row
  from public.quotes q
  where q.id = p_quote_id
  for update;

  if not found then
    raise exception 'quote_not_found';
  end if;

  if quote_row.status = 'converted' then
    return quote_row.linked_project_id;
  end if;

  if quote_row.status <> 'signed' then
    raise exception 'quote_not_signed';
  end if;

  if quote_row.billing_mode <> 'postpaid' then
    raise exception 'quote_not_postpaid';
  end if;

  normalized_comment := nullif(btrim(coalesce(p_admin_comment, '')), '');

  insert into public.projects (
    name,
    description,
    customer_id,
    assigned_hours,
    billing_mode
  )
  values (
    quote_row.title,
    nullif(btrim(coalesce(quote_row.description, '')), ''),
    quote_row.customer_id,
    0,
    'postpaid'
  )
  returning id into new_project_id;

  insert into public.project_workers (project_id, worker_id)
  select new_project_id, qw.worker_id
  from public.quote_workers qw
  where qw.quote_id = p_quote_id
  on conflict (project_id, worker_id) do nothing;

  update public.quotes q
  set status = 'converted',
      linked_project_id = new_project_id,
      converted_at = now(),
      updated_at = now()
  where q.id = p_quote_id;

  return new_project_id;
end;
$$;

revoke execute on function public.apply_postpaid_quote_conversion(uuid, text) from public;
revoke execute on function public.apply_postpaid_quote_conversion(uuid, text) from anon;
revoke execute on function public.apply_postpaid_quote_conversion(uuid, text) from authenticated;
