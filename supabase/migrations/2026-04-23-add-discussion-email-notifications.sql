-- Extend email notification logging to discussion messages for quotes and projects.

alter table public.email_notifications
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.email_notifications
  alter column quote_id drop not null;

alter table public.email_notifications
  drop constraint if exists email_notifications_event_type_check;

alter table public.email_notifications
  add constraint email_notifications_event_type_check
  check (event_type in (
    'quote_created',
    'quote_converted',
    'quote_reverted',
    'quote_discussion_message',
    'project_discussion_message'
  ));

alter table public.email_notifications
  drop constraint if exists email_notifications_target_required;

alter table public.email_notifications
  add constraint email_notifications_target_required
  check (
    (quote_id is not null and project_id is null)
    or (quote_id is null and project_id is not null)
  );

alter table public.email_notifications
  drop constraint if exists email_notifications_event_target_check;

alter table public.email_notifications
  add constraint email_notifications_event_target_check
  check (
    (
      event_type in ('quote_created', 'quote_converted', 'quote_reverted', 'quote_discussion_message')
      and quote_id is not null
      and project_id is null
    )
    or (
      event_type = 'project_discussion_message'
      and project_id is not null
      and quote_id is null
    )
  );

alter table public.email_notifications
  drop constraint if exists email_notifications_dedup_unique;

create unique index if not exists email_notifications_quote_dedup_unique
  on public.email_notifications (quote_id, event_type, recipient_user_id, dedupe_key)
  where quote_id is not null;

create unique index if not exists email_notifications_project_dedup_unique
  on public.email_notifications (project_id, event_type, recipient_user_id, dedupe_key)
  where project_id is not null;

create index if not exists email_notifications_project_id_idx
  on public.email_notifications (project_id);
