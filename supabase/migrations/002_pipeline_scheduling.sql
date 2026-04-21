-- Pipeline scheduling & data quality improvements
-- Enables automated weekly data collection and staleness alerting

-- ============================================================================
-- OPTIONAL: pg_cron scheduling (Supabase Pro plan required)
--
-- The primary data pipeline is triggered by Vercel Cron (see vercel.json and
-- api/cron/daily-ingest.ts) which runs daily at 06:00 UTC with retry logic
-- and Resend email alerts on failure. That works on any Supabase tier.
--
-- The pg_cron schedule below is a REDUNDANT SAFETY NET. It only activates if:
--   1. You are on Supabase Pro (pg_cron extension available)
--   2. You have set app.settings.supabase_url and app.settings.service_role_key
--      via: ALTER DATABASE postgres SET app.settings.supabase_url = 'https://...';
--   3. The pg_net extension is also enabled
--
-- If any of those prerequisites are missing, this block will error on first run.
-- That is safe to ignore — Vercel Cron handles ingestion independently.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule(
  'weekly-fwi-ingest',
  '0 6 * * 1',  -- Monday 6am UTC (redundant backup of Vercel daily cron)
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ingest-signals',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'
  );
  $$
);

-- Staleness alert function: checks if data is older than 48 hours
CREATE OR REPLACE FUNCTION check_data_freshness()
RETURNS TABLE(is_stale boolean, hours_since_update numeric, latest_date date) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (EXTRACT(EPOCH FROM (now() - (max(f.date)::timestamp + interval '0 hours'))) / 3600) > 48 AS is_stale,
    ROUND((EXTRACT(EPOCH FROM (now() - (max(f.date)::timestamp + interval '0 hours'))) / 3600)::numeric, 1) AS hours_since_update,
    max(f.date) AS latest_date
  FROM fwi_scores f;
END;
$$ LANGUAGE plpgsql;

-- Data quality view: shows source health at a glance
CREATE OR REPLACE VIEW data_quality_summary AS
SELECT
  s.source,
  COUNT(*) AS total_signals,
  COUNT(DISTINCT s.date) AS weeks_with_data,
  MIN(s.date) AS earliest_date,
  MAX(s.date) AS latest_date,
  ROUND(AVG(s.normalized_value)::numeric, 1) AS avg_score,
  ROUND(STDDEV(s.normalized_value)::numeric, 1) AS score_stddev,
  COUNT(*) FILTER (WHERE s.metadata->>'backfilled' = 'true') AS backfilled_count,
  COUNT(*) FILTER (WHERE s.metadata->>'estimated' = 'true') AS estimated_count
FROM signals s
GROUP BY s.source
ORDER BY s.source;

-- Pipeline health view: recent run status
CREATE OR REPLACE VIEW pipeline_health AS
SELECT
  source,
  status,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at))::integer AS duration_seconds,
  records_inserted,
  confidence,
  error
FROM pipeline_runs
ORDER BY started_at DESC
LIMIT 20;

-- Add index for backfill queries
CREATE INDEX IF NOT EXISTS signals_metadata_backfilled_idx
ON signals USING gin ((metadata->'backfilled'));

-- Grant public read on quality views
GRANT SELECT ON data_quality_summary TO anon, authenticated;
GRANT SELECT ON pipeline_health TO anon, authenticated;
