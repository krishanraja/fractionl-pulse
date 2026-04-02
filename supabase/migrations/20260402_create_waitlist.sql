-- Waitlist for Pulse Pro early access
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null,
  joined_at timestamptz not null default now(),
  constraint waitlist_email_unique unique (email)
);

-- Allow anonymous inserts (anyone can join the waitlist)
alter table public.waitlist enable row level security;

create policy "Anyone can join waitlist"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- Only service role can read waitlist entries
create policy "Service role reads waitlist"
  on public.waitlist
  for select
  to service_role
  using (true);
