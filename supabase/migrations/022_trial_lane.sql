-- 022_trial_lane.sql
--
-- The trial lane (Ruling, Krish, 2026-10-23; docs/CITABILITY.md "Rebuild plan").
-- Candidate inputs are stored in `signals` as signal_type 'candidate'. Nothing
-- that computes or publishes the index reads that type: calculate-fwi v1
-- averages only demand, supply and momentum rows, and v2 votes only the sources
-- listed in V2_SOURCES. A trial joins the composite only through the six-check
-- entry gate and a ruling, at a dated seam.
--
-- ORDERING: deploy supabase/functions/collect-trials first; the schedule below
-- calls it.

alter table public.signals drop constraint if exists signals_signal_type_check;
alter table public.signals add constraint signals_signal_type_check
  check (signal_type in ('demand', 'supply', 'momentum', 'context', 'candidate'));

-- 06:30 UTC: after the 05:00 jobs preparation (which now also submits the
-- depth-100 trial tasks) and the 06:00 ingest, before the 06:40 rebuild.
select cron.schedule('pulse-daily-trials', '30 6 * * *', $$
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
