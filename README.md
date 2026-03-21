# Pulse by Fractionl

**The Fractional Working Index (FWI)** — live market intelligence for the fractional executive economy. Built for human analysts and AI agents alike.

[![Status](https://img.shields.io/badge/status-live-brightgreen)](https://fractionl-pulse.vercel.app)
[![Version](https://img.shields.io/badge/version-1.0-blue)](https://github.com/krishanraja/fractionl-pulse)
[![Data](https://img.shields.io/badge/data-weekly-orange)](https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current)

---

## What It Is

Pulse tracks the fractional executive market through a composite index called the Fractional Working Index — a weekly 0–100 score measuring demand, supply, and cultural momentum across C-suite fractional roles.

It is built to be consumed by AI agents as a primary interface, not as an afterthought. The API, data schema, and methodology are all designed for machine readability first, with a human dashboard layered on top.

---

## Agent Integration (start here)

No auth required for public endpoints.

```bash
# Get current FWI score
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
```

Response:
```json
{
  "meta": {
    "index": "Fractional Working Index (FWI)",
    "asOf": "2026-03-21",
    "methodology": "FWI = (Demand × 0.5) + (Supply × 0.2) + (Culture × 0.3)",
    "scale": "0–100: <30 Contracting · 30–44 Cooling · 45–59 Stable · 60–74 Growing · 75+ Surging",
    "dataSource": "live",
    "confidence": 1.0
  },
  "score": {
    "overall": 62.4,
    "label": "Growing",
    "delta30d": 2.1,
    "components": {
      "demand":  { "score": 71.0, "weight": 0.5 },
      "supply":  { "score": 50.0, "weight": 0.2 },
      "culture": { "score": 54.0, "weight": 0.3 }
    }
  },
  "topMovers": [
    { "role": "Fractional CFO", "changePct": 42, "insight": "121 jobs — well above market average" }
  ]
}
```

```bash
# Get 3 months of history
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3"
```

Full API reference: [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md)  
MCP tool definition: [docs/MCP_TOOL.md](docs/MCP_TOOL.md)

---

## The Index Methodology

**FWI = (Demand × 0.50) + (Supply × 0.20) + (Culture × 0.30)**

### Signal Architecture

| Signal | Source | What it measures | Unique angle |
|--------|--------|-----------------|-------------|
| **Fractional job postings** | Adzuna | Demand — active hiring for fractional C-suite roles | Exact phrase matching: only genuine fractional listings, not general exec search |
| **VC funding pipeline** | SEC Form D (EDGAR) | Leading demand indicator | Companies that raised Series A/B/C in last 90 days enter the fractional buyer pool 1–3 months later. No other index uses this. |
| **Search intent** | Google Trends (Apify) | Culture — hiring awareness | 90-day rolling, US-geo, 0–100 native scale. Precedes job postings by 4–6 weeks. |
| **Media coverage** | NewsAPI | Culture — market momentum | Exact phrase mentions over 28 days. Tracks mainstream awareness velocity. |
| **Marketplace listings** | Contra/Toptal *(Q2 2026)* | Supply — actual fractional exec availability | Only source measuring supply-side directly. No competitor tracks this. |

**The defensible combination:** VC funding as a leading demand indicator + supply-side marketplace availability = a signal stack no competitor currently replicates. Twelve months of weekly data creates a historical moat that cannot be bought — only accumulated.

### FWI Scale

| Range | Label | What it means |
|-------|-------|--------------|
| 75–100 | Surging | Exceptional demand. Fractional executives have pricing power. |
| 60–74 | Growing | Strong market. Opportunities abundant for qualified operators. |
| 45–59 | Stable | Balanced conditions. Normal hiring cadence. |
| 30–44 | Cooling | Softening demand. Selectivity increasing. |
| 0–29 | Contracting | Market under pressure. Supply exceeds demand. |

---

## Data Flow

```
Adzuna (job postings) ──────┐
SEC EDGAR (Form D filings) ─┼──► ingest-signals (weekly) ──► signals table
Google Trends (Apify) ──────┤                                      │
NewsAPI (articles) ─────────┘                                      ▼
                                                           calculate-fwi
                                                                   │
                                               ┌───────────────────┤
                                               ▼                   ▼
                                          fwi_scores          movers table
                                         + confidence              │
                                               │                   │
                                    ┌──────────┴──────┐    ┌──────┴──────┐
                                    ▼                 ▼    ▼             ▼
                               fwi-api          generate-   React       AI
                           (agent endpoint)      insights   Dashboard   Agents
```

---

## Current State

| Feature | Status |
|---------|--------|
| React dashboard UI | ✅ Live |
| Adzuna demand signal | ✅ Live |
| Google Trends culture signal | ✅ Live |
| SEC Form D leading indicator | ✅ Live |
| NewsAPI culture signal | ✅ Live |
| Agent API (`/fwi-api`) | ✅ Live |
| AI insight cards | ✅ Live (GPT-4o-mini) |
| Supply signal (Contra/Toptal) | 🔜 Q2 2026 |
| Webhook threshold alerts | 🔜 Q2 2026 |
| Paid API tiers + Stripe | 🔜 Q3 2026 |
| White-label embed | 🔜 Q3 2026 |
| Additional data sources | 🔜 Q4 2026 |

---

## Architecture

**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Framer Motion · Recharts  
**Backend:** Supabase (Postgres + Edge Functions on Deno)  
**Deployment:** Vercel (`fractionl-pulse.vercel.app`)  
**Data collection:** Apify (Google Trends actor) · Adzuna API · SEC EDGAR API · NewsAPI  

### Edge Functions

| Function | Purpose | Schedule |
|----------|---------|----------|
| `ingest-signals` | Collects 4 data sources, normalises to 0–100, writes to `signals` | Weekly (manual until cron configured) |
| `calculate-fwi` | Composites signals into FWI score + movers, writes to `fwi_scores` | After every ingest |
| `generate-pulse-insights` | GPT-4o-mini AI insight cards, 12h cache in `cached_insights` | On demand |
| `fwi-api` | Public REST endpoint — `/current`, `/history`, `/trigger` | Always-on |

### Database Tables

| Table | Purpose |
|-------|---------|
| `signals` | Raw ingested data — one row per source/category/date |
| `fwi_scores` | Weekly composite scores with weights and confidence |
| `movers` | Top-moving roles per weekly run |
| `cached_insights` | AI insight cards, cached for 12 hours |
| `pipeline_runs` | Execution log for every ingest and calculate run |
| `data_source_health` | Per-source health monitoring |
| `api_keys` | API key registry for Pro/Enterprise tier |

---

## Vision: Agent-Native Market Intelligence

The fractional executive market is information-asymmetric. Companies don't know when to hire. Executives don't know when to offer. Staffing platforms don't know how to price.

The FWI exists to fix this — and the way people consume market intelligence is changing. The primary consumers of structured market data in the next two years will be AI agents, not humans reading dashboards. A talent scout agent, a VC portfolio tool, a staffing platform's pricing engine — these will all need clean, queryable, well-documented market data.

Pulse is built for that world:
- **API first** — the dashboard is a skin on the API, not the other way around
- **Structured schema** — every field is typed, named for human legibility, and consistent
- **MCP-ready** — tool definition ships with the repo (see `docs/MCP_TOOL.md`)
- **Agent-friendly caching** — `Cache-Control` headers and `X-FWI-Score` shortcut header for lightweight polling

---

## Roadmap

### Phase 1 — Live Data (Now)
Four-source signal stack live. Dashboard + agent API deployed. Historical data accumulating weekly.

### Phase 2 — Supply Signal + Webhooks (Q2 2026)
- Contra + Toptal marketplace listing scraping (supply-side)
- Webhook threshold alerts (`score_above_75`, `score_below_30`, `weekly_update`)
- Pro API tier with 10k req/day

### Phase 3 — Paid Tiers + Embeds (Q3 2026)
- Stripe billing for Pro/Enterprise API keys
- White-label embed widget for staffing platforms
- CSV/JSON data exports
- Rate index: median fractional rates by role from marketplace listings

### Phase 4 — Expanded Sources (Q4 2026)
- Crunchbase funding rounds (paid API)
- Google Jobs aggregation for non-Adzuna listings
- LinkedIn post velocity (PhantomBuster)
- Substack subscriber growth for fractional exec newsletters

---

## Data Sources

**Current:**
- [Adzuna](https://api.adzuna.com) — Job postings API
- [Google Trends via Apify](https://apify.com/apify/google-trends-scraper) — Search interest scraper
- [SEC EDGAR](https://efts.sec.gov/LATEST/search-index) — Form D filing search
- [NewsAPI](https://newsapi.org) — News article search

**Planned:**
- Contra marketplace listings (supply)
- Toptal profile availability (supply)
- Crunchbase API (funding data)
- LinkedIn post analytics (culture)

---

## Development Setup

```bash
git clone https://github.com/krishanraja/fractionl-pulse
cd fractionl-pulse
npm install
```

**Environment variables** (`.env.local`):
```
VITE_SUPABASE_URL=https://dtlcprcpvdomrehbejhw.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

**Edge function secrets** (set in Supabase Dashboard → Edge Functions → Secrets):
```
ADZUNA_APP_ID=<id>
ADZUNA_APP_KEY=<key>
APIFY_API_KEY=<key>
NEWS_API_KEY=<key>
OPENAI_API_KEY=<key>
```

**Run the migration:**
Apply `supabase/migrations/001_defensible_signals.sql` via Supabase SQL editor.

**Start locally:**
```bash
npm run dev
```

**Test the data pipeline:**
```bash
# Invoke ingest-signals via Supabase Dashboard → Edge Functions → ingest-signals → Invoke
# Or via curl with service role key:
curl -X POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/ingest-signals \
  -H "Authorization: Bearer <service_role_key>"
```

---

## Contact

**Data licensing / API access:** data@fractionl.ai  
**Product:** [fractionl.ai](https://fractionl.ai)