-- 006_tighten_remaining_rls.sql
-- Closes the RLS write hole (audit finding A3).
--
-- Migration 005 hardened ONLY `signals`. The tables fwi_scores, movers,
-- cached_insights, data_source_health, and pipeline_runs still carried the
-- original `Service full access <t>` FOR ALL USING(true) policies from 001,
-- and anon/authenticated hold the default ALL table grants. With USING(true)
-- the RLS check passes for everyone, so the public anon key shipped in the
-- frontend bundle could INSERT / UPDATE / DELETE the published index data.
--
-- This migration extends the 005 service-role-only write pattern to the
-- remaining tables, re-scopes api_keys reads to service_role, and revokes the
-- excess grants from anon/authenticated as defense in depth.
--
-- SAFETY: the dashboard + Realtime read fwi_scores, movers, cached_insights,
-- data_source_health, and signals with the anon key, so their public SELECT
-- stays intact. The frontend never reads pipeline_runs or api_keys directly
-- (verified by grep of src/), so those are fully locked to service_role.
-- service_role has BYPASSRLS and keeps full pipeline write access. waitlist
-- (anon INSERT) is untouched. Reversible: re-add the dropped policies / grants.

-- service-role predicate, matching 005:
--   (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'

-- ============ fwi_scores ============
drop policy if exists "Service full access fwi_scores" on public.fwi_scores;
drop policy if exists "Service insert fwi_scores" on public.fwi_scores;
drop policy if exists "Service update fwi_scores" on public.fwi_scores;
drop policy if exists "Service delete fwi_scores" on public.fwi_scores;
create policy "Service insert fwi_scores" on public.fwi_scores
  for insert with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
create policy "Service update fwi_scores" on public.fwi_scores
  for update using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
create policy "Service delete fwi_scores" on public.fwi_scores
  for delete using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- ============ movers ============
drop policy if exists "Service full access movers" on public.movers;
drop policy if exists "Service insert movers" on public.movers;
drop policy if exists "Service update movers" on public.movers;
drop policy if exists "Service delete movers" on public.movers;
create policy "Service insert movers" on public.movers
  for insert with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
create policy "Service update movers" on public.movers
  for update using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
create policy "Service delete movers" on public.movers
  for delete using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- ============ cached_insights ============
drop policy if exists "Service full access cached_insights" on public.cached_insights;
drop policy if exists "Service insert cached_insights" on public.cached_insights;
drop policy if exists "Service update cached_insights" on public.cached_insights;
drop policy if exists "Service delete cached_insights" on public.cached_insights;
create policy "Service insert cached_insights" on public.cached_insights
  for insert with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
create policy "Service update cached_insights" on public.cached_insights
  for update using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
create policy "Service delete cached_insights" on public.cached_insights
  for delete using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- ============ data_source_health ============
drop policy if exists "Service full access data_source_health" on public.data_source_health;
drop policy if exists "Service insert data_source_health" on public.data_source_health;
drop policy if exists "Service update data_source_health" on public.data_source_health;
drop policy if exists "Service delete data_source_health" on public.data_source_health;
create policy "Service insert data_source_health" on public.data_source_health
  for insert with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
create policy "Service update data_source_health" on public.data_source_health
  for update using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
create policy "Service delete data_source_health" on public.data_source_health
  for delete using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- ============ pipeline_runs (no public read; ops data) ============
drop policy if exists "Service full access pipeline_runs" on public.pipeline_runs;
drop policy if exists "Service insert pipeline_runs" on public.pipeline_runs;
drop policy if exists "Service update pipeline_runs" on public.pipeline_runs;
drop policy if exists "Service delete pipeline_runs" on public.pipeline_runs;
create policy "Service insert pipeline_runs" on public.pipeline_runs
  for insert with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
create policy "Service update pipeline_runs" on public.pipeline_runs
  for update using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
create policy "Service delete pipeline_runs" on public.pipeline_runs
  for delete using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- ============ api_keys: re-scope SELECT to service_role (was USING(true)) ============
drop policy if exists "Service read api_keys" on public.api_keys;
drop policy if exists "Service select api_keys" on public.api_keys;
create policy "Service select api_keys" on public.api_keys
  for select using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- ============ defense in depth: revoke excess grants ============
-- Remove every write privilege from the public roles on the data tables.
-- SELECT is preserved on the five tables the dashboard/Realtime read.
revoke insert, update, delete, truncate, references, trigger
  on public.signals, public.fwi_scores, public.movers, public.cached_insights,
     public.data_source_health, public.pipeline_runs, public.api_keys
  from anon, authenticated;

-- pipeline_runs and api_keys are never read by the frontend: revoke their SELECT too.
revoke select on public.pipeline_runs, public.api_keys from anon, authenticated;
