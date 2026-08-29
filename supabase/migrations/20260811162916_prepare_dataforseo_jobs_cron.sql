-- Submit the six paid Google Jobs tasks one hour before the daily ingest reads
-- their completed results. The preparation function owns the paid POST and
-- records task IDs in pipeline_runs before ingest-signals can consume them.

create unique index if not exists pipeline_runs_dataforseo_jobs_target_date_idx
on public.pipeline_runs ((metadata->>'target_date'))
where source = 'prepare-dataforseo-jobs';

update public.data_source_health
set metadata = coalesce(metadata, '{}'::jsonb) || case source
  when 'serpapi_jobs' then '{"provider":"dataforseo","description":"DataForSEO Google Jobs demand cross-check"}'::jsonb
  when 'serpapi_trends' then '{"provider":"dataforseo","description":"DataForSEO Google Trends demand interest"}'::jsonb
  when 'serpapi_linkedin' then '{"provider":"dataforseo","description":"DataForSEO LinkedIn public-profile supply proxy"}'::jsonb
  when 'serpapi_supply_trends' then '{"provider":"dataforseo","description":"DataForSEO supply-intent Trends"}'::jsonb
  when 'serpapi_related' then '{"provider":"dataforseo","description":"DataForSEO Trends related queries for Content Radar"}'::jsonb
  when 'serpapi_paa' then '{"provider":"dataforseo","description":"DataForSEO People Also Ask for Content Radar"}'::jsonb
end
where source in ('serpapi_jobs', 'serpapi_trends', 'serpapi_linkedin', 'serpapi_supply_trends', 'serpapi_related', 'serpapi_paa');

select cron.schedule(
  'pulse-prepare-dataforseo-jobs',
  '0 5 * * *',
  $$
    select net.http_post(
      url := 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/prepare-dataforseo-jobs',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
        'Content-Type', 'application/json'
      ),
      body := '{}',
      timeout_milliseconds := 30000
    );
  $$
);
