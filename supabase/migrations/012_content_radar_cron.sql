-- 012_content_radar_cron.sql
-- Weekly Content Radar via Supabase pg_cron (the reliable path; the Vercel plan
-- only allows 2 crons, already used by ingest). Runs Monday 06:50 UTC, AFTER the
-- weekly FWI ingest (06:00) so the two share the per-host throttle window rather than
-- 429-ing each other. harvest-content-signals internally triggers generate-content-radar.
-- A separate job calls send-content-brief, which is DORMANT (no-op) until armed.
-- cron.schedule upserts by name, so this is idempotent.

select cron.schedule(
  'pulse-content-harvest',
  '50 6 * * 1',
  $$
    select net.http_post(
      url := 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/harvest-content-signals',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
        'Content-Type', 'application/json'
      ),
      body := '{}',
      timeout_milliseconds := 150000
    );
  $$
);

select cron.schedule(
  'pulse-content-brief',
  '10 7 * * 1',
  $$
    select net.http_post(
      url := 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/send-content-brief',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
        'Content-Type', 'application/json'
      ),
      body := '{}',
      timeout_milliseconds := 60000
    );
  $$
);
