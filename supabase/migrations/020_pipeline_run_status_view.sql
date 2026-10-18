-- 020_pipeline_run_status_view.sql
--
-- Gives the weekly audit a read of the two things it must verify and could not:
-- whether ingest-signals collected once per day, and which sender actually
-- delivered the last alert. pipeline_runs is deliberately closed to the public
-- key (006), so the audit got `permission denied`, read it as "no rows", and
-- reported the alert path as "never observed" every week no matter what had
-- happened. An audit that cannot see the table must say so, not report absence.
--
-- Not a reopening of pipeline_runs. The view is narrow by construction:
--   * only the two sources the audit verifies
--   * no raw metadata, no error text, no recipient lists
--   * the sender address is reduced to primary / fallback / unknown, because
--     alert mailbox addresses are never published
-- A view runs with its owner's rights, which is what lets anon read these
-- columns without any policy on the underlying table; the table stays closed.

create or replace view public.pipeline_run_status as
select
  source,
  started_at,
  status,
  records_inserted,
  metadata->>'reason' as reason,
  metadata->>'caller' as caller,
  case
    when source <> 'pipeline-alert' then null
    when metadata->>'from' is null then 'unknown'
    when metadata->>'from' ilike '%onboarding@resend.dev%' then 'fallback'
    else 'primary'
  end as delivered_by
from public.pipeline_runs
where source in ('ingest-signals', 'pipeline-alert');

revoke all on public.pipeline_run_status from public;
grant select on public.pipeline_run_status to anon, authenticated, service_role;
