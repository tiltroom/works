-- Email notifications log for quote lifecycle events
 
create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type text not null,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  dedupe_key text not null,
  recipient_email text not null,
  locale text not null,
  subject text not null,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
 
  constraint email_notifications_event_type_check
    check (event_type in ('quote_created', 'quote_converted', 'quote_reverted')),
  constraint email_notifications_status_check
    check (status in ('pending', 'sent', 'failed')),
  constraint email_notifications_dedup_unique
    unique (quote_id, event_type, recipient_user_id, dedupe_key)
);
 
create index if not exists email_notifications_quote_id_idx
  on public.email_notifications (quote_id);
 
alter table public.email_notifications enable row level security;
 
drop policy if exists "email_notifications_select_admin" on public.email_notifications;
create policy "email_notifications_select_admin"
on public.email_notifications for select
to authenticated
using (public.is_admin(auth.uid()));
 
drop policy if exists "email_notifications_select_own" on public.email_notifications;
create policy "email_notifications_select_own"
on public.email_notifications for select
to authenticated
using (recipient_user_id = auth.uid());
