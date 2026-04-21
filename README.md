# Pulse by Fractionl

**The Fractional Working Index (FWI)**: live market intelligence for the fractional executive economy. Built for human analysts and AI agents alike.

[![Status](https://img.shields.io/badge/status-live-brightgreen)](https://fractionl-pulse.vercel.app)
[![Sources](https://img.shields.io/badge/data%20sources-21-blue)](https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current)
[![Schedule](https://img.shields.io/badge/updated-weekly-orange)](https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current)

---

## What It Is

Pulse tracks the fractional executive market through a composite index called the Fractional Working Index, a weekly 0-100 score measuring demand, supply, and cultural momentum across C-suite fractional roles.

It is built to be consumed by AI agents as a primary interface, not as an afterthought. The API, data schema, and methodology are all designed for machine readability first, with a human dashboard layered on top.

---

## Agent Integration (start here)

No auth required for public endpoints.

```bash
# Get current FWI score
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
```

```bash
# Get 3 months of history
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3"
```

Full API reference: [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md)
MCP tool definition: [docs/MCP_TOOL.md](docs/MCP_TOOL.md)

---

## The Index Methodology

**FWI = (Demand x 0.50) + (Supply x 0.20) + (Culture x 0.30)**

### Signal Architecture (21 sources)

| # | Signal | Source | Type | What it measures |
|---|--------|--------|------|-----------------|
| 1 | Fractional job postings | Adzuna | Demand | Active hiring for 6 fractional C-suite roles |
| 2 | Google Jobs cross-check | SerpAPI | Demand | Independent job count validation |
| 3 | VC funding pipeline | SEC EDGAR Form D | Demand | Companies raising capital enter the fractional buyer pool 1-3 months later |
| 4 | Demand search interest | SerpAPI Trends | Culture | Google Trends for "fractional CFO/CMO/CTO/executive" |
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

### Data Integrity

- **Anomaly guard:** Rejects signals more than 3 standard deviations from 8-week rolling average
- **Weighted confidence:** Each week's score carries a 0-1 confidence based on which sources reported
- **Week-over-week deltas:** Movers calculated against prior week's actual scores
- **Idempotent writes:** `ON CONFLICT` upserts prevent duplicate data

### FWI Scale

| Range | Label | What it means |
|-------|-------|--------------|
| 75-100 | Surging | Exceptional demand. Fractional executives have pricing power. |
| 60-74 | Growing | Strong market. Opportunities abundant for qualified operators. |
| 45-59 | Stable | Balanced conditions. Normal hiring cadence. |
| 30-44 | Cooling | Softening demand. Selectivity increasing. |
| 0-29 | Contracting | Market under pressure. Supply exceeds demand. |

---

## Data Flow

```
DEMAND                          SUPPLY                        CULTURE
Adzuna (6 roles) ────┐         PDL Profiles ──────┐          Google Trends ────────┐
SerpAPI Google Jobs ──┤         SerpAPI LinkedIn ──┤          NewsAPI ──────────────┤
SEC EDGAR Form D ─────┘         GoFractional ──────┤          Mediastack ────────────┤
                                Supply Trends ─────┤          Brave News + Web ──────┤
                                SerpAPI Supply ────┘          Guardian + NYT ────────┤
                                                              Podchaser ─────────────┤
CONTEXT                                                       Reddit + HN ───────────┘
FRED (3 series) ──────┐                    │
Census ACS ───────────┘                    ▼
                                   ingest-signals (weekly, Mon 6am UTC)
                                           │
                                   ┌───────┴──────── anomaly guard ──────┐
                                   ▼                                      │
                              signals table                          rejected log
                                   │
                              calculate-fwi
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼               ▼
               fwi_scores      movers        data_source_health
                    │              │
         ┌─────────┼──────┐       │
         ▼         ▼      ▼      ▼
      fwi-api   generate-  React Dashboard
    (agents)    insights
```

---

## Architecture

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion, Chart.js
**Backend:** Supabase (Postgres + Edge Functions on Deno)
**Scheduling:** Vercel Cron (weekly Monday 6am UTC)
**Deployment:** Vercel

### Edge Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `ingest-signals` | Collects 21 data sources, normalizes to 0-100, anomaly guard, writes to `signals` | Vercel Cron (weekly) |
| `calculate-fwi` | Composites signals into FWI score + movers with WoW deltas | Called by ingest-signals |
| `generate-pulse-insights` | GPT-4o-mini AI insight cards, 12h cache | Called by Vercel Cron |
| `fwi-api` | Public REST endpoint: `/current`, `/history`, `/trigger` | Always-on |

### Database Tables

| Table | Purpose |
|-------|---------|
| `signals` | Raw ingested data: one row per source/category/date |
| `fwi_scores` | Weekly composite scores with weights and confidence |
| `movers` | Top-moving roles and signals per weekly run |
| `cached_insights` | AI insight cards, cached for 12 hours |
| `pipeline_runs` | Execution log for every ingest and calculate run |
| `data_source_health` | Per-source health monitoring (21 sources) |

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
| `APIFY_API_KEY` | Apify | Yes |
| `NEWS_API_KEY` | NewsAPI | Yes |
| `OPENAI_API_KEY` | OpenAI | Yes |
| `SERP_API_KEY` | SerpAPI | Yes |
| `BRAVE_API_KEY` | Brave Search | Yes |
| `FRED_API_KEY` | FRED | Yes |
| `GUARDIAN_API_KEY` | The Guardian | Yes |
| `NYT_API_KEY` | NY Times | Yes |
| `MEDIASTACK_API_KEY` | Mediastack | Yes |
| `PODCHASER_API_KEY` | Podchaser | Yes |
| `PDL_API_KEY` | People Data Labs | Recommended |
| `SKIP_SOURCES` | Comma-separated list | Optional |

### Vercel Environment Variables

| Key | Purpose |
|-----|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Authenticates cron trigger to Supabase |
| `CRON_SECRET` | Verifies Vercel Cron requests |

---

## Contact

**Data licensing / API access:** data@fractionl.ai
**Product:** [fractionl.ai](https://fractionl.ai)
