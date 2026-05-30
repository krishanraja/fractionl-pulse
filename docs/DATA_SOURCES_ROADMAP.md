# Data Sources: Live Inventory + Roadmap

The credibility and value of the FWI depend entirely on the quality, breadth, and freshness of underlying data. This document is the living source of truth for what's live today, what's planned, and how we monitor data quality.

---

## 1. Live Source Inventory (21 sources)

**Total**: 17 composite + 4 context (FRED + Census, stored not scored).

### Demand pillar (50% weight)

| Source | Signal | Method | Status | Cost / call |
|--------|--------|--------|--------|-------------|
| **Adzuna** | Fractional job postings, 6 C-suite roles | REST API, `what_phrase` exact-phrase | 🟢 Live | $0 (free tier) |
| **SerpAPI Google Jobs** | Independent Google Jobs cross-check | SerpAPI engine, exact phrase per role | 🟢 Live | ~$0.005 |
| **SEC EDGAR Form D** | VC funding pipeline, tech/SaaS, 90-day rolling | EDGAR full-text search | 🟢 Live | $0 (gov) |

### Supply pillar (20% weight, redistributes if empty)

| Source | Signal | Method | Status | Cost / call |
|--------|--------|--------|--------|-------------|
| **People Data Labs** | Profile counts containing fractional/interim title terms | PDL Person Search API | 🟢 Live | ~$0.06 |
| **SerpAPI LinkedIn** | `site:linkedin.com/in "fractional CFO"` proxy | SerpAPI Google Search | 🟢 Live | ~$0.02 |
| **GoFractional** | Active marketplace listings | Apify scraper actor | 🟢 Live | ~$0.01 |
| **Apify Trends (supply intent)** | Searches like "become fractional executive" | Apify google-trends-scraper | 🟢 Live | ~$0.01 |
| **SerpAPI Trends (supply intent)** | Independent supply-intent cross-check | SerpAPI Trends | 🟢 Live | ~$0.005 |

### Culture pillar (30% weight)

| Source | Signal | Method | Status | Cost / call |
|--------|--------|--------|--------|-------------|
| **SerpAPI Google Trends** | Search interest, 90-day, US geo | SerpAPI Trends (primary) | 🟢 Live | ~$0.005 |
| **Apify Google Trends** | Backup search-interest provider | Apify google-trends-scraper | 🟢 Live | ~$0.01 |
| **NewsAPI** | Article volume, 28-day, exact phrase | REST API | 🟢 Live | $0 (free tier) |
| **Mediastack** | Independent news cross-check | REST API | 🟢 Live | $0 (free tier) |
| **Brave News** | News-vertical search | Brave Search API | 🟢 Live | ~$0.003 |
| **Brave Web Search** | Total web mentions across sites | Brave Search API | 🟢 Live | ~$0.003 |
| **The Guardian** | Elite UK media, 90-day | Guardian Open Platform API | 🟢 Live | $0 |
| **NY Times** | Elite US media, 90-day | NYT Article Search API | 🟢 Live | $0 |
| **Podchaser** | Podcast episodes mentioning fractional terms | Podchaser GraphQL API | 🟢 Live | $0 |
| **Reddit** | Posts + engagement in relevant subreddits | Apify Reddit scraper | 🟢 Live | ~$0.005 |
| **Hacker News** | Stories + points | Algolia HN Search | 🟢 Live | $0 |

### Context (stored, excluded from composite)

| Source | Signal | Method | Status |
|--------|--------|--------|--------|
| **FRED — JOLTS** | US Job Openings (monthly) | FRED API | 🟢 Live |
| **FRED — Unemployment** | US Unemployment Rate (monthly) | FRED API | 🟢 Live |
| **FRED — Initial Claims** | US Initial Jobless Claims (weekly) | FRED API | 🟢 Live |
| **Census ACS** | Self-employment household percentage | Census API | 🟢 Live |

---

## 2. Source-Confidence Weights

Each source has a domain-weighted contribution to the data-completeness score, baked into `SOURCE_CONFIDENCE_WEIGHTS` in `supabase/functions/ingest-signals/index.ts`:

| Source | Weight |
|--------|--------|
| Adzuna | 0.14 |
| SEC EDGAR | 0.10 |
| People Data Labs | 0.10 |
| SerpAPI Jobs | 0.08 |
| Google Trends (Apify) | 0.08 |
| SerpAPI LinkedIn | 0.06 |
| SerpAPI Trends | 0.06 |
| GoFractional | 0.05 |
| NewsAPI | 0.05 |
| Brave News | 0.04 |
| Apify supply trends | 0.04 |
| Brave Web | 0.03 |
| Mediastack | 0.03 |
| SerpAPI supply trends | 0.03 |
| Guardian | 0.02 |
| NY Times | 0.02 |
| Podchaser | 0.02 |
| Reddit | 0.02 |
| Hacker News | 0.01 |
| FRED | 0.01 |
| Census ACS | 0.01 |

Weights reflect signal-quality + uniqueness, not raw volume. They do **not** measure prediction accuracy.

---

## 3. Data Quality Architecture

### Anomaly guard

For every successful signal, the ingest function fetches the last 8 weeks of values for `(source, category)`. If `|value − rolling_mean| / rolling_stddev > 3` (and the history has at least 3 points with `stddev > 1`), the signal is **rejected** from the upsert and logged. The composite is never contaminated by an outlier from a single buggy source.

### Cross-source triangulation

- 3 news APIs (NewsAPI, Mediastack, Brave) cover the same culture signal
- 2 Google Trends providers (SerpAPI primary, Apify fallback)
- 4 supply sources (PDL, LinkedIn proxy, GoFractional, supply-intent search)
- 2 demand sources for jobs (Adzuna, SerpAPI Google Jobs)

Single-source disruptions don't take the index down.

### Idempotent writes

`UPSERT ON CONFLICT (date, source, signal_type, category)` — re-running the pipeline on the same date is safe.

### Per-source health monitoring

Every ingest run updates `data_source_health.{status, last_checked, last_success, error_count}`. The dashboard's `DataHealthCard` surfaces health badges in real time via Supabase Realtime.

### Pipeline run log

Every cron + manual run writes a `pipeline_runs` row with status, records inserted, confidence, error, and metadata (which sources succeeded, which failed). Two views — `pipeline_health` and `data_quality_summary` — expose this for the dashboard.

### Email alerts

`send-pipeline-alert` fires Resend transactional emails on critical (ingest failure) or warning (insights generation failure) events.

---

## 4. API & Agent-Native Surfaces

### Live now

- 🟢 **Public no-auth REST API** — as of 2026-05-30, `supabase/config.toml` sets `verify_jwt=false` for `fwi-api` and `export-brief`, and `fwi-api` was redeployed. The documented bare curl now returns HTTP 200 (previously 401 `UNAUTHORIZED_NO_AUTH_HEADER` from the gateway). The agent-native, query-in-two-minutes, no-auth claim is now true.
  - `GET /fwi-api/current` (no auth) — latest weekly composite + components + weights + delta30d + top movers + full source breakdown + meta (dataCompleteness, nextUpdate). Returns `Cache-Control` and `X-FWI-Score` / `X-FWI-Label` headers.
  - `GET /fwi-api/history?months=N` (no auth, N clamped 1–12) — weekly data points.
  - `GET /export-brief` (no auth) — `?format=markdown` (default, downloadable .md) or `?format=json`.
  - `POST /fwi-api/trigger` — service-role bearer only (NOT public).
  - Example: `curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current`
- 🟢 **Markdown brief export** — working via `/export-brief`.
- 🟢 **Machine-readable discovery surfaces** — `/product-truth.json` and `/llms.txt` shipped this pass for agent and LLM discovery.
- 🟢 **MCP tools + hosted server** — two tools (`get_fractional_working_index`, `get_fwi_weekly_brief`) exposed by a LIVE hosted MCP server (Streamable HTTP, no auth) at `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp`. Agents can also call the REST API directly.
- 🟢 **`/.well-known/ai-plugin.json`** — live discovery surface (HTTP 200).

### Roadmap (not yet shipped)
- 🚧 **API key tiered auth** — `api_keys` table is provisioned; rolling out per enterprise customer.

---

## 5. Roadmap

### Near-term (next 1–2 quarters)

- 🚧 **Webhook threshold alerts** — push notifications on band changes, role-level deltas, score crossings (Pro/Enterprise feature)
- 🚧 **API key tiered auth** — `api_keys` table is provisioned; rolling out per enterprise customer
- 🚧 **Stripe billing integration** — self-serve checkout not yet live; today conversions route to the waitlist with manual onboarding and founding-customer pricing. When it ships, the offer flips to "Pro checkout LIVE."
- 🚧 **Hosted MCP server** — deployed MCP endpoint (reference tools + live REST API exist today)
- 🚧 **White-label embeddable widget** — single-script gauge + sub-index cards
- 🚧 **CSV / Parquet export** for Pro and Enterprise

### Source expansion candidates

| Candidate | Pillar | Why | Status |
|-----------|--------|-----|--------|
| **Crunchbase** | Demand | Funding velocity cross-check beyond Form D | 🟡 Evaluating cost vs uplift |
| **Indeed Publisher API** | Demand | Cross-check on Adzuna + SerpAPI jobs | 🟡 Evaluating Publisher Program |
| **A.Team marketplace** | Supply | Direct fractional listings | 🟡 Partnership outreach |
| **Catalant** | Supply | Project marketplace listings | 🟡 Partnership outreach |
| **Twitter/X API v2** | Culture | Real-time fractional discourse | 🟡 Evaluating cost vs ToS risk |
| **Eventbrite** | Culture | Industry-event signals | 🔴 Backlog |
| **Substack** | Culture | Newsletter coverage volume | 🔴 Backlog (RSS-based) |
| **Glassdoor** | Demand | Company reviews mentioning fractional | 🔴 Backlog (ToS-restricted) |
| **LinkedIn Talent Insights** | Demand + Supply | Direct LinkedIn data | ❄️ Cost-prohibitive ($25K+) — proxy via SerpAPI for now |

### Geographic expansion

- 🟢 US — primary, all sources cover
- 🟢 UK — Adzuna, Guardian, NewsAPI all cover
- 🟡 EU — partial Mediastack + Adzuna coverage
- 🔴 APAC — backlog, requires regional sources

### Role expansion

Currently 6 C-suite roles (CFO, CMO, CTO, COO, CRO, CEO). Candidates for expansion (Pro / Enterprise feature):

- Fractional VPs (Sales, Engineering, People)
- Fractional Heads of (Growth, Product)
- Industry-vertical sub-indices (FinTech FWI, SaaS FWI, etc.) — Enterprise custom

---

## 6. Quality Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Daily pipeline success rate | > 98% | < 95% over rolling 7d |
| Source freshness (composite) | < 24h | > 48h triggers `is_stale` flag |
| Source coverage per run | ≥ 17 / 21 | < 14 |
| Anomaly rejection rate | < 5% of signals | > 15% |
| Data completeness | > 0.85 | < 0.75 |

---

## 7. Cost Model

### Variable per-run costs

A single full ingest run touches every source listed above. Estimated cost per run (worst case, all sources fire):

| Source family | Estimated cost / run |
|---------------|---------------------|
| Adzuna + 6 roles | $0 |
| SerpAPI (jobs + trends + LinkedIn + supply) | ~$0.10 |
| Apify (Google Trends + supply trends + Reddit + GoFractional) | ~$0.04 |
| Brave (news + web) | ~$0.006 |
| People Data Labs (per role) | ~$0.36 |
| OpenAI (insights) | ~$0.005 |
| Free APIs (NewsAPI, Mediastack, FRED, Census, NYT, Guardian, Podchaser, HN, SEC) | $0 |
| **Total per daily run** | **~$0.50** |

Daily cron × 30 days = ~$15/mo in variable data cost. Real annual variable cost: ~$180.

### Fixed costs

| Service | Cost / month |
|---------|--------------|
| Adzuna API | $0 (free tier ample for 6 roles) |
| NewsAPI | $0 (free dev tier) — $449 if upgraded |
| Mediastack | $0 (free tier) |
| SerpAPI | $50–$150 depending on volume |
| PDL | $99 (starter) — $500+ at scale |
| Apify | $49 (starter plan) |
| Brave Search | $5–$50 depending on volume |
| Resend | $0–$20 |
| OpenAI | $20–$100 |
| Supabase Pro | $25 |
| Vercel | $0 (Hobby) — $20 (Pro) |
| **Total** | **~$300–$1,000 / mo** |

This is the actual operating cost behind the FWI — useful when prospects ask why a single API can't replicate the index.

---

## 8. Source Disruption Playbook

| Scenario | Detection | Response |
|----------|-----------|----------|
| Single source rate-limited | `data_source_health.status = 'failed'` | Add to `SKIP_SOURCES` env, monitor; composite continues |
| Single source returns garbage | Anomaly guard rejects in next run | Investigate metadata; if persistent, add to `SKIP_SOURCES` |
| Two sources in same pillar fail | Pillar score still computed from remaining; confidence drops | Review within 24h, source replacement plan |
| All supply sources fail | Supply weight redistributes to demand + culture | Surfaced in API response; fix within 48h |
| Anomalous WoW delta (>15 points) | Manual review on `pipeline_runs.metadata` | Compare against priors, possibly reject + recompute |
| API schema change | Edge function logs error | Hotfix function, redeploy via `supabase functions deploy` |

---

## 9. Legal & Terms-of-Service

| Source | Use type | Notes |
|--------|----------|-------|
| Adzuna | API, commercial | Within ToS for derivative analytics |
| SerpAPI | API, commercial | Paid tier, derivative use OK |
| SEC EDGAR | Public government data | Free, no restrictions |
| FRED, Census | Public government data | Free, attribution best practice |
| NewsAPI | API, commercial | Free tier limited, paid tier full commercial |
| Mediastack | API, commercial | Within ToS |
| Brave Search | API, commercial | Within paid plan ToS |
| Guardian | API, commercial | Open Platform allows commercial w/ key |
| NY Times | API, non-commercial dev key | Article counts only — within fair use |
| Podchaser | API, commercial | Within ToS |
| People Data Labs | API, commercial | Aggregate counts only, within ToS |
| Reddit (via Apify) | Scraper | Apify handles ToS; we consume aggregate counts |
| Hacker News | Public Algolia API | Free, no restrictions |
| GoFractional (via Apify) | Scraper | Aggregate listings counts; respects robots.txt |
| Google Trends (Apify / SerpAPI) | API/scraper proxy | Aggregate score values only, within proxy ToS |

We store and expose **aggregate signal values**, not raw third-party content. No source is redistributed verbatim.

---

## 10. Recent Changes

See `git log` and `supabase/migrations/`. Highlights:

- `001_defensible_signals.sql` — initial 4-source schema
- `002_pipeline_scheduling.sql` — pg_cron safety net + freshness function + quality views
- `003_expand_signal_sources.sql` — added 17 sources to `data_source_health`, added `context` signal type
- `004_fix_cached_insights_columns.sql` — `model_used`/`context` schema sync trigger
- `005_tighten_signals_rls.sql` — RLS hardening (public read, service-role-only writes)
- `20260402_create_waitlist.sql` — waitlist table + anon-insert policy
- `f653feb` — Brave Search integration
- `a07f401` — PDL fix activated supply pillar
- `b2760de` — fixed 13 failed sources, 12-week backfill, code splitting

For the live source-by-source state at any moment: `SELECT * FROM data_source_health ORDER BY status, source;`
