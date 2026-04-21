-- Tighten RLS on signals table.
-- The original migration (001) granted a blanket FOR ALL policy with USING(true),
-- which lets anon users INSERT/UPDATE/DELETE rows. This migration replaces it
-- with separate SELECT (public) and write (service_role only) policies.
--
-- Also adds an explicit public SELECT on signals so Supabase Realtime can
-- push change events to anon-authenticated frontend clients.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service full access signals" ON signals;

-- Public read: required for frontend queries and Realtime subscriptions
CREATE POLICY "Public read signals"
ON signals FOR SELECT
USING (true);

-- Only service_role can write (edge functions use this)
CREATE POLICY "Service role write signals"
ON signals FOR INSERT
WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

CREATE POLICY "Service role update signals"
ON signals FOR UPDATE
USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

CREATE POLICY "Service role delete signals"
ON signals FOR DELETE
USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
