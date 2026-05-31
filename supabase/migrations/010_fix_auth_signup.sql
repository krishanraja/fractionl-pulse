-- 010_fix_auth_signup.sql
-- CRITICAL: auth signup was fully broken in production. The on_auth_user_created
-- trigger (handle_new_user) inserts into public.security_audit_log, but that
-- table did not exist, so every new auth.users insert rolled back with
-- "Database error creating new user" (magic-link, Google, and password signups
-- all failed). Discovered while creating a test account for Pro verification.
--
-- Fix: (1) create the missing security_audit_log table; (2) make the trigger
-- defensive so a logging side-effect can NEVER block authentication again.

create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text,
  resource text,
  details jsonb,
  success boolean,
  created_at timestamptz not null default now()
);
create index if not exists security_audit_log_user_idx on public.security_audit_log (user_id, created_at desc);
alter table public.security_audit_log enable row level security;
-- audit log is service-role/trigger-written only; no public access.
revoke all on public.security_audit_log from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.user_profiles (user_id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict do nothing;

  -- Audit logging must never block a signup.
  begin
    insert into public.security_audit_log (user_id, action, resource, details, success)
    values (new.id, 'user_created', 'auth.users', jsonb_build_object('email', new.email), true);
  exception when others then
    null;
  end;

  return new;
exception when others then
  -- Last-resort guard: authentication must succeed even if profile creation fails.
  return new;
end;
$function$;
