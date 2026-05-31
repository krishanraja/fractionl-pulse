-- 009_redeploy_cron.sql
-- Durable prerender freshness: after the daily ingest + insights, trigger a
-- Vercel redeploy so the build-time prerendered HTML, title, OG text, and
-- per-role pages reflect the new weekly number (the locked "redeploy on cron"
-- decision). Runs at 06:40 UTC, after ingest (06:00) and insights (06:20).
--
-- The Vercel deploy-hook URL is a credential, so it is NOT stored here. It lives
-- in the Supabase vault under the name 'vercel_deploy_hook' (set out of band,
-- see _upgrade/setup-deploy-vault.sql, gitignored). The cron reads it from the
-- vault, exactly like the service_role_key pattern. cron.schedule upserts by name.
select cron.schedule(
  'pulse-daily-redeploy',
  '40 6 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'vercel_deploy_hook' limit 1),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
