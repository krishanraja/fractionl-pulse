# Technical Specification: Fractionl Pulse

_Updated: 2026-03-21. Reflects defensible signal stack and agent-native architecture._

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (React SPA)                       │
├─────────────────────────────────────────────────────────────┤
│  Dashboard │ Signals │ Insights │ Settings │ Auth           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE (Postgres + Deno)                 │
├─────────────────────────────────────────────────────────────┤
│  Auth (Supabase)  │  Database (PostgreSQL)  │  Edge Fns     │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    Adzuna API       Apify API        EDGAR API
  (job postings)  (Google Trends)  (Form D filings)
                                        NewsAPI
```

---

## 2. Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `ingest-signals` | Manual / weekly cron | Collect 4 data sources → write to `signals` table |
| `calculate-fwi` | Called by ingest-signals | Composite signals → `fwi_scores` + `movers` |
| `generate-pulse-insights` | On demand (frontend) | GPT-4o-mini AI cards → `cached_insights` |
| `fwi-api` | Always-on HTTP | Public REST API for agents + developers |

---

## 3. Database Schema

### signals
Raw ingested data: one row per source + category + date.

```sql
CREATE TABLE signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  source text NOT NULL,              -- 'adzuna', 'google_trends', 'sec_edgar', 'newsapi'
  signal_type text NOT NULL,         -- 'demand', 'supply', 'momentum'
  category text NOT NULL,            -- role name or signal category
  normalized_value numeric(5,2),     -- 0-100
  raw_value numeric(10,2),           -- original value before normalisation
  metadata jsonb DEFAULT '{}',       -- source-specific context
  created_at timestamptz DEFAULT now()
);
```

### fwi_scores
Weekly composite scores.

```sql
CREATE TABLE fwi_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  overall_score numeric(5,2) NOT NULL,
  demand_score numeric(5,2) NOT NULL,
  supply_score numeric(5,2) NOT NULL,
  momentum_score numeric(5,2) NOT NULL,
  weights jsonb DEFAULT '{"demand": 0.5, "supply": 0.2, "momentum": 0.3}',
  confidence numeric(3,2) DEFAULT 1.0,  -- 0-1 based on sources that succeeded
  notes text,
  metadata jsonb DEFAULT '{}'
);
```

### movers
Top-moving roles per weekly run.

```sql
CREATE TABLE movers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  skill text NOT NULL,               -- "Fractional CFO"
  signal_type text NOT NULL,
  change_pct numeric(6,2),           -- vs market average
  note text,
  rank integer
);
```

### cached_insights
AI-generated insight cards with TTL.

```sql
CREATE TABLE cached_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insights_json jsonb NOT NULL,
  generated_at timestamptz DEFAULT now(),
  valid_until timestamptz,           -- 12 hours from generation
  model text DEFAULT 'gpt-4o-mini'
);
```

### pipeline_runs
Execution log for every data collection run.

```sql
CREATE TABLE pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL,              -- 'running', 'success', 'error'
  records_inserted integer,
  confidence numeric(3,2),
  error text,
  metadata jsonb DEFAULT '{}'
);
```

---

## 4. Signal Collection

### Adzuna (Demand)

```
GET https://api.adzuna.com/v1/api/jobs/us/search/1
  ?app_id={ADZUNA_APP_ID}
  &app_key={ADZUNA_APP_KEY}
  &what_phrase={role_phrase}
  &results_per_page=1
```

- Returns `count`: total jobs matching phrase
- 6 roles tracked: fractional CFO, CMO, CTO, COO, CRO, interim CEO
- Normalisation: `min(100, round(log10(count+1) / log10(200) * 100))`
- Floor: 15 (inactive market, not zero)

### Google Trends (Culture)

```
POST https://api.apify.com/v2/acts/apify~google-trends-scraper/runs
Body: { searchTerms: [...], geo: "US", timeRange: "today 3-m" }
```

- Poll until SUCCEEDED (max 120s)
- Extract `interestOverTime_timelineData` where `hasData[0] === true`
- Average last 4 valid weekly values per term
- Average across 4 terms = culture score (native 0-100)

### SEC EDGAR Form D (Leading Indicator)

```
GET https://efts.sec.gov/LATEST/search-index
  ?forms=D
  &dateRange=custom
  &startdt={90 days ago}
  &enddt={today}
  &q="software" OR "technology" OR "SaaS"
User-Agent: FWI-Pulse/1.0 research@fractionl.ai
```

- Returns `hits.total.value`: count of Form D filings
- Normalisation: `min(100, round((count / 800) * 50))`
- 800 filings = score 50 (baseline normal market activity)
- Stored as signal_type='demand', category='vc_pipeline'

### NewsAPI (Culture)

```
GET https://newsapi.org/v2/everything
  ?q="fractional CMO" OR "fractional CFO" OR "fractional CTO" OR "fractional executive"
  &from={28 days ago}
  &language=en
  &apiKey={NEWS_API_KEY}
```

- 28-day window (free tier limit)
- Exact phrase matching with quotes
- Normalisation: `min(100, round(sqrt(count) * 15))`

---

## 5. FWI Composite Formula

```
FWI = (demand_score × 0.50) + (supply_score × 0.20) + (momentum_score × 0.30)

demand_score  = average of all 'demand' signals (Adzuna per-role + SEC Form D)
supply_score  = 50 (neutral baseline until Contra integration Q2 2026)
momentum_score = average of all 'momentum' signals (Google Trends + NewsAPI)
```

**Confidence:** `unique_sources / 4`. If all 4 sources succeed, confidence = 1.0.

---

## 6. Agent API (`fwi-api`)

Three routes, all via the `fwi-api` Supabase edge function:

| Route | Auth | Response |
|-------|------|---------|
| `GET /fwi-api/current` | None | Latest FWI score + components + movers |
| `GET /fwi-api/history?months=N` | None | Weekly history for N months (max 12) |
| `POST /fwi-api/trigger` | Service role | Trigger fresh ingest-signals run |

Response headers: `Cache-Control: public, max-age=3600`, `X-FWI-Score`, `X-FWI-Label`

---

## 7. Frontend Architecture

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **Animation:** Framer Motion
- **Charts:** Recharts
- **State:** React hooks + Supabase JS client
- **Auth:** Supabase Auth (email + magic link)

### Key Components

| Component | Purpose |
|-----------|---------|
| `HeroSection` | Headline FWI gauge + delta |
| `SignalsTable` | Per-role signal breakdown |
| `AIInsights` | Cached insight cards from generate-pulse-insights |
| `FractionalReadiness` | Overall readiness gauge wired to live FWI |
| `useFWIData` | Hook fetching `fwi_scores` + `movers` with stale detection |
| `useUserPreferences` | Weight customisation (persisted to `fwi_scores.weights`) |

---

## 8. Environment Variables

### Frontend (`.env.local`)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### Edge Functions (Supabase Dashboard → Secrets)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADZUNA_APP_ID
ADZUNA_APP_KEY
APIFY_API_KEY
NEWS_API_KEY
OPENAI_API_KEY
```

---

## 9. Deployment

- **Frontend:** Vercel. Auto-deploys on push to `main` (`pulse.fractionl.ai`).
- **Edge functions:** Supabase. Deploy via Supabase CLI: `supabase functions deploy <name>`.
- **Database:** Supabase Postgres. Migrations in `supabase/migrations/`.