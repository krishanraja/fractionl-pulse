# Pulse by Fractionl

**The Fractional Working Index (FWI)** — the weekly 0-100 composite index for the fractional executive economy. A live dashboard with a weekly index, built for human analysts and AI agents alike.

[![Status](https://img.shields.io/badge/status-live-brightgreen)](https://pulse.fractionl.ai)
[![Sources](https://img.shields.io/badge/data%20sources-21-blue)](https://pulse.fractionl.ai)
[![Pipeline](https://img.shields.io/badge/pipeline-daily-orange)](https://pulse.fractionl.ai)
[![API](https://img.shields.io/badge/API-public%20%2F%20no%20auth-purple)](https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current)

> Live: **https://pulse.fractionl.ai**
> Public API: **https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current**

---

## TL;DR

Pulse publishes a single weekly 0–100 score (the FWI) measuring the health of the fractional executive market across **21 independent data sources**, blended into three pillars: **demand**, **supply**, and **culture**. The score is open to humans on the web dashboard and to AI agents through a public REST API and an MCP tool definition.

The output answers one question: **"How healthy is the fractional executive market right now, and where is it heading?"**

---

## Why Pulse Exists

The fractional executive economy is the fastest-growing segment of the talent market, yet operators inside it (fractional execs, agencies, marketplaces, VCs, HR tech) are flying blind. They rely on:

- LinkedIn anecdotes
- Stale quarterly staffing reports
- Single-source job board counts
- Gut feel

Pulse is the first product that turns this market into a **measurable, trackable index**. Composite, normalized, weekly, agent-readable.

**North Star:** a solo fractional executive opens Pulse and, in one glance, knows whether this month's slow inbound is the market or them, and whether to raise rates or hold, with enough confidence to act. See [docs/NORTH_STAR.md](docs/NORTH_STAR.md).

---

## Who It's For (ICP at a glance)

| Persona | Income / size | Why it matters to them |
|---------|---------------|--------------|
| **Fractional executives** ($200K+ income) | Solo operator | Read whether this month's slow inbound is the market or them; time market entry, set rates, decide when to take new clients. The dashboard is free, so one well-timed rate move is the entire ROI. |
| **Boutique staffing agencies** ($1M–20M rev) | 5–50 person | Competitive intel, market timing, advisory ammo against larger firms. |
| **Career coaches & accelerators** | Varies | Credibility tool — replace gut feel with cited data when advising clients on fractional transitions. |
| **HR tech / talent marketplaces** | SaaS | Embed the FWI as a market intelligence layer. White-label API enriches their product without building a research function. |
| **VC / PE firms** ($50M+ AUM) | Investor | Validate workforce thesis. The Form D Lead mirrors their own deal flow patterns. |
| **Enterprise HR / talent ops** | 500+ employees | Quantify hire-fractional-vs-full-time decisions. De-risk workforce planning. |
| **Business media & analysts** | Outlet / firm | Cited weekly index, license raw feed, embed widget. |

Full ICP, outcomes, objection handling, and outbound hooks are in [`docs/SALES_PLAYBOOK.md`](docs/SALES_PLAYBOOK.md).

---

## Outcomes Pulse Drives

- **Pricing power** — fractional execs raise rates 10–25% with confidence during "Surging" weeks
- **Inbound timing** — agencies launch campaigns when culture momentum is rising, not after
- **Talent placement velocity** — marketplaces match faster when role-level demand is visible
- **Investment confirmation** — VCs validate portfolio workforce strategy with an external composite
- **Editorial leverage** — media gets a single citable weekly number with a defensible methodology
- **Agent automation** — AI agents query one endpoint to answer hiring-timing questions instead of stitching together five APIs

---

## What's Live Today

- **21 data sources**, ingested daily, normalized to 0-100, anomaly-guarded
- **Three pillars**: Demand (50%), Supply (20%), Culture (30%)
- **Free full dashboard** at `pulse.fractionl.ai`: Overall FWI, all three sub-indices, 12-month history and trend, all 21 source signals, AI insight cards, Content Radar, a personalized role-aware readiness read, and the weekly brief. There is no human paywall (the $99/mo human "Pro" tier and the waitlist-as-primary model were retired in the 2026-07 pivot; see [docs/NORTH_STAR.md](docs/NORTH_STAR.md))
- **Personalized, role-aware read**: the fractional role is captured at signup, so the readiness gauge and the "Ask the index" verdict read for the user's own role vs the market ("your lane is +X% vs market")
- **Public REST API**: `/current`, `/history?months=N` are genuinely no-auth in production (the bare curl returns HTTP 200); `/trigger` is service-role only
- **Metered agent API**: a signed-in user self-serves a FREE API key at `pulse.fractionl.ai/pricing` for a metered 1,000 requests/day tier via the `x-api-key` header; keyed responses carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`. Higher keyed limits and enterprise volume are arranged with sales at `data@fractionl.ai`
- **Two MCP tools** (`get_fractional_working_index`, `get_fwi_weekly_brief`) exposed by a live hosted MCP server (no auth, attach by URL at `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp`); agents can also call the live REST API directly
- **AI insight cards** generated by GPT-4o-mini, cached 12h
- **Weekly market intelligence brief** as Markdown export (`/export-brief`) for press, newsletters, agents
- **About 12 weeks of backfilled history** (and accumulating weekly) for trendlines
- **Daily Vercel cron** (06:00 UTC) + redundant weekly Monday cron, with retry logic and Resend email alerts on failure
- **Per-source health monitoring** surfaced in the dashboard
- **Auth** powered by Supabase Auth (email magic link; fractional role captured at signup)

---

## Pricing & Access

The human dashboard is **free in full**. Monetization is the metered agent API plus enterprise and data licensing. See [docs/NORTH_STAR.md](docs/NORTH_STAR.md) for why.

| Tier | Price | What you get |
|------|-------|--------------|
| **Dashboard (human)** | **Free** | The entire dashboard: Overall FWI, all three sub-indices, 12-month history and trend, all 21 source signals, AI insight cards, Content Radar, a personalized role-aware readiness read, and the weekly brief. No paywall. |
| **Agents & API (metered)** | Free public read; free keyed tier 1,000 req/day; higher tiers on request | The public REST and hosted MCP read endpoints need no auth. A signed-in user self-serves a free API key at `pulse.fractionl.ai/pricing` and sends it as the `x-api-key` header for a metered 1,000 req/day tier. Keyed responses carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`. |
| **Enterprise & Data** | Talk to us (`data@fractionl.ai`) | High-volume or unlimited API limits, raw signal and score exports, data licensing and citations, white-label and vertical indices, SSO and SLA. |

> The $99/mo human "Pro" tier and the waitlist-as-primary model were retired in the 2026-07 pivot. A human paid tier could be reintroduced later; the historical pricing detail is retained in [docs/MONETIZATION_STRATEGY.md](docs/MONETIZATION_STRATEGY.md).

### Get an API key

1. Sign in at [`pulse.fractionl.ai`](https://pulse.fractionl.ai).
2. Go to **`/pricing`** and choose **Get an API key** (self-serve, free tier, 1,000 req/day). The plaintext key is shown once; only its SHA-256 hash is stored.
3. Send it on any read request as the `x-api-key` header:

```bash
curl -H "x-api-key: pk_live_..." \
  https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
```

Keyed responses include `X-RateLimit-Limit` and `X-RateLimit-Remaining`; exceeding the daily limit returns HTTP 429. For higher limits or enterprise volume, contact `data@fractionl.ai`.

---

## Agent Integration (start here)

No auth required for the read endpoints. As of 2026-05-30 the public agent API is genuinely no-auth in production: the bare curl below returns HTTP 200 with no header (`supabase/config.toml` sets `verify_jwt=false` for `fwi-api` and `export-brief`). Build against these in 2 minutes:

```bash
# Get the current FWI score
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current

# Get 3 months of weekly history
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3"

# Get the weekly market intelligence brief as Markdown
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief
```

Response includes shortcut headers `X-FWI-Score` and `X-FWI-Label` (plus `Cache-Control`) for cheap polling without parsing the body. Fetch the current reading live rather than hardcoding it (recent live reading: about FWI 42.4, label Cooling, as of 2026-05-25).

Machine-readable discovery surfaces for agents: **`/product-truth.json`**, **`/llms.txt`**, and **`/.well-known/ai-plugin.json`**.

Optional metered tier: sign in and self-serve a free API key at `pulse.fractionl.ai/pricing`, then send it as the `x-api-key` header for a metered 1,000 req/day tier (keyed responses carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`; exceeding the limit returns HTTP 429). The anonymous no-auth read above stays free and unmetered. See [Pricing & Access](#pricing--access).

- Full API reference: [`docs/AGENT_INTEGRATION.md`](docs/AGENT_INTEGRATION.md)
- MCP tools (`get_fractional_working_index`, `get_fwi_weekly_brief`): [`docs/MCP_TOOL.md`](docs/MCP_TOOL.md)
- Sales/marketing anchors for AI sales agents: [`docs/SALES_PLAYBOOK.md`](docs/SALES_PLAYBOOK.md)
- Outbound and demo guidance for agent-driven GTM: [`docs/AGENT_BRIEFING.md`](docs/AGENT_BRIEFING.md)

---

## The Index Methodology

```
FWI = (Demand × 0.50) + (Supply × 0.20) + (Culture × 0.30)
```

If a pillar has no live data in a given week, its weight is **redistributed proportionally** to the remaining pillars and the response surfaces this in `meta.dataCompleteness` and `components.supply.status`. No silent gap-filling.

### Signal Architecture (21 sources)

| # | Signal | Source | Pillar | What it measures |
|---|--------|--------|--------|------------------|
| 1 | Fractional job postings | Adzuna | Demand | Active hiring for 6 fractional C-suite roles |
| 2 | Google Jobs cross-check | SerpAPI | Demand | Independent job count validation |
| 3 | VC funding pipeline (the Form D Lead) | SEC EDGAR Form D | Demand | Form D filing velocity as a 1-3 month leading indicator: companies file within 15 days of a raise, then enter the fractional buyer pool 1-3 months later |
| 4 | Demand search interest | SerpAPI Trends | Culture | Google Trends for fractional CFO/CMO/CTO/executive |
| 5 | Demand search (fallback) | Apify Google Trends | Culture | Backup search interest via Apify actor |
| 6 | News coverage | NewsAPI | Culture | Article volume over 28 days |
| 7 | News cross-check | Mediastack | Culture | Independent news API for coverage validation |
| 8 | News breadth | Brave News | Culture | Third news source for triangulation |
| 9 | Web discourse volume | Brave Web Search | Culture | Total web mentions across sites |
| 10 | Prestige media (UK) | The Guardian | Culture | Elite media coverage, 90-day window |
| 11 | Prestige media (US) | NY Times | Culture | Elite media coverage, 90-day window |
| 12 | Podcast mentions | Podchaser | Culture | Audio content discussing fractional work |
| 13 | Community discourse | Reddit | Culture | Posts + engagement in relevant subreddits |
| 14 | Tech discourse | Hacker News | Culture | Stories + points on HN (Algolia API) |
| 15 | Professional profiles | People Data Labs | Supply | Fractional executive profile counts by role |
| 16 | LinkedIn proxy | SerpAPI | Supply | `site:linkedin.com/in` result counts |
| 17 | Marketplace listings | GoFractional | Supply | Active fractional exec listings |
| 18 | Supply intent (Apify) | Apify Google Trends | Supply | Searches like "become fractional executive" |
| 19 | Supply intent (SerpAPI) | SerpAPI Trends | Supply | Independent supply-intent trend validation |
| 20 | Macro context | FRED (St. Louis Fed) | Context | JOLTS openings, unemployment rate, initial claims |
| 21 | Self-employment | Census ACS | Context | US self-employment household percentage |

**The Form D Lead** is Pulse's method of using SEC Form D filing velocity as a 1 to 3 month leading indicator of fractional executive demand (companies file Form D within 15 days of a raise, then enter the fractional buyer pool 1 to 3 months later). It is the differentiator no competitor has.

**Context signals (FRED, Census)** are stored and exposed but excluded from the composite score — they enrich narrative without contaminating the index.

### Data Integrity

- **Anomaly guard** — rejects any signal more than 3 standard deviations from its 8-week rolling mean
- **Weighted confidence** — every weekly score carries a 0–1 completeness score reflecting how many of the 21 sources reported (each source has a domain-weighted contribution, not a flat 1/21)
- **Week-over-week deltas** — movers are computed against actual prior-week scores, not synthetic baselines
- **Idempotent writes** — `ON CONFLICT` upserts on `(date, source, signal_type, category)`
- **Per-source health** — `data_source_health` row updated every run with status, error count, last success
- **Email alerts** — `send-pipeline-alert` edge function fires Resend emails on failed daily ingests

### FWI Scale

| Range | Label | What it means |
|-------|-------|---------------|
| 75–100 | **Surging** 🚀 | Exceptional demand. Fractional executives have pricing power. |
| 60–74 | **Growing** 📈 | Strong market. Opportunities abundant for qualified operators. |
| 45–59 | **Stable** ➡️ | Balanced conditions. Normal hiring cadence. |
| 30–44 | **Cooling** 📉 | Softening demand. Selectivity increasing. |
| 0–29 | **Contracting** ⚠️ | Market under pressure. Supply exceeds demand. |

---

## Architecture

**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Framer Motion · Recharts · React Query · Supabase Realtime
**Backend:** Supabase (Postgres + Edge Functions on Deno)
**Scheduling:** Vercel Cron (daily 06:00 UTC + redundant weekly Monday 06:00 UTC) with pg_cron safety net
**Deployment:** Vercel (`pulse.fractionl.ai`)
**Email alerts:** Resend (via `send-pipeline-alert` edge function)
**AI insights:** OpenAI GPT-4o-mini

### Edge Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `ingest-signals` | Collects 21 sources, normalizes to 0–100, anomaly guards, upserts `signals` | Vercel cron + manual |
| `calculate-fwi` | Composites signals into FWI + movers with WoW deltas | Called by `ingest-signals` |
| `generate-pulse-insights` | GPT-4o-mini AI insight cards, 12h cache | Called by daily cron + on-demand from frontend |
| `fwi-api` | Public REST endpoint: `/current`, `/history`, `/trigger` | Always-on |
| `export-brief` | Markdown weekly market brief for press/agents | Always-on |
| `backfill-historical` | One-time 12-week backfill of historical-capable sources | Manual |
| `send-pipeline-alert` | Sends Resend email on critical/warning pipeline failures | Called by Vercel cron |

### Database Tables

| Table | Purpose |
|-------|---------|
| `signals` | Raw ingested data: one row per `(date, source, signal_type, category)` |
| `fwi_scores` | Weekly composite scores with weights, completeness, metadata |
| `movers` | Top-moving roles & signals per weekly run |
| `cached_insights` | AI insight cards, cached 12 hours |
| `pipeline_runs` | Execution log for every ingest and calculate run |
| `data_source_health` | Per-source health monitoring (21 sources) |
| `waitlist` | Legacy Pulse Pro early-access signups, retained (anon insert, service-role read); not the current model |
| `api_keys` | Metered agent-API key store: `user_id`-owned rows minted by `manage-api-key`, metered per key per day by `fwi-api`. Only the SHA-256 `key_hash` is stored, never the plaintext key |

RLS is locked down — public read on read-only tables, service-role-only writes, anon insert on `waitlist`. See `supabase/migrations/005_tighten_signals_rls.sql`.

### Data Flow

```
DEMAND                          SUPPLY                        CULTURE
Adzuna (6 roles) ─────┐        PDL Profiles ─────┐           Google Trends ────────┐
SerpAPI Google Jobs ──┤        SerpAPI LinkedIn ─┤           NewsAPI ──────────────┤
SEC EDGAR Form D ─────┘        GoFractional ─────┤           Mediastack ───────────┤
                                Supply Trends ────┤           Brave News + Web ────┤
                                SerpAPI Supply ───┘           Guardian + NYT ──────┤
                                                              Podchaser ───────────┤
CONTEXT                                                       Reddit + HN ─────────┘
FRED (3 series) ─────┐                    │
Census ACS ──────────┘                    ▼
                              ingest-signals (Vercel cron, daily 06:00 UTC)
                                          │
                          ┌───────────────┴── anomaly guard (3σ / 8w) ──> rejected log
                          ▼
                     signals table (idempotent upsert)
                          │
                     calculate-fwi
                          │
              ┌───────────┼─────────────┬──────────────┐
              ▼           ▼              ▼              ▼
        fwi_scores    movers      data_source_health   pipeline_runs
              │           │
              ▼           ▼
     ┌──────────────┬─────────────┬─────────────┐
     ▼              ▼             ▼             ▼
   fwi-api    generate-      export-brief    React Dashboard
  (agents)    insights       (Markdown)      (Realtime + RQ)
```

---

## Development Setup

```bash
git clone https://github.com/krishanraja/fractionl-pulse
cd fractionl-pulse
npm install
npm run dev
```

### Edge Function Secrets (Supabase Dashboard)

| Key | Source | Required |
|-----|--------|----------|
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Adzuna | Yes |
| `APIFY_API_KEY` | Apify (Google Trends + Reddit + GoFractional) | Yes |
| `NEWS_API_KEY` | NewsAPI | Yes |
| `OPENAI_API_KEY` | OpenAI | Yes |
| `SERP_API_KEY` | SerpAPI | Yes |
| `BRAVE_API_KEY` | Brave Search | Yes |
| `FRED_API_KEY` | FRED | Yes |
| `GUARDIAN_API_KEY` | The Guardian | Yes |
| `NYT_API_KEY` | NY Times Article Search | Yes |
| `MEDIASTACK_API_KEY` | Mediastack | Yes |
| `PODCHASER_API_KEY` | Podchaser GraphQL | Yes |
| `PDL_API_KEY` | People Data Labs | Recommended (drives live supply) |
| `RESEND_API_KEY` | Resend (used by `send-pipeline-alert`) | Yes |
| `SKIP_SOURCES` | Comma-separated source names to skip | Optional |

### Vercel Environment Variables

| Key | Purpose |
|-----|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Authenticates cron trigger to Supabase |
| `CRON_SECRET` | Verifies Vercel Cron requests |

---

## Documentation Map

| Doc | What it's for |
|-----|---------------|
| [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md) | The one product outcome, the moat metric, and the monetization decision (free dashboard + metered agent API) |
| [`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md) | System architecture, schema, edge functions, normalization formulas |
| [`docs/AGENT_INTEGRATION.md`](docs/AGENT_INTEGRATION.md) | Public API reference, response schema, caching guidance |
| [`docs/MCP_TOOL.md`](docs/MCP_TOOL.md) | MCP tool definition + Claude/OpenAI implementation examples |
| [`docs/AGENT_BRIEFING.md`](docs/AGENT_BRIEFING.md) | What AI agents need to say (and not say) about Pulse |
| [`docs/SALES_PLAYBOOK.md`](docs/SALES_PLAYBOOK.md) | ICP, outcomes, objection handling, outbound hooks for sales/marketing agents |
| [`docs/MONETIZATION_STRATEGY.md`](docs/MONETIZATION_STRATEGY.md) | Pricing tiers, data licensing, partnership model, financial projections |
| [`docs/DATA_SOURCES_ROADMAP.md`](docs/DATA_SOURCES_ROADMAP.md) | Live source inventory + roadmap for new sources, webhooks, marketplace integrations |
| `/product-truth.json`, `/llms.txt`, `/.well-known/ai-plugin.json` | Machine-readable discovery surfaces for agents (served from the live site) |

---

## Contact

- **Live product:** [pulse.fractionl.ai](https://pulse.fractionl.ai)
- **Parent product:** [fractionl.ai](https://fractionl.ai)
- **Data licensing / API access / press:** **data@fractionl.ai**
