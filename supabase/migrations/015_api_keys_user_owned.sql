-- Associate API keys with the user who minted them, for the self-serve metered
-- agent API (the "sharper alternative": the human dashboard is free, the API is the
-- monetizable wedge). Key rows are created/updated only by the service-role edge
-- functions (manage-api-key, fwi-api metering), so no client-facing RLS is added;
-- the existing service-role-only policy remains the access boundary.

alter table public.api_keys add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists api_keys_user_id_idx on public.api_keys(user_id);
create index if not exists api_keys_key_hash_idx on public.api_keys(key_hash);
