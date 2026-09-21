-- 018_ingest_schedule.sql
--
-- ORDERING: DO NOT APPLY THIS BEFORE DEPLOYING supabase/functions/ingest-signals.
--
-- It depends on the once-per-day collection guard added to that function. Applied
-- first, it makes things worse rather than better: the pg_cron backstop moves
-- from 06:00 to 08:00 and, with no guard to make it a no-op, performs a full
-- second collection two hours after the primary — paying every provider twice as
-- it does today, but now landing after the 06:40 prerender rebuild, so the
-- published page disagrees with the API for the rest of every day.
--
-- Deploy the function, confirm a second call returns {"skipped": true}, then
-- apply this.
--
-- What it does, from the 2026-09-21 data-feed integrity audit:
--
-- Vercel's daily cron, Vercel's Monday weekly cron and the pg_cron backstops all
-- fired at 06:00, so ingest-signals ran twice a day and three times on Mondays,
-- each run paying DataForSEO, Apify, Adzuna and Brave for rows the upsert then
-- deduplicated. The backstops move to 08:00 so they are genuine backstops: they
-- take over when the 06:00 primary produced nothing, and no-op when it did not.
-- A second prerender rebuild at 08:40 covers the day a backstop has to run.
--
-- cron.schedule upserts by name, so these are idempotent.

-- Previously '0 6 * * 0,2,3,4,5,6' — the same minute as the Vercel primary,
-- every day but Monday.
select cron.schedule('pulse-daily-ingest', '0 8 * * *', $$
  select net.http_post(
    url := 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/ingest-signals?caller=pg_cron_backstop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
$$);

-- weekly-fwi-ingest (migration 002, Mondays 06:00) was the redundant safety net
-- from before the daily pipeline existed. pulse-daily-ingest now covers all seven
-- days, so this job is a third Monday collection and nothing else.
select cron.unschedule('weekly-fwi-ingest');

-- On a normal day this rebuilds the same number and costs one deploy; on a day
-- the backstop had to run, it is the only thing that stops the published page
-- disagreeing with the API until tomorrow.
select cron.schedule('pulse-backstop-redeploy', '40 8 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'vercel_deploy_hook' limit 1),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- The Vercel weekly cron is removed in vercel.json in the same change; it was a
-- Monday-only duplicate of the daily cron.
