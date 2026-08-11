# Data Sources: Live Inventory + Roadmap

The credibility and value of the FWI depend entirely on the quality, breadth, and freshness of underlying data. This document is the living source of truth for what's live today, what's planned, and how we monitor data quality.

---

## 1. Live Source Inventory (21 sources)

**Total**: 17 composite + 4 context (stored, not scored). Last reconciled against the live database and `ingest-signals` code: **2026-08-11**.

> For the live source-by-source state at any moment, query `data_source_health` — this table, not this doc, is the operational truth.

> **Pre-cutover production readback, 2026-08-11 02:16 UTC:** the pipeline wrote the day's observation successfully at FWI **51.5 (Stable)**, but the read was degraded at **0.63 weighted completeness** with **13 contributing sources**. The principal incident was an exhausted SerpAPI account affecting four inputs. Guardian returned 401, GoFractional returned 403, NewsAPI was silent, and FRED had never delivered. This historical readback is retained as the rollout baseline; the DataForSEO cutover must be verified against the release gates below before this note is superseded.

> **Post-cutover production readback, 2026-08-11 17:49 UTC:** the same-day ingest completed with **20 healthy sources**, **0.95 run-reported completeness**, and FWI **51.4 (Stable)**. All four legacy `serpapi_*` index inputs delivered through DataForSEO; Guardian and NewsAPI were healthy; BLS wrote three context rows and FRED wrote one Initial Jobless Claims row. Anomaly rejection and the pre-authorization GoFractional failure left persisted current-day completeness at **0.81 across 17 sources**. The official Apify actor was subsequently authorized and a bounded Console canary returned the first-party published count of **15,000** for **$0.011**. The next scheduled ingest will update GoFractional's production `last_success` and is expected to restore persisted completeness to at least 0.85.

### Demand pillar (50% weight)

| Source | Signal | Method | Cost / call |
|--------|--------|--------|-------------|
| **Adzuna** | Fractional job postings, 6 C-suite roles | REST API, `what_phrase` exact-phrase | $0 (free tier) |
| **DataForSEO Google Jobs** | Second Google Jobs discovery source; may overlap Adzuna results | Six async Google Jobs tasks, exact phrase per role | ~$0.0036 |
| **SEC EDGAR Form D** | VC funding pipeline, tech/SaaS, 90-day rolling | EDGAR full-text search | $0 (gov) |

### Supply pillar (20% weight, redistributes if empty)

| Source | Signal | Method | Cost / call |
|--------|--------|--------|-------------|
| **DataForSEO LinkedIn** | `site:linkedin.com/in "fractional CFO"` proxy | Four DataForSEO organic `site:` queries | ~$0.040 |
| **Brave Talent** | Provider-independent LinkedIn-profile backstop | 4 Brave Web Search calls | ~$0.020 gross |
| **GoFractional** | First-party published operator-network size | Official `apify/web-scraper` actor; $0.02 hard cap | $0.011 canary |
| **DataForSEO Trends (supply intent)** | Searches like "become fractional executive" | DataForSEO Trends | ~$0.011 |

### Culture pillar (30% weight)

| Source | Signal | Method | Cost / call |
|--------|--------|--------|-------------|
| **DataForSEO Google Trends** | Search interest, 90-day, US geo | DataForSEO Trends | ~$0.011 |
| **NewsAPI** | Article volume, 28-day, exact phrase | REST API | $0 (free tier) |
| **Mediastack** | Separate news-API cross-check; article sets may overlap | REST API | $0 (free tier) |
| **Brave News** | News-vertical search | 1 Brave Search API call | ~$0.005 gross |
| **Brave Web Search** | Total web mentions across sites | 4 Brave Search API calls | ~$0.020 gross |
| **The Guardian** | Elite UK media, 90-day | Guardian Open Platform API | $0 |
| **Podchaser** | Podcast episodes mentioning fractional terms | Podchaser GraphQL API | $0 |
| **Reddit** | Recent fractional discussions | 3 Brave `site:reddit.com` searches | ~$0.015 gross |
| **Hacker News** | Stories + points | Algolia HN Search | $0 |
| **Wikipedia pageviews** | Article-interest volume for fractional-work topics | Wikimedia REST API | $0 |

### Context (stored, excluded from composite)

| Source | Signal | Method | Notes |
|--------|--------|--------|-------|
| **BLS** | JOLTS openings, unemployment, wages | BLS API | Live since 2026-02 |
| **Census ACS** | Self-employment household percentage | Census API | Live |
| **OpenAlex** | Academic / thought-leadership coverage | OpenAlex API | Live since 2026-02 |
| **FRED** | Initial Jobless Claims only | FRED API | Unique claims context; retained at the lower 0.01 confidence weight |

### Retired sources (2026-05-30)

These had been failing every run for weeks and are fully covered by replacements. Their historical signals remain in the `signals` table.

| Source | Retired because | Replaced by |
|--------|-----------------|-------------|
| **Apify Google Trends** (`google_trends`) | Persistent failures; last signal 2026-04-13 | DataForSEO Trends |
| **Apify supply trends** (`supply_trends`) | Persistent failures | DataForSEO supply trends |
| **People Data Labs** | HTTP 404 every run | DataForSEO LinkedIn + Brave Talent |
| **NY Times** | HTTP 401 every run | Guardian |

> The 2026-08-04 incident demonstrated provider concentration risk when one SerpAPI quota took out four inputs. DataForSEO replaces that provider, while Brave remains the independent profile-search backstop.

---

## 2. Source-Confidence Weights

Each source has a domain-weighted contribution to the data-completeness score, baked into `SOURCE_CONFIDENCE_WEIGHTS` in `supabase/functions/ingest-signals/index.ts` (that constant is authoritative; this table mirrors it as of 2026-08-06):

| Source | Weight |
|--------|--------|
| Adzuna | 0.12 |
| SEC EDGAR | 0.09 |
| DataForSEO Jobs (`serpapi_jobs`) | 0.07 |
| Wikipedia pageviews | 0.06 |
| DataForSEO Trends (`serpapi_trends`) | 0.05 |
| DataForSEO LinkedIn (`serpapi_linkedin`) | 0.05 |
| Brave Talent | 0.05 |
| NewsAPI | 0.04 |
| GoFractional | 0.04 |
| BLS | 0.04 |
| Brave News | 0.03 |
| Brave Web | 0.03 |
| Mediastack | 0.03 |
| DataForSEO supply trends (`serpapi_supply_trends`) | 0.03 |
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
- 4 supply sources (DataForSEO LinkedIn, Brave Talent, GoFractional, supply-intent search)
- 2 demand sources for jobs (Adzuna, DataForSEO Google Jobs)

Single-source disruptions do not take the index down. Google Trends still has one provider, while the LinkedIn proxy retains Brave as a separate-provider backstop.

### Idempotent writes

`UPSERT ON CONFLICT (date, source, signal_type, category)` — re-running the pipeline on the same date is safe.

### Per-source health monitoring

Every ingest run updates `data_source_health.{status, last_checked, last_success, error_count}`. The dashboard's `DataHealthCard` surfaces health badges in real time via Supabase Realtime.

### Pipeline run log

Every cron + manual run writes a `pipeline_runs` row with status, records inserted, confidence, error, and metadata (which sources succeeded, which failed). Two views — `pipeline_health` and `data_quality_summary` — expose this for the dashboard.

DataForSEO Google Jobs uses a two-stage ledger. `prepare-dataforseo-jobs` submits six idempotent daily tasks at 05:00 UTC and stores task IDs in `pipeline_runs`; `ingest-signals` retrieves the completed results at 06:00 UTC. A running, failed, or ambiguous submission ledger blocks automatic paid resubmission until it is manually reconciled. The only retry override, `retry_rejected_auth=true`, is manual and applies solely to a definitive HTTP 401 ledger with zero task IDs; ambiguous submissions remain blocked.

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
| **Indeed job-listing access** | Demand | Cross-check on Adzuna + DataForSEO jobs | 🟡 Evaluating official access |
| **A.Team marketplace** | Supply | Direct fractional listings | 🟡 Partnership outreach |
| **Catalant** | Supply | Project marketplace listings | 🟡 Partnership outreach |
| **Twitter/X API v2** | Culture | Recent fractional discourse | 🟡 Evaluating cost vs ToS risk |
| **Eventbrite** | Culture | Industry-event signals | 🔴 Backlog |
| **Substack** | Culture | Newsletter coverage volume | 🔴 Backlog (RSS-based) |
| **Glassdoor** | Demand | Company reviews mentioning fractional | 🔴 Backlog (ToS-restricted) |
| **LinkedIn Talent Insights** | Demand + Supply | Direct LinkedIn data | ❄️ Cost-prohibitive ($25K+) — proxy via DataForSEO for now |

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

A normal daily ingest uses the completed Google Jobs tasks plus the live search inputs. The bounded 2026-08-11 canary measured the DataForSEO portion at approximately **$0.0656**: $0.0036 for six Jobs tasks, $0.040 for four LinkedIn `site:` queries, and $0.022 for two Trends tasks.

Provider prices were last checked on 2026-08-11 against [DataForSEO SERP pricing](https://dataforseo.com/apis/serp-api/pricing), [DataForSEO Google Trends pricing](https://dataforseo.com/pricing/keywords-data/google-trends), and [Brave Search API pricing](https://brave.com/search/api/).

| Source family | Estimated cost / run |
|---------------|---------------------|
| Adzuna + 6 roles | $0 |
| DataForSEO (jobs + two Trends tasks + LinkedIn) | ~$0.0656 |
| Apify (Reddit + GoFractional) | ~$0.016 measured/estimated; GoFractional has a $0.02 hard cap |
| Weekly DataForSEO Content Radar (7 related-query Trends + 7 PAA tasks) | ~$0.091 per weekly harvest |
| Brave (12 searches across talent, Reddit, news, and web) | ~$0.060 gross; covered by the recurring $5 monthly credit at current volume |
| ~~People Data Labs~~ (retired 2026-05-30) | $0 |
| OpenAI (insights) | ~$0.005 |
| Free APIs (NewsAPI, Mediastack, FRED, Census, Guardian, Podchaser, HN, BLS, OpenAlex, SEC) | $0 |
| **Total per daily run** | **~$0.14 gross; about $0.08 after the current Brave credit** |

At 30 daily runs, the index collectors consume about **$1.97/month** of DataForSEO credit. At 4.33 weekly harvests, Content Radar adds about **$0.39/month**, for a combined DataForSEO estimate of **$2.36/month** before exceptional manual reruns. Daily Brave usage is about $1.80/month gross and is currently covered by Brave's recurring $5 credit. GoFractional's measured Apify usage adds about $0.33/month at daily cadence. DataForSEO's $50 minimum funded balance does not expire.

The first full Content Radar canary completed on 2026-08-11 with 494 documents (488 after deduplication) and 28 People Also Ask records. Its related-query API responses exposed an object-vs-array parser defect; version 20 fixes that parser using the documented response shape. The paid canary was not repeated automatically.

### Fixed costs

| Service | Cost / month |
|---------|--------------|
| Adzuna API | $0 (free tier ample for 6 roles) |
| NewsAPI | $0 (free dev tier) — $449 if upgraded |
| Mediastack | $0 (free tier) |
| DataForSEO | No monthly fee; $50 minimum funded balance, which does not expire |
| ~~PDL~~ (retired 2026-05-30) | $0 |
| Apify | $49 (starter plan) |
| Brave Search | $5 per 1,000 Search requests, with $5 in recurring monthly credits |
| Resend | $0–$20 |
| OpenAI | $20–$100 |
| Supabase Pro | $25 |
| Vercel | $0 (Hobby) — $20 (Pro) |
| **Total** | **Varies by optional Apify, Brave, OpenAI, Resend, and hosting plans** |

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
| DataForSEO | API, commercial | Paid usage, aggregate derivative values only |
| SEC EDGAR | Public government data | Free, no restrictions |
| FRED, Census | Public government data | Free, attribution best practice |
| NewsAPI | API, commercial | Free tier limited, paid tier full commercial |
| Mediastack | API, commercial | Within ToS |
| Brave Search | API, commercial | Within paid plan ToS |
| Guardian | API, commercial | Open Platform allows commercial w/ key |
| NY Times | API, non-commercial dev key | Article counts only — within fair use |
| Podchaser | API, commercial | Within ToS |
| People Data Labs | API, commercial | Aggregate counts only, within ToS (retired 2026-05-30; historical signals retained) |
| Reddit (via Brave) | API, commercial | Three aggregate `site:reddit.com` result-set searches; no Reddit content is redistributed |
| Hacker News | Public Algolia API | Free, no restrictions |
| GoFractional (via Apify) | Scraper | Aggregate first-party published operator count via the official Apify actor; no profile or listing content is redistributed |
| Google Trends (DataForSEO) | API proxy | Aggregate score values only, within proxy terms |

We store and expose **aggregate signal values**, not raw third-party content. No source is redistributed verbatim.

---

## 10. Recent Changes

See `git log` and `supabase/migrations/`. Highlights:

- `001_defensible_signals.sql` — initial 4-source schema
- `002_pipeline_scheduling.sql` — pg_cron safety net + freshness function + quality views
- `003_expand_signal_sources.sql` — added 17 sources to `data_source_health`, added `context` signal type
- `004_fix_cached_insights_columns.sql` — `model_used`/`context` schema sync trigger
- `005_tighten_signals_rls.sql` — RLS hardening (public read, service-role-only writes)
- `016_ai_rate_limits.sql` - privacy-preserving hourly rate limit for Ask the Index
- `20260811162916_prepare_dataforseo_jobs_cron.sql` — DataForSEO attribution metadata, idempotent Jobs ledger index, and 05:00 UTC preparation cron
- 2026-08-11 DataForSEO cutover — all four legacy `serpapi_*` index IDs retained for API compatibility while runtime provider metadata identifies DataForSEO
- 2026-08-11 Content Radar v20 — DataForSEO related-query and People Also Ask collectors, including the documented object-shaped Trends parser fix
- `20260402_create_waitlist.sql` — waitlist table + anon-insert policy
- `f653feb` — Brave Search integration
- `a07f401` — PDL fix activated supply pillar
- `b2760de` — fixed 13 failed sources, 12-week backfill, code splitting

For the live source-by-source state at any moment: `SELECT * FROM data_source_health ORDER BY status, source;`
