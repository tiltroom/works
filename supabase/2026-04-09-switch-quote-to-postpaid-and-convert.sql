create or replace function public.switch_quote_to_postpaid_and_convert(
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

  if exists (
    select 1
    from public.quote_prepayment_sessions pps
    where pps.quote_id = p_quote_id
      and pps.status in ('pending', 'paid')
  ) then
    raise exception 'quote_has_prepayment_activity';
  end if;

  if quote_row.billing_mode <> 'postpaid' then
    update public.quotes q
    set billing_mode = 'postpaid',
        updated_at = now()
    where q.id = p_quote_id;
  end if;

  return public.apply_postpaid_quote_conversion(
    p_quote_id => p_quote_id,
    p_admin_comment => p_admin_comment
  );
end;
$$;

revoke execute on function public.switch_quote_to_postpaid_and_convert(uuid, text) from public;
revoke execute on function public.switch_quote_to_postpaid_and_convert(uuid, text) from anon;
revoke execute on function public.switch_quote_to_postpaid_and_convert(uuid, text) from authenticated;
