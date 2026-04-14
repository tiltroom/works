-- Restore RLS helper function execution for authenticated users.
-- The April 10 migration (2026-04-10-add-project-and-quote-discussion-messages.sql)
-- revoked execute from authenticated on these helpers, but RLS policies for
-- project_discussion_messages call can_access_project_discussion(...) during
-- policy evaluation, and the author-sync triggers call get_profile_role(...).
-- Without execute permission, authenticated users get "permission denied for
-- function can_access_project_discussion" at runtime when loading project
-- discussion data.

grant execute on function public.can_access_project_discussion(uuid, uuid) to authenticated;
grant execute on function public.get_profile_role(uuid) to authenticated;
