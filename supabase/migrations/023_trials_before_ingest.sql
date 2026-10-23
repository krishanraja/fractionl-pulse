-- 023_trials_before_ingest.sql
--
-- Ruling (Krish, 2026-10-23): trial_wikipedia, trial_hn_wide and trial_trends
-- join the composite at the 2026-10-26 seam. collect-trials collects the first
-- two, so it moves from 06:30 to 05:40 UTC: before the 06:00 ingest, whose FWI
-- run then scores same-day values. trial_trends is written by ingest-signals
-- itself, from the Trends reading it collects at 06:00.
--
-- 05:40 is after the 05:00 jobs preparation, which submits the depth-100
-- Google Jobs trial tasks that collect-trials reads (an unscored trial).
--
-- ORDERING: deploy collect-trials and ingest-signals first. cron.schedule
-- upserts by name, so this is idempotent.

select cron.schedule('pulse-daily-trials', '40 5 * * *', $$
  select net.http_post(
    url := 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/collect-trials',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
