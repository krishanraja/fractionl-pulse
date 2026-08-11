# Data Sources: Live Inventory + Roadmap

The credibility and value of the FWI depend entirely on the quality, breadth, and freshness of underlying data. This document is the living source of truth for what's live today, what's planned, and how we monitor data quality.

---

## 1. Live Source Inventory (21 sources)

**Total**: 17 composite + 4 context (stored, not scored). Last reconciled against the live database and `ingest-signals` code: **2026-08-11**.

> For the live source-by-source state at any moment, query `data_source_health` — this table, not this doc, is the operational truth.

> **Production readback, 2026-08-11 02:16 UTC:** the pipeline wrote the day's observation successfully at FWI **51.5 (Stable)**, but the read is degraded at **0.63 weighted completeness** with **13 contributing sources**. This is below the 0.75 completeness and 14-source release-health thresholds. The principal incident is one exhausted SerpAPI account affecting four inputs and 23.8% of configured completeness weight. Guardian returns 401, GoFractional's Apify run returns 403, NewsAPI and SerpAPI LinkedIn are silent against their expected cadence, and FRED has never delivered. The UI and API expose the 63% coverage; this release does not conceal or reclassify the incident. Restore or deliberately retire a source only through the documented methodology change process.

### Demand pillar (50% weight)

| Source | Signal | Method | Cost / call |
|--------|--------|--------|-------------|
| **Adzuna** | Fractional job postings, 6 C-suite roles | REST API, `what_phrase` exact-phrase | $0 (free tier) |
| **SerpAPI Google Jobs** | Second Google Jobs discovery source; may overlap Adzuna results | SerpAPI engine, exact phrase per role | ~$0.005 |
| **SEC EDGAR Form D** | VC funding pipeline, tech/SaaS, 90-day rolling | EDGAR full-text search | $0 (gov) |

### Supply pillar (20% weight, redistributes if empty)

| Source | Signal | Method | Cost / call |
|--------|--------|--------|-------------|
| **SerpAPI LinkedIn** | `site:linkedin.com/in "fractional CFO"` proxy | SerpAPI Google Search | ~$0.02 |
| **Brave Talent** | SerpAPI-independent LinkedIn-profile backstop | Brave Web Search | ~$0.003 |
| **GoFractional** | Active marketplace listings | Apify web-scraper actor | ~$0.01 |
| **SerpAPI Trends (supply intent)** | Searches like "become fractional executive" | SerpAPI Trends | ~$0.005 |

### Culture pillar (30% weight)

| Source | Signal | Method | Cost / call |
|--------|--------|--------|-------------|
| **SerpAPI Google Trends** | Search interest, 90-day, US geo | SerpAPI Trends | ~$0.005 |
| **NewsAPI** | Article volume, 28-day, exact phrase | REST API | $0 (free tier) |
| **Mediastack** | Separate news-API cross-check; article sets may overlap | REST API | $0 (free tier) |
| **Brave News** | News-vertical search | Brave Search API | ~$0.003 |
| **Brave Web Search** | Total web mentions across sites | Brave Search API | ~$0.003 |
| **The Guardian** | Elite UK media, 90-day | Guardian Open Platform API | $0 |
| **Podchaser** | Podcast episodes mentioning fractional terms | Podchaser GraphQL API | $0 |
| **Reddit** | Posts + engagement in relevant subreddits | Apify Reddit scraper | ~$0.005 |
| **Hacker News** | Stories + points | Algolia HN Search | $0 |
| **Wikipedia pageviews** | Article-interest volume for fractional-work topics | Wikimedia REST API | $0 |

### Context (stored, excluded from composite)

| Source | Signal | Method | Notes |
|--------|--------|--------|-------|
| **BLS** | JOLTS openings, unemployment, wages | BLS API | Live since 2026-02 |
| **Census ACS** | Self-employment household percentage | Census API | Live |
| **OpenAlex** | Academic / thought-leadership coverage | OpenAlex API | Live since 2026-02 |
| **FRED** | JOLTS, unemployment, initial claims | FRED API | ⚠️ Configured but has never written a signal; BLS covers the same macro context |

### Retired sources (2026-05-30)

These had been failing every run for weeks and are fully covered by replacements. Their historical signals remain in the `signals` table.

| Source | Retired because | Replaced by |
|--------|-----------------|-------------|
| **Apify Google Trends** (`google_trends`) | Persistent failures; last signal 2026-04-13 | SerpAPI Trends |
| **Apify supply trends** (`supply_trends`) | Persistent failures | SerpAPI supply trends |
| **People Data Labs** | HTTP 404 every run | SerpAPI LinkedIn + Brave Talent |
| **NY Times** | HTTP 401 every run | Guardian |

> ⚠️ Note the concentration risk this created: SerpAPI is now the **only** Google Trends provider (demand-side and supply-side) and a major share of demand + supply coverage. A SerpAPI quota exhaustion (HTTP 429) takes out four sources at once — exactly what happened 2026-08-04.

---

## 2. Source-Confidence Weights

Each source has a domain-weighted contribution to the data-completeness score, baked into `SOURCE_CONFIDENCE_WEIGHTS` in `supabase/functions/ingest-signals/index.ts` (that constant is authoritative; this table mirrors it as of 2026-08-06):

| Source | Weight |
|--------|--------|
| Adzuna | 0.12 |
| SEC EDGAR | 0.09 |
| SerpAPI Jobs | 0.07 |
| Wikipedia pageviews | 0.06 |
| SerpAPI Trends | 0.05 |
| SerpAPI LinkedIn | 0.05 |
| Brave Talent | 0.05 |
| NewsAPI | 0.04 |
| GoFractional | 0.04 |
| BLS | 0.04 |
| Brave News | 0.03 |
| Brave Web | 0.03 |
| Mediastack | 0.03 |
| SerpAPI supply trends | 0.03 |
| Guardian | 0.02 |
| Podchaser | 0.02 |
| Reddit | 0.02 |
| OpenAlex | 0.02 |
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
- 4 supply sources (SerpAPI LinkedIn, Brave Talent, GoFractional, supply-intent search)
- 2 demand sources for jobs (Adzuna, SerpAPI Google Jobs)

Single-source disruptions don't take the index down. **Known exception since the 2026-05-30 retirements: Google Trends has only one provider (SerpAPI), and four sources share the single SerpAPI quota — a provider-level 429 degrades demand, supply, and culture simultaneously.**

### Idempotent writes

`UPSERT ON CONFLICT (date, source, signal_type, category)` — re-running the pipeline on the same date is safe.

### Per-source health monitoring

Every ingest run updates `data_source_health.{status, last_checked, last_success, error_count}`. The dashboard's `DataHealthCard` surfaces health badges in real time via Supabase Realtime.

### Pipeline run log

Every cron + manual run writes a `pipeline_runs` row with status, records inserted, confidence, error, and metadata (which sources succeeded, which failed). Two views — `pipeline_health` and `data_quality_summary` — expose this for the dashboard.

### Email alerts

`send-pipeline-alert` fires Resend transactional emails to `ALERT_EMAILS` (env, comma-separated) on:

- **critical** — the whole daily ingest failed after retries
- **warning** — insights generation failed after a successful ingest
- **warning** — the run "succeeded" but is degraded: data completeness below `COMPLETENESS_ALERT_THRESHOLD` (default 0.75) or healthy sources below `MIN_HEALTHY_SOURCES` (default 14). The email names each failing source with its last error and last-success date, so partial outages (quota 429s, expired keys) can no longer fail silently.

Deliverability: sends go from `ALERT_FROM` (default `alerts@fractionl.ai`). As of 2026-08-07 **fractionl.ai is not a verified domain on the Pulse Resend account**, so the function automatically falls back to Resend's `onboarding@resend.dev` test domain, which can only deliver to the Resend account owner (`ALERT_FALLBACK_TO`, default `hello@krishraja.com`). Verifying fractionl.ai at resend.com/domains (or swapping `RESEND_API_KEY` to the account that already has it verified) restores branded, multi-recipient delivery automatically — no redeploy needed.

---

## 4. API & Agent-Native Surfaces

### Live now

- 🟢 **Public no-auth REST API** — as of 2026-05-30, `supabase/config.toml` sets `verify_jwt=false` for `fwi-api` and `export-brief`, and `fwi-api` was redeployed. The documented bare curl now returns HTTP 200 (previously 401 `UNAUTHORIZED_NO_AUTH_HEADER` from the gateway). The agent-native, query-in-two-minutes, no-auth claim is now true.
  - `GET /fwi-api/current` (no auth) — latest weekly composite + components + weights + delta30d + top movers + full source breakdown + meta (dataCompleteness, nextUpdate). Returns `Cache-Control` and `X-FWI-Score` / `X-FWI-Label` headers.
  - `GET /fwi-api/history?months=N` (no auth, N clamped 1–12) — observed score rows across the requested period.
  - `GET /export-brief` (no auth) — `?format=markdown` (default, downloadable .md) or `?format=json`.
  - `POST /fwi-api/trigger` — service-role bearer only (NOT public).
  - Example: `curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current`
- 🟢 **Markdown brief export** — working via `/export-brief`.
- 🟢 **Machine-readable discovery surfaces** — `/product-truth.json` and `/llms.txt` shipped this pass for agent and LLM discovery.
- 🟢 **MCP tools + hosted server** — four tools (`get_fractional_working_index`, `get_fwi_weekly_brief`, `get_content_radar`, `get_content_brief`) exposed by a live stateless Streamable HTTP server at `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp`. Agents can also call the REST API directly.
- 🟢 **`/.well-known/ai-plugin.json`** — live discovery surface (HTTP 200).
- 🟢 **Public API + optional operational keys (live):** `fwi-api` accepts an optional `x-api-key` and counts usage per key per day against `api_keys`; anonymous reads stay free. A signed-in user mints, lists, or revokes a free key (1,000 requests/day) via `manage-api-key` from `pulse.fractionl.ai/pricing` (plaintext shown once, SHA-256 hash stored). Keyed responses carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`. This is an operational control, not the paid product.

### Roadmap (not yet shipped)
- ⛔ **Paid generic API tiers:** not on the commercial roadmap. Public REST and MCP access remain free. Paid value depends on proprietary, privacy-safe partner cohorts.

---

## 5. Roadmap

### Near-term (next 1–2 quarters)

- 🚧 **Webhook threshold alerts:** push notifications on band changes, role-level deltas, score crossings
- ✅ **Operational API key accounting** (shipped 2026-07): self-serve free keys and `x-api-key` rate accounting on `fwi-api` are live; see Section 4.
- ✅ **Hosted MCP server** (shipped): live at `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp`; see Section 4.
- 🚧 **Partner benchmark ingestion:** define the data dictionary, privacy agreement, suppression rules, and partner-quality checks before accepting first-party engagement data.
- 🚧 **Partner cohort delivery:** private dashboard and export for approved, privacy-safe benchmark cells after dataset release gates are met
- 🚧 **CSV / Parquet export** for data-licensing customers

### Source expansion candidates

| Candidate | Pillar | Why | Status |
|-----------|--------|-----|--------|
| **Crunchbase** | Demand | Funding velocity cross-check beyond Form D | 🟡 Evaluating cost vs uplift |
| **Indeed job-listing access** | Demand | Cross-check on Adzuna + SerpAPI jobs | 🟡 Evaluating official access |
| **A.Team marketplace** | Supply | Direct fractional listings | 🟡 Partnership outreach |
| **Catalant** | Supply | Project marketplace listings | 🟡 Partnership outreach |
| **Twitter/X API v2** | Culture | Recent fractional discourse | 🟡 Evaluating cost vs ToS risk |
| **Eventbrite** | Culture | Industry-event signals | 🔴 Backlog |
| **Substack** | Culture | Newsletter coverage volume | 🔴 Backlog (RSS-based) |
| **Glassdoor** | Demand | Company reviews mentioning fractional | 🔴 Backlog (ToS-restricted) |
| **LinkedIn Talent Insights** | Demand + Supply | Direct LinkedIn data | ❄️ Cost-prohibitive ($25K+) — proxy via SerpAPI for now |

### Geographic expansion

- 🟢 US — primary; the current job, professional-profile, SEC, Census, and BLS collectors are US-scoped
- 🟡 UK — some English-language news inputs include UK material, but the current demand collectors do not support a UK benchmark
- 🟡 EU — partial English-language media context only; no current market benchmark
- 🔴 APAC — backlog, requires regional sources

### Role expansion

Currently 6 C-suite roles (CFO, CMO, CTO, COO, CRO, CEO). Candidates for a future partner benchmark after the core dataset gate:

- Fractional VPs (Sales, Engineering, People)
- Fractional Heads of (Growth, Product)
- Industry-vertical sub-indices (FinTech FWI, SaaS FWI, etc.) — only with sufficient partner-contributed coverage

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
| Apify (Reddit + GoFractional) | ~$0.02 |
| Brave (news + web) | ~$0.006 |
| ~~People Data Labs~~ (retired 2026-05-30) | $0 |
| OpenAI (insights) | ~$0.005 |
| Free APIs (NewsAPI, Mediastack, FRED, Census, Guardian, Podchaser, HN, BLS, OpenAlex, SEC) | $0 |
| **Total per daily run** | **~$0.50** |

Daily cron × 30 days = ~$15/mo in variable data cost. Real annual variable cost: ~$180.

### Fixed costs

| Service | Cost / month |
|---------|--------------|
| Adzuna API | $0 (free tier ample for 6 roles) |
| NewsAPI | $0 (free dev tier) — $449 if upgraded |
| Mediastack | $0 (free tier) |
| SerpAPI | $50–$150 depending on volume |
| ~~PDL~~ (retired 2026-05-30) | $0 |
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
| People Data Labs | API, commercial | Aggregate counts only, within ToS (retired 2026-05-30; historical signals retained) |
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
- `016_ai_rate_limits.sql` — privacy-preserving hourly rate limit for Ask Pulse
- `20260402_create_waitlist.sql` — waitlist table + anon-insert policy
- `f653feb` — Brave Search integration
- `a07f401` — PDL fix activated supply pillar
- `b2760de` — fixed 13 failed sources, 12-week backfill, code splitting

For the live source-by-source state at any moment: `SELECT * FROM data_source_health ORDER BY status, source;`
