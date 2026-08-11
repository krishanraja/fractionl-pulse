-- Atomic, privacy-preserving rate limits for the public Ask Pulse model route.
-- Only a salted hash of the network key is stored. The service role is the only
-- caller; browser users never receive table or function access.

create table if not exists public.ai_rate_limits (
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (key_hash, window_start)
);

alter table public.ai_rate_limits enable row level security;
revoke all on public.ai_rate_limits from anon, authenticated;

create or replace function public.consume_ai_rate_limit(
  p_key_hash text,
  p_limit integer default 12,
  p_window_seconds integer default 3600
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_key_hash is null or length(p_key_hash) < 32 then
    raise exception 'invalid rate-limit key';
  end if;
  if p_limit < 1 or p_window_seconds < 60 then
    raise exception 'invalid rate-limit policy';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.ai_rate_limits (key_hash, window_start, request_count, updated_at)
  values (p_key_hash, v_window_start, 1, now())
  on conflict (key_hash, window_start)
  do update set
    request_count = public.ai_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_count;

  delete from public.ai_rate_limits
  where window_start < now() - interval '48 hours';

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.consume_ai_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_rate_limit(text, integer, integer) to service_role;
