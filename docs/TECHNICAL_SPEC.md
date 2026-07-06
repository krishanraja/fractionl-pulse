# Technical Specification: Fractionl Pulse

_Source of truth for the system as it ships today. 21 live data sources, 8 core edge functions (plus supporting content, feed, checkout, and MCP functions), daily Vercel cron pipeline, agent-native API. Generated from the live codebase; see commit history for last update._

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                  CLIENT (React 18 + Vite SPA)                     │
│  Dashboard · Signals · AI Insights · Methodology · Settings · Auth│
│  React Query (5min refetch) + Supabase Realtime subscriptions     │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                 VERCEL (pulse.fractionl.ai)                       │
│  Static SPA · /api/cron/daily-ingest · /api/cron/weekly-ingest    │
│  /api/health  ·  Vercel Cron triggers                             │
└──────────────────────────────┬───────────────────────────────────┘
                               │ Service-role JWT
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│              SUPABASE (Postgres + Deno Edge Functions)            │
│  Auth · Database · Realtime · 8 core edge functions               │
└──────────────────────────────┬───────────────────────────────────┘
                               │
        ┌──────────────────────┼─────────────────────────────────┐
        ▼                      ▼                                  ▼
   21 external             OpenAI                            Resend
   data sources         (gpt-4o-mini                      (failure email
   (see §4)             insights)                          alerts)
```

---

## 2. Edge Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `ingest-signals` | Pulls 21 sources, normalizes 0–100, runs anomaly guard, upserts `signals`, then fires `calculate-fwi` | Vercel cron (daily + weekly) + manual |
| `calculate-fwi` | Composites signals into FWI + movers with WoW deltas, writes `fwi_scores` & `movers` | Called by `ingest-signals` |
| `generate-pulse-insights` | GPT-4o-mini insight cards, 12-hour cache via `valid_until` | Daily cron + on-demand from frontend |
| `fwi-api` | Public REST API: `/current`, `/history?months=N`, `/trigger`. Accepts an optional `x-api-key` header that meters the request against `api_keys` per key per day (the metered agent tier); anonymous calls stay free and unmetered | Always-on |
| `export-brief` | Markdown weekly intelligence brief, `?format=json` available | Always-on (`/export-brief`) |
| `manage-api-key` | Self-serve metered-API key issuance for signed-in users: mint (POST), list (GET), revoke (DELETE). Plaintext key returned exactly once at creation; only the SHA-256 hash is stored | Called from the dashboard `/pricing` page (user JWT) |
| `backfill-historical` | One-time 12-week backfill of historical-capable sources (FRED, SEC, Guardian, NYT, Census, HN) | Manual |
| `send-pipeline-alert` | Sends Resend transactional email (critical/warning) on cron failures | Called by Vercel cron handlers |

### Vercel Cron (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/daily-ingest",  "schedule": "0 6 * * *" },
    { "path": "/api/cron/weekly-ingest", "schedule": "0 6 * * 1" }
  ]
}
```

- `daily-ingest.ts` — runs full ingest + insights + retries (2 retries, 5s backoff), writes `pipeline_runs`, fires `send-pipeline-alert` on failure.
- `weekly-ingest.ts` — Monday backstop run. Same retry envelope.
- `pg_cron` exists as a redundant safety net inside Postgres (migration `002_pipeline_scheduling.sql`) for Supabase Pro tenants. Vercel cron is primary.

---

## 3. Database Schema

All tables live in `public`. RLS is enabled on every domain table; see migrations `001_defensible_signals.sql` and `005_tighten_signals_rls.sql`.

### `signals`

Raw ingested data. One row per `(date, source, signal_type, category)`.

```sql
CREATE TABLE signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  source text NOT NULL,                                  -- e.g. 'adzuna', 'sec_edgar', 'people_data_labs'
  signal_type text NOT NULL CHECK (signal_type IN
    ('demand', 'supply', 'momentum', 'context')),
  category text NOT NULL,                                -- role name or signal category
  normalized_value numeric(5,2)
    CHECK (normalized_value BETWEEN 0 AND 100),
  raw_value numeric(10,2),                               -- pre-normalization value
  metadata jsonb DEFAULT '{}',                           -- source-specific context, backfilled flag, etc.
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX signals_date_source_category_idx
  ON signals(date, source, signal_type, category);
CREATE INDEX signals_date_type_idx ON signals(date, signal_type);
```

`signal_type = 'context'` covers FRED + Census macro signals. They are stored and exposed in API responses but **excluded** from the composite score.

### `fwi_scores`

Weekly composite results.

```sql
CREATE TABLE fwi_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  overall_score numeric(5,2) NOT NULL,
  demand_score numeric(5,2) NOT NULL,
  supply_score numeric(5,2) NOT NULL,
  momentum_score numeric(5,2) NOT NULL,                  -- "culture" pillar (legacy column name)
  weights jsonb DEFAULT '{"demand":0.5,"supply":0.2,"momentum":0.3}',
  confidence numeric(3,2) DEFAULT 1.0,                   -- weighted source-completeness 0-1
  notes text,
  metadata jsonb DEFAULT '{}',                           -- prior_week snapshot, has_supply_data, methodology
  created_at timestamptz DEFAULT now()
);
```

When supply has no data for a given week, `weights` is rewritten to redistribute the 20% supply weight proportionally to demand and culture, and `metadata.has_supply_data = false`.

### `movers`

Top-moving roles & signals per weekly run.

```sql
CREATE TABLE movers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  skill text NOT NULL,                                   -- e.g. "Fractional CFO"
  signal_type text NOT NULL,
  change_pct numeric(6,2),                               -- vs role market avg (Adzuna) or prior-week (others)
  note text,                                             -- humanized insight
  rank integer CHECK (rank >= 1),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX movers_date_rank_idx ON movers(date, rank);
```

### `cached_insights`

GPT-4o-mini insight cards.

```sql
CREATE TABLE cached_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insights_json jsonb NOT NULL,
  generated_at timestamptz DEFAULT now(),
  valid_until timestamptz,                               -- 12h TTL
  model text DEFAULT 'gpt-4o-mini',
  model_used text,                                       -- alias for forward compat (synced via trigger)
  context jsonb DEFAULT '{}',                            -- FWI snapshot used to generate
  metadata jsonb DEFAULT '{}'
);
```

A `BEFORE INSERT OR UPDATE` trigger keeps `model` and `model_used` in sync (migration `004_fix_cached_insights_columns.sql`).

### `pipeline_runs`

Full execution log.

```sql
CREATE TABLE pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,                                  -- 'ingest-signals', 'daily-cron', etc.
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running','success','error')),
  records_inserted integer DEFAULT 0,
  confidence numeric(3,2),
  error text,
  metadata jsonb DEFAULT '{}'
);
```

### `data_source_health`

Per-source health monitoring.

```sql
CREATE TABLE data_source_health (
  source text PRIMARY KEY,
  last_checked timestamptz,
  last_success timestamptz,
  status text DEFAULT 'unknown'
    CHECK (status IN ('healthy','degraded','failed','unknown')),
  error_count integer DEFAULT 0,
  avg_response_time_ms numeric(8,2),
  metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
```

### `waitlist`

```sql
CREATE TABLE waitlist (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  joined_at timestamptz NOT NULL DEFAULT now()
);
-- anon insert allowed, service-role read only
```

### `api_keys` (metered-API backing store)

This is the live backing store for the metered agent API, not a reserved placeholder. Each row is one issued key, owned by the user who minted it, with usage metered per day.

```sql
-- Columns exercised by manage-api-key (issuance) and fwi-api (metering):
--   id              uuid    primary key
--   user_id         uuid    references auth.users(id) on delete cascade   -- added in migration 015
--   key_hash        text    SHA-256 hex of the plaintext key (the plaintext is NEVER stored)
--   label           text    human label shown in the dashboard
--   tier            text    'free' | 'pro' | 'enterprise'
--   requests_limit  integer per-day cap (free = 1000; enterprise = unlimited)
--   requests_used   integer per-day counter, reset when last_used_at rolls to a new UTC day
--   last_used_at    timestamptz  drives the daily reset
--   is_active       boolean revoked keys set this false
--   created_at      timestamptz
-- Indexes (migration 015): api_keys_user_id_idx, api_keys_key_hash_idx.
```

Rows are created, metered, and revoked **only** by the service-role edge functions (`manage-api-key` and `fwi-api`), so there is no client-facing RLS beyond the existing service-role-only policy. A signed-in user gets at most 5 active keys. See §6 for how `fwi-api` validates and meters a supplied `x-api-key`.

### Security & metering migrations (014, 015)

- **`014_audit_security_hardening.sql`** (2026-07-06): a security-advisor hardening pass from the product audit. Sets `security_invoker = on` on the `data_quality_summary` and `pipeline_health` views (they no longer bypass RLS), revokes `EXECUTE` on the trigger functions `handle_new_user()`, `update_updated_at_column()`, and `trigger_google_sheets_sync()` from `anon` and `public` (triggers still fire as the function owner), pins `search_path = public` on `check_data_freshness()` and `sync_cached_insights_model()`, and drops a redundant, mis-keyed `user_profiles` policy. Tenant-data isolation (subscriptions, user_profiles, api_keys, waitlist) was already correct and left untouched.
- **`015_api_keys_user_owned.sql`**: adds `api_keys.user_id` (references `auth.users(id) on delete cascade`) plus the `api_keys_user_id_idx` and `api_keys_key_hash_idx` indexes, so keys can be scoped to their owner for the self-serve metered API.

### Views

- `data_quality_summary` — per-source signal volume, weeks-with-data, avg score, stddev, backfilled count
- `pipeline_health` — last 20 runs with duration, status, confidence, errors

Both views are publicly readable for the dashboard's `DataHealthCard`.

---

## 4. Signal Collection (21 Sources)

### Demand pillar (50% weight)

| Source | Endpoint | Roles / scope | Normalization |
|--------|----------|---------------|---------------|
| **Adzuna** | `https://api.adzuna.com/v1/api/jobs/us/search/1` per role with `what_phrase` | 6 roles: fractional CFO/CMO/CTO/COO/CRO + interim CEO | `min(100, log10(count+1) / log10(200) × 100)`, floor 15 |
| **SerpAPI Google Jobs** | Google Jobs engine, exact phrase per role | Same 6 roles | Sqrt scale matched to Adzuna for cross-check |
| **SEC EDGAR Form D** | `https://efts.sec.gov/LATEST/search-index?forms=D&dateRange=custom&q="software" OR "technology" OR "SaaS"` | Tech/SaaS Form D filings, 90-day rolling | `min(100, count/800 × 50)` — 800 filings/90d = 50 |

### Supply pillar (20% weight, redistributes if empty)

| Source | Endpoint | Method | Normalization |
|--------|----------|--------|---------------|
| **People Data Labs** | PDL Person Search API per role | Profile counts containing fractional/interim title terms | Log scale calibrated to typical role volumes |
| **SerpAPI LinkedIn proxy** | `site:linkedin.com/in "fractional CFO"` etc. | Result count proxy | Log scale |
| **GoFractional marketplace** | Apify scraper actor against `gofractional.com` | Active listings | Log scale |
| **Apify supply-intent Trends** | Apify Google Trends actor on supply-intent terms | "become fractional executive", "fractional consulting business", etc. | Native 0-100 |
| **SerpAPI supply-intent Trends** | SerpAPI Trends on the same terms | Independent fallback | Native 0-100 |

### Culture pillar (30% weight)

| Source | Endpoint | Normalization |
|--------|----------|---------------|
| **SerpAPI Google Trends** (primary) | Trends interest-over-time, 90-day, US geo | Mean of last 4 weekly values |
| **Apify Google Trends** (fallback) | Apify google-trends-scraper actor | Mean of last 4 weekly values |
| **NewsAPI** | `everything?q="fractional CMO" OR "fractional CFO" OR …&from=28d` | `min(100, sqrt(count) × 15)` |
| **Mediastack** | News articles, exact phrase | Sqrt scale |
| **Brave News** | News-vertical search | Sqrt scale |
| **Brave Web Search** | Web mentions of fractional terms | Sqrt scale |
| **The Guardian** | Article search, 90-day window | Linear |
| **NY Times** | Article Search API, 90-day window | Linear |
| **Podchaser** | GraphQL podcast episode search | Sqrt scale |
| **Reddit** | Apify Reddit scraper, relevant subreddits | Engagement-weighted |
| **Hacker News** | Algolia HN Search API | Points + comments scale |

### Context (stored, not in composite)

| Source | Series |
|--------|--------|
| **FRED** | JOLTS Job Openings · Unemployment Rate · Initial Jobless Claims |
| **Census ACS** | US self-employment household percentage |

### Source skip list

`SKIP_SOURCES` env var (comma-separated source keys) lets ops disable any source without code changes — used during rate-limit incidents.

---

## 5. Normalization & Composite

```
demand_score   = avg(all 'demand' signals)
supply_score   = avg(all 'supply' signals)   // = 0 if none reported
culture_score  = avg(all 'momentum' signals)

if no supply data:
  effective_demand_weight  = 0.50 / (0.50 + 0.30) = 0.625
  effective_culture_weight = 0.30 / (0.50 + 0.30) = 0.375
  effective_supply_weight  = 0
else:
  weights = { demand: 0.50, supply: 0.20, culture: 0.30 }

FWI = round( demand_score × W_d + supply_score × W_s + culture_score × W_c , 1)
```

### Confidence (data completeness)

Each source has a domain-weighted contribution baked into `SOURCE_CONFIDENCE_WEIGHTS` (e.g. Adzuna 0.14, PDL 0.10, FRED 0.01). Confidence = `Σ achieved_weight / Σ total_weight`, rounded to 2 decimals.

Confidence is **not** a prediction-accuracy metric — it surfaces in API responses as `meta.dataCompletenessNote`.

### Anomaly guard

For each successful signal, the ingest function fetches the last 8 weeks of values for `(source, category)`. If `|value − mean| / stddev > 3`, the signal is rejected from the upsert (logged to console for observability). Rejection requires at least 3 historical points and `stddev > 1`.

---

## 6. Public Agent API (`fwi-api`)

Three routes via the `fwi-api` edge function. CORS is wide-open.

| Route | Method | Auth | Caching |
|-------|--------|------|---------|
| `/fwi-api/current` | GET | none (optional `x-api-key`) | `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` |
| `/fwi-api/history?months=N` | GET | none (optional `x-api-key`) | `Cache-Control: public, max-age=3600` |
| `/fwi-api/trigger` | POST | service role JWT | none |

Shortcut response headers on `/current`:

```
X-FWI-Score: 62.4
X-FWI-Label: Growing
```

### Optional `x-api-key` metering (the paid wedge)

`fwi-api` accepts an **optional** `x-api-key` header (`config.toml` keeps `verify_jwt = false`, and CORS allows the header). The read endpoints stay free and no-auth:

- **No key supplied**: the request is served on the free anonymous tier, unmetered and unchanged. The dashboard and existing agents never break.
- **Key supplied**: `fwi-api` SHA-256-hashes the key, looks it up in `api_keys` by `key_hash`, and meters it per day. An unknown or revoked key returns HTTP 401 (`invalid_or_revoked_api_key`). Within the tier limit, `requests_used` is incremented (reset to 0 when `last_used_at` rolls to a new UTC day) and the response carries `X-RateLimit-Limit` and `X-RateLimit-Remaining`. Over the limit returns HTTP 429 (`rate_limit_exceeded`) with `X-RateLimit-Remaining: 0`.

Tier limits (`TIER_LIMITS` in `fwi-api`): `free` = 1,000 req/day, `pro` = 10,000 req/day, `enterprise` = unlimited (`X-RateLimit-Limit: unlimited`). Users self-serve a free key at `/pricing` via `manage-api-key`; higher and enterprise limits are arranged with sales at `data@fractionl.ai`.

Full schema lives in [`AGENT_INTEGRATION.md`](./AGENT_INTEGRATION.md).

### Markdown brief

`GET /export-brief` returns a Markdown weekly intelligence brief styled for press, newsletter, or LLM ingestion. `?format=json` returns the structured payload.

---

## 7. Frontend Architecture

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui (`components.json`)
- **Animation:** Framer Motion
- **Charts:** Recharts + Chart.js (sparklines)
- **State:** React hooks + `@tanstack/react-query` v5
- **Data freshness:** Supabase Realtime channel `pulse-data-changes` subscribing to `fwi_scores`, `signals`, `cached_insights`, `data_source_health`. React Query cache is invalidated on every change event.
- **Stale detection:** `useFWIData` flags `isStale` if latest `fwi_scores.date` is more than 48h old.
- **Auth:** Supabase Auth (email magic link; fractional role captured at signup)
- **Routing:** `react-router-dom` v6

### Key Components

| Component | Purpose |
|-----------|---------|
| `HeroSection` | Headline FWI gauge + 30-day delta |
| `SubIndexCards` | Per-pillar cards with sparklines and drill-in |
| `MarketSnapshot` | Live "today's reading" panel with movers |
| `TrendlineChart` | 12-week composite trendline |
| `SignalsTable` | Full per-role and per-source signal breakdown |
| `RoleBreakdown` | Adzuna role-level demand detail |
| `AIInsights` | Insight cards from `generate-pulse-insights` |
| `FractionalReadiness` | Personal "should I act?" gauge wired to live FWI + user weights |
| `DataHealthCard` | Per-source status badges (`data_source_health`) |
| `MethodologyDrawer` | Transparent methodology explainer |
| `SettingsSheet` | Custom-weight UI (persisted via `useUserPreferences`) |

### Hooks

| Hook | Job |
|------|-----|
| `useFWIData` | React Query loader for `fwi_scores` + `movers`; computes context + stale flag |
| `useMarketStats` | Aggregated headline metrics |
| `useRoleBreakdown` | Role-level Adzuna detail |
| `useSignalContext` | Humanized context strings per signal |
| `useUserPreferences` | Custom weights persistence |
| `useAuth` | Supabase auth state |

### Performance

- Code-splitting on Index, Login, NotFound routes
- Lazy-loaded charts and Methodology drawer
- 12-week historical backfill primes trendlines on first load
- React Query `refetchInterval: 5min` + Realtime invalidation

---

## 8. Environment Variables

### Frontend (`.env.local`)

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### Edge Functions (Supabase Dashboard → Project Settings → Functions)

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADZUNA_APP_ID
ADZUNA_APP_KEY
APIFY_API_KEY
SERP_API_KEY
NEWS_API_KEY
MEDIASTACK_API_KEY
BRAVE_API_KEY
GUARDIAN_API_KEY
NYT_API_KEY
PODCHASER_API_KEY
PDL_API_KEY
FRED_API_KEY
OPENAI_API_KEY
RESEND_API_KEY
SKIP_SOURCES                # optional, comma-separated
```

### Vercel Project (`vercel env`)

```
SUPABASE_SERVICE_ROLE_KEY   # used by /api/cron handlers to call Supabase
CRON_SECRET                 # asserted in /api/cron handlers
```

---

## 9. Deployment

- **Frontend:** Vercel auto-deploy on push to `main` → `pulse.fractionl.ai`.
- **Edge functions:** `supabase functions deploy <name>` per function. Service role key must be set as a function secret.
- **Database:** Supabase Postgres. Migrations live in `supabase/migrations/` and are applied via Supabase CLI or Supabase Management API.
- **Cron:** declared in `vercel.json`. Vercel manages execution; alerting routes through `send-pipeline-alert` → Resend.

---

## 10. Operational Playbook

| Symptom | Where to look | Action |
|---------|---------------|--------|
| Dashboard says "stale" | `pipeline_runs` for `source='daily-cron'` | Inspect latest run error; manually `POST /fwi-api/trigger` with service role |
| One source flat-lined | `data_source_health` row | Check `last_error`, rotate API key if 401, add to `SKIP_SOURCES` if rate-limited until fixed |
| Score moved sharply | `pipeline_runs.metadata.successful_sources` | Compare against prior week; if a heavyweight source dropped (Adzuna, PDL, SEC), expect movement |
| AI insights stuck | `cached_insights.valid_until` | Force-regenerate by calling `generate-pulse-insights`; OPENAI quota is most common cause |
| Cron failing | Vercel logs + `pipeline_runs.error` | Resend alert should already have fired. Re-trigger after fix |

---

## 11. Recent Major Changes

| Commit | What changed |
|--------|--------------|
| `8d3a3e5` | React Query + Realtime subscriptions, daily cron, Resend alerts on failure |
| `b2760de` | 13 source fixes, code splitting, PR export kit, 12-week backfill, SEO |
| `658c355` | Vercel Cron pipeline + anomaly guard + WoW deltas |
| `3feecfd` | UI overhaul + expansion to 21 sources |
| `f653feb` | Brave Search integration |
| `a07f401` | PDL fix activated supply pillar + supply-side Google Trends |
| `b1fa21f` | Role-level breakdowns, raw-data context, alert banners, PDL supply integration |

For full history: `git log --oneline`.
