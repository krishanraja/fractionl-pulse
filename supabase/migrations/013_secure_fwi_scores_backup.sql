-- 013_secure_fwi_scores_backup.sql
-- Security fix: public.fwi_scores_backup_20260602 had RLS disabled and anon/authenticated
-- grants. It is a one-time backup snapshot of fwi_scores taken 2026-06-02; it is referenced
-- by no application or function code. With RLS off, anyone with the public anon key could
-- read, edit, or delete it.
--
-- Fix: enable RLS (no policies -> only service_role retains access) and revoke anon/
-- authenticated grants. The snapshot data is preserved; this table can be dropped entirely
-- once the backup is no longer needed. Idempotent.

alter table public.fwi_scores_backup_20260602 enable row level security;

revoke all on public.fwi_scores_backup_20260602 from anon;
revoke all on public.fwi_scores_backup_20260602 from authenticated;
