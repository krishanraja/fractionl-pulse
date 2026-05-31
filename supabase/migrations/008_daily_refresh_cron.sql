-- 008_daily_refresh_cron.sql
-- Durable DAILY refresh via Supabase pg_cron (independent of the Vercel daily
-- cron, which stopped firing around 2026-05-14 due to a Vercel plan cron limit).
-- The existing pg_cron job (jobid 3) only runs ingest on Mondays, so data went
-- weekly. This adds:
--   - pulse-daily-ingest: ingest-signals every day EXCEPT Monday (Monday stays
--     on the existing weekly job, so there is no double-run collision).
--   - pulse-daily-insights: regenerate AI insights every day after ingest.
-- Both use the service_role_key from the vault, mirroring the existing job.
-- cron.schedule upserts by name, so this is idempotent.

select cron.schedule(
  'pulse-daily-ingest',
  '0 6 * * 0,2,3,4,5,6',
  $$
    select net.http_post(
      url := 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/ingest-signals',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
        'Content-Type', 'application/json'
      ),
      body := '{}',
      timeout_milliseconds := 90000
    );
  $$
);

select cron.schedule(
  'pulse-daily-insights',
  '20 6 * * *',
  $$
    select net.http_post(
      url := 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/generate-pulse-insights',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
        'Content-Type', 'application/json'
      ),
      body := '{}',
      timeout_milliseconds := 60000
    );
  $$
);
