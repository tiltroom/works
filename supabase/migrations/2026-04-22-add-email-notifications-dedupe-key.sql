-- Forward migration for existing email_notifications installations.
-- Adds event-instance dedupe support and timestamp tracking for retrying stale pending sends.

alter table public.email_notifications
  add column if not exists dedupe_key text;

alter table public.email_notifications
  add column if not exists updated_at timestamptz not null default now();

update public.email_notifications
set dedupe_key = event_type || ':' || quote_id::text
where dedupe_key is null;

alter table public.email_notifications
  alter column dedupe_key set not null;

alter table public.email_notifications
  drop constraint if exists email_notifications_dedup_unique;

alter table public.email_notifications
  add constraint email_notifications_dedup_unique
  unique (quote_id, event_type, recipient_user_id, dedupe_key);
