-- 007_subscriptions.sql
-- Billing + entitlements for Pulse Pro (Stripe, Fractionl AI account).
-- subscriptions: one row per user Stripe subscription (the entitlement source).
-- processed_stripe_events: idempotency ledger so a retried webhook never
-- double-records or double-emits (the gutted-audit watch item).
-- RLS: a user reads only their own subscription; only service_role writes.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  price_id text,
  tier text not null default 'pro',
  status text not null default 'active',
  current_period_end timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;
drop policy if exists "Users read own subscription" on public.subscriptions;
create policy "Users read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "Service insert subscriptions" on public.subscriptions;
create policy "Service insert subscriptions" on public.subscriptions
  for insert with check ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');
drop policy if exists "Service update subscriptions" on public.subscriptions;
create policy "Service update subscriptions" on public.subscriptions
  for update using ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- authenticated may SELECT (RLS narrows to own row); no anon access, no public writes.
revoke insert, update, delete, truncate, references, trigger on public.subscriptions from anon, authenticated;
revoke all on public.subscriptions from anon;

create table if not exists public.processed_stripe_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.processed_stripe_events enable row level security;
-- deny-all to public roles; service_role bypasses RLS.
revoke all on public.processed_stripe_events from anon, authenticated;
