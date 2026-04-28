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
      and linked_project_id is null
      and converted_at is null
      and (
        (
          customer_signed_by_name is null
          and customer_signed_at is null
          and customer_signed_by_user_id is null
        )
        or (
          nullif(btrim(coalesce(customer_signed_by_name, '')), '') is not null
          and customer_signed_at is not null
          and customer_signed_by_user_id is not null
        )
      )
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
