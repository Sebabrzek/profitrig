-- Migration 016: Ask ProfitRig chat rows become server-written only
--
-- PERMISSIONS ONLY. No schema, function or data changes. Safe to run twice.
--
-- Run this only after the guardrails code is live in production (main
-- fab6a25 and later). Until that code shipped, the browser saved chat
-- messages itself, so a driver needed write access to support_chats. The
-- server now writes every message with the service-role key, so that access
-- is unused — and an unused write privilege is just an open door.
--
-- What changes:
-- 1. The insert policy support_chats_insert_own is removed.
-- 2. Drivers keep no write privilege on support_chats at all.
--
-- What does not change:
--    Reading. A driver still reads their own messages and only their own,
--    through support_chats_select_own, which is how the chat panel shows a
--    conversation again when it is reopened. Admin still reads every
--    transcript with the service-role key.

-- 1. Drivers can no longer insert chat rows.
drop policy if exists "support_chats_insert_own" on public.support_chats;

-- 2. And hold no write privilege on the table at all.
revoke insert, update, delete on public.support_chats from anon, authenticated;

-- 3. Reading their own transcript is unchanged:
--    policy "support_chats_select_own" is deliberately left in place.


-- Undo (only if the app is ever rolled back to a pre-guardrails build, where
-- the chat wrote its own rows and would otherwise fail silently):
--   grant insert (user_id, role, content) on public.support_chats to authenticated;
--   create policy "support_chats_insert_own"
--     on public.support_chats for insert
--     with check (auth.uid() = user_id);
