-- Audit security hardening (2026-07-06).
-- Addresses Supabase security-advisor findings surfaced by the product audit:
-- SECURITY DEFINER views exposing pipeline internals to anon, anon-executable
-- trigger functions, mutable function search paths, and a redundant profile policy.
-- The tenant-data isolation (subscriptions / user_profiles / api_keys / waitlist)
-- was already correct and is left untouched.

-- S1: Lock the two operational views to the caller's own privileges so they stop
-- bypassing RLS. Neither view is referenced by the app or any edge function, and
-- both leaked pipeline internals (backfilled/estimated counts, error strings).
alter view public.data_quality_summary set (security_invoker = on);
alter view public.pipeline_health set (security_invoker = on);

-- S3: Trigger functions never need direct client EXECUTE. Revoking the public grant
-- does not affect their firing as triggers (which run as the function owner).
revoke execute on function public.handle_new_user() from anon, public;
revoke execute on function public.update_updated_at_column() from anon, public;
revoke execute on function public.trigger_google_sheets_sync() from anon, public;

-- S4: Pin the two function search paths flagged as mutable.
alter function public.check_data_freshness() set search_path = public;
alter function public.sync_cached_insights_model() set search_path = public;

-- S5: Drop the redundant, mis-keyed profile policy. It used auth.uid() = id (the row
-- PK) instead of auth.uid() = user_id, so it never matched and was harmless cruft; the
-- correct user_id-scoped policies remain the sole owner check.
drop policy if exists "Users own their profile" on public.user_profiles;
