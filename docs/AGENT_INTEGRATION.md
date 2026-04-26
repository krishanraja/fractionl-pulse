# Agent Integration Guide

The Fractional Working Index (FWI) is designed for AI agents as first-class consumers, not as an afterthought. This guide is everything an LLM agent, MCP host, or developer integration needs.

---

## What the FWI Measures

A weekly composite 0–100 score across three dimensions blended from **21 independent data sources**:

| Dimension | Weight | What it captures |
|-----------|--------|------------------|
| **Demand** | 50% | Adzuna fractional job postings (6 roles) + SerpAPI Google Jobs cross-check + SEC Form D VC filings (1–3 month leading indicator) |
| **Supply** | 20% | People Data Labs profile counts + SerpAPI LinkedIn proxy + GoFractional marketplace + supply-intent search trends |
| **Culture** | 30% | Google Trends (SerpAPI primary, Apify fallback) + NewsAPI + Mediastack + Brave News + Brave Web + Guardian + NYT + Podchaser + Reddit + Hacker News |

If a pillar has no live data in a given week, its weight redistributes proportionally and the response surfaces this in `meta.dataCompleteness` and `components.<pillar>.status`.

### Scale

| Score | Label | Meaning |
|-------|-------|---------|
| 75–100 | **Surging** 🚀 | Exceptional demand. Pricing power. |
| 60–74 | **Growing** 📈 | Strong market. Opportunities abundant. |
| 45–59 | **Stable** ➡️ | Balanced, normal hiring cadence. |
| 30–44 | **Cooling** 📉 | Softening demand. |
| 0–29 | **Contracting** ⚠️ | Market under pressure. |

---

## Public Endpoints (no authentication)

Base URL: `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1`

### `GET /fwi-api/current`

Returns the latest weekly score with all components and top movers.

```bash
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
```

### `GET /fwi-api/history?months=N`

Returns weekly data points for `N` months (1–12).

```bash
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=6"
```

### `GET /export-brief`

Returns the **weekly market intelligence brief** as Markdown — ideal for press, newsletters, or LLM context windows.

```bash
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief?format=json"
```

---

## Authenticated Endpoints

### `POST /fwi-api/trigger` (service role only)

Triggers an immediate ingest run outside the scheduled cadence.

```bash
curl -X POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/trigger \
  -H "Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY"
```

Service role required. Reserved for ops + on-demand "trigger fresh data" workflows.

### Tiered API keys (rolling out per customer)

The `api_keys` table is provisioned for tiered access (free / pro / enterprise). Tiered key auth is being rolled out per customer — contact `data@fractionl.ai` for an enterprise key.

---

## Rate Limits

| Tier | Daily limit | Auth |
|------|-------------|------|
| Public | 1,000 req/day | none |
| Pro | 10,000 req/day | `x-api-key` header (rolling out) |
| Enterprise | unlimited | `x-api-key` header (rolling out) |

For now the public tier is generous and unenforced for low-volume agents. Cache aggressively.

---

## Response Schema

### `/fwi-api/current` — full TypeScript shape

```typescript
interface FWICurrentResponse {
  meta: {
    index: 'Fractional Working Index (FWI)';
    description: string;
    publisher: 'Fractionl';
    version: '1.0';
    asOf: string;                         // 'YYYY-MM-DD' of latest reading
    methodology: string;                  // formula with current weights
    scale: string;                        // label band reference
    dataSource: 'live' | 'partial';       // 'live' if confidence >= 0.75
    dataCompleteness: number;             // 0-1, weighted source completeness
    dataCompletenessNote: string;         // disclaimer that this is NOT prediction accuracy
    nextUpdate: string;                   // ISO timestamp of next scheduled run
  };
  score: {
    overall: number;                      // 0-100
    label: 'Surging' | 'Growing' | 'Stable' | 'Cooling' | 'Contracting';
    emoji: string;
    delta30d: number;                     // change vs ~30 days ago
    components: {
      demand: {
        score: number;
        weight: number;                   // 0.5 normally, redistributed if pillar is empty
        sources: string[];
      };
      supply: {
        score: number;
        weight: number;                   // 0.2 normally; 0 if redistributed
        sources: string[];                // empty array if status='excluded'
        status: 'live' | 'excluded';
        note: string | null;              // explanation when excluded
      };
      culture: {
        score: number;
        weight: number;                   // 0.3 normally
        sources: string[];
      };
    };
  };
  topMovers: Array<{
    role: string;                         // e.g. 'Fractional CFO', 'VC Funding Pipeline'
    signalType: 'demand' | 'supply' | 'momentum';
    changePct: number;                    // vs role market avg (Adzuna) or prior-week (others)
    insight: string;                      // humanized note
  }>;
  signals: {
    demand:  { description: string; roles: string[]; sources: string[]; leadingIndicator: string };
    supply:  { description: string; sources: string[] };
    culture: { description: string; sources: string[] };
    context: { description: string; sources: string[] };  // FRED + Census, stored not scored
  };
}
```

### `/fwi-api/history` shape

```typescript
interface FWIHistoryResponse {
  meta: {
    index: 'Fractional Working Index (FWI)';
    period: string;                       // e.g. '3 months'
    from: string;                         // 'YYYY-MM-DD'
    to: string;                           // 'YYYY-MM-DD'
    dataPoints: number;
  };
  history: Array<{
    date: string;
    overall: number;
    demand: number;
    supply: number;
    culture: number;                      // exposed as 'culture' on output (column is 'momentum_score')
    label: string;
    confidence: number;                   // 0-1, data completeness for that week
  }>;
}
```

### Response headers (every `/current` response)

```
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
X-FWI-Score: 62.4
X-FWI-Label: Growing
```

Use `X-FWI-Score` and `X-FWI-Label` for lightweight polling without parsing the body.

---

## Data Sources (defensible methodology)

### Demand pillar

| Source | What it measures | Why it's defensible |
|--------|------------------|---------------------|
| **Adzuna** | 6 fractional C-suite roles, exact phrase matching | Filters out general exec search. Genuine fractional listings. |
| **SerpAPI Google Jobs** | Same 6 roles via Google Jobs aggregator | Independent cross-check on Adzuna |
| **SEC EDGAR Form D** | VC funding filings, tech/SaaS, 90-day rolling | Government data, free API. Form D is filed within 15 days of a raise. Companies enter the fractional buyer pool 1–3 months later. **No other index uses this.** |

### Supply pillar

| Source | What it measures |
|--------|------------------|
| **People Data Labs** | Profile counts containing fractional/interim title terms, by role |
| **SerpAPI LinkedIn** | `site:linkedin.com/in "fractional CFO"` result counts as a public profile-volume proxy |
| **GoFractional marketplace** | Active listings via Apify scraper |
| **Apify Google Trends (supply intent)** | Searches like "become fractional executive", "fractional consulting business" |
| **SerpAPI Trends (supply intent)** | Independent cross-check on supply intent |

### Culture pillar

| Source | What it measures |
|--------|------------------|
| **SerpAPI Google Trends** | Search interest, 90-day, US geo |
| **Apify Google Trends** | Backup search interest provider |
| **NewsAPI** | 28-day article volume, exact phrase matching |
| **Mediastack** | Independent news API cross-check |
| **Brave News** | Third news source for triangulation |
| **Brave Web Search** | Total web mentions across sites |
| **The Guardian** | Elite UK media coverage, 90-day window |
| **NY Times** | Elite US media coverage, 90-day window |
| **Podchaser** | Podcast episodes mentioning fractional terms |
| **Reddit** | Posts + engagement in relevant subreddits |
| **Hacker News** | Stories + points via Algolia HN Search |

### Context (stored, not in composite)

| Source | What it captures |
|--------|------------------|
| **FRED** | JOLTS Job Openings · Unemployment Rate · Initial Jobless Claims |
| **Census ACS** | US self-employment household percentage |

Macro context signals enrich narrative without contaminating the index.

---

## The Leading Indicator Signal

The SEC Form D integration is the most novel piece of methodology. How it works:

1. Companies must file Form D with the SEC within **15 days of closing a funding round**.
2. We query Form D filings for tech / software / SaaS issuers across a 90-day rolling window.
3. High filing volume in a period predicts **fractional executive hiring volume 1–3 months later**. Companies raise → stabilize → bring in fractional leadership to execute before committing to full-time hires.
4. This lag means the FWI demand component has a **predictive** element, not just a lagging measure.

No competing fractional market index uses funding velocity as a demand predictor. It is the methodology differentiator.

---

## Caching Strategy

The pipeline runs daily but the FWI composite settles weekly. Build integrations accordingly:

- **Widgets / embeds:** serve from your own cache, refresh every 24h
- **AI agent context:** cache in session memory for 24h, re-fetch on Monday
- **API responses:** `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` on `/current`
- **Lightweight polling:** read `X-FWI-Score` / `X-FWI-Label` headers without parsing body
- **Webhook alternative (planned):** subscribe via webhook when threshold alerts ship

---

## Webhook Alerts (roadmap)

Webhook threshold alerts are on the roadmap. Targeted shape:

```bash
curl -X POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/webhooks \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["score_above_75", "score_below_30", "weekly_update", "role_mover"],
    "roles": ["Fractional CMO", "Fractional CFO"]
  }'
```

Trigger payload:

```json
{
  "event": "score_above_75",
  "fwi": 76.2,
  "label": "Surging",
  "delta": 4.1,
  "timestamp": "2026-04-07T00:00:00Z"
}
```

Until webhooks ship, poll `/current` daily and diff against your last cached score.

---

## MCP Tool Definition

See [`MCP_TOOL.md`](./MCP_TOOL.md) for the full tool definition, Claude/OpenAI implementation examples, and example agent workflows.

---

## Example Agent Use Cases

**1. AI Talent Scout**
> "Is now a good time for a Series B company to hire a fractional CMO?"

→ Query `/fwi-api/current`, read demand score + CMO mover position + culture trend, return timing recommendation.

**2. VC Portfolio Analyst**
> "Which fractional executive roles are seeing the most demand growth this quarter?"

→ Query `/fwi-api/history?months=3`, compare mover trends across periods, surface the top three trending roles.

**3. Staffing Platform Widget**
> Embed an FWI score badge on every page, refreshed server-side.

→ Cache `/fwi-api/current` server-side with `Cache-Control: max-age=3600`. Rebuild on cache miss.

**4. Weekly Market Brief Newsletter**
> Automated newsletter writer.

→ Pull `/export-brief` every Monday, paste Markdown into the newsletter template, ship.

**5. Sales Outbound Agent**
> Agent that writes personalized outbound based on weekly market state.

→ Pull `/current`, branch the email opener on `score.label`, reference `topMovers[0].role` for relevance.

---

## Operational Notes

- The pipeline runs daily at **06:00 UTC** via Vercel Cron with a redundant Monday backstop run.
- On failure, `send-pipeline-alert` triggers a Resend email — pipeline reliability is monitored, not hoped for.
- The dashboard uses **Supabase Realtime** subscriptions on `fwi_scores`, `signals`, `cached_insights`, and `data_source_health` — your dashboard updates within seconds of a successful pipeline run, not on the next user refresh.
- Per-source health is exposed via the public-readable `data_source_health` table for any agent that wants to audit which sources reported in a given week.

---

## Contact

- **Data licensing / API keys / press:** data@fractionl.ai
- **Live dashboard:** https://pulse.fractionl.ai
