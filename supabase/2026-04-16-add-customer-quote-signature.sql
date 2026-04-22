alter table public.quotes
  add column if not exists customer_signed_by_name text,
  add column if not exists customer_signed_at timestamptz,
  add column if not exists customer_signed_by_user_id uuid references public.profiles(id) on delete set null;

update public.quotes q
set customer_signed_by_name = coalesce(nullif(btrim(p.full_name), ''), q.signed_by_name, 'Customer'),
    customer_signed_at = coalesce(q.converted_at, q.signed_at, q.updated_at, now()),
    customer_signed_by_user_id = q.customer_id
from public.profiles p
where q.customer_id = p.id
  and q.status = 'converted'
  and q.customer_signed_at is null;

alter table public.quotes
  drop constraint if exists quotes_status_signature_check;

alter table public.quotes
  add constraint quotes_status_signature_check
  check (
    (
      status = 'draft'
      and signed_by_name is null
      and signed_at is null
      and signed_by_user_id is null
      and customer_signed_by_name is null
      and customer_signed_at is null
      and customer_signed_by_user_id is null
      and linked_project_id is null
      and converted_at is null
    )
    or (
      status = 'signed'
      and nullif(btrim(coalesce(signed_by_name, '')), '') is not null
      and signed_at is not null
      and customer_signed_by_name is null
      and customer_signed_at is null
      and customer_signed_by_user_id is null
      and linked_project_id is null
      and converted_at is null
    )
    or (
      status = 'converted'
      and nullif(btrim(coalesce(signed_by_name, '')), '') is not null
      and signed_at is not null
      and nullif(btrim(coalesce(customer_signed_by_name, '')), '') is not null
      and customer_signed_at is not null
      and linked_project_id is not null
      and converted_at is not null
    )
  );
