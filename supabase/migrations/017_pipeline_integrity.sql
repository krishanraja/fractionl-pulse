-- 017_pipeline_integrity.sql
-- Three defects found in the 2026-09-21 data-feed integrity audit, all of them
-- cases of a status being trusted over the thing it describes.
--
-- 1. Duplicate collection. Vercel's daily cron, Vercel's Monday weekly cron and
--    the pg_cron backstops all fired at 06:00, so ingest-signals ran twice a day
--    and three times on Mondays, each run paying DataForSEO, Apify, Adzuna and
--    Brave for rows the upsert then deduplicated. ingest-signals now collects
--    once per calendar day and answers later callers with status 'skipped',
--    which this migration admits to the status check. The pg_cron jobs move to
--    08:00 so they are a genuine backstop — they take over when the 06:00
--    primary failed, and no-op when it did not.
--
-- 2. A second pipeline sharing one health table. harvest-content-signals writes
--    data_source_health rows for the content radar's own sources. The weekly
--    audit reconciles that table against the FWI weight table, so those rows
--    have been reported as "stale" every week since the radar shipped, and
--    deleting them would only have them return the next Monday. `pipeline`
--    separates the two universes so each is audited against its own intent.
--
-- Nothing here changes a weight, a threshold, or the methodology.
--
-- This migration is safe to apply on its own and is applied. The cron half of
-- the fix lives in 018 and MUST NOT be applied before the matching
-- ingest-signals deploy — see the header of that file for why.

-- 1. ------------------------------------------------------------------
alter table public.pipeline_runs drop constraint if exists pipeline_runs_status_check;
alter table public.pipeline_runs add constraint pipeline_runs_status_check
  check (status = any (array['running'::text, 'success'::text, 'error'::text, 'skipped'::text]));

-- 2. ------------------------------------------------------------------
alter table public.data_source_health
  add column if not exists pipeline text not null default 'fwi';

alter table public.data_source_health drop constraint if exists data_source_health_pipeline_check;
alter table public.data_source_health add constraint data_source_health_pipeline_check
  check (pipeline = any (array['fwi'::text, 'content_radar'::text]));

-- The content radar's own sources, per the sourceNames list in
-- supabase/functions/harvest-content-signals/index.ts. Sources it shares with
-- the FWI ingest (newsapi, mediastack, guardian, brave_news, brave_web, reddit,
-- hn, podchaser) stay 'fwi': the index is the stricter owner of that row.
update public.data_source_health
   set pipeline = 'content_radar'
 where source in ('serpapi_related', 'serpapi_paa', 'google_autocomplete', 'ats_boards', 'youtube', 'marketplace');

-- bls_oews is the one genuinely dead row: status 'unknown', last_success null,
-- untouched since 2026-05-31, and named by neither pipeline's source list. It is
-- a retired source's leftover, not a failing one, and it inflates the monitored
-- set that "sources down" is counted against.
delete from public.data_source_health
 where source = 'bls_oews' and last_success is null and status = 'unknown';
