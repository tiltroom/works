-- ============================================================
-- Migration: 2026-04-15-allow-quote-comments-at-all-statuses.sql
-- Scope: quote_comments draft-only trigger removal
-- Problem: The app (quotes.ts actions + page.tsx canCompose) now allows
--   quote comment mutations at all quote statuses, but the DB trigger
--   `quote_comments_require_draft` still raises `quote_not_editable` for
--   non-draft quotes via `assert_quote_is_draft()`.
-- Fix:   Drop the trigger and its dedicated trigger function.
-- Safety: Other draft-only triggers (subtasks, workers, entries) are
--   NOT affected — they use their own trigger functions that call
--   `assert_quote_is_draft()` which is retained.
-- ============================================================

-- Step 1: Drop the trigger that enforces draft-only on quote_comments
drop trigger if exists quote_comments_require_draft on public.quote_comments;

-- Step 2: Drop the trigger function (only used by the above trigger)
drop function if exists public.quote_comments_require_draft_trigger();
