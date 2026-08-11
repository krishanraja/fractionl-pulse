# Agent Integration Guide

The Fractional Working Index (FWI) is designed for AI agents as first-class consumers, not as an afterthought. This guide is everything an LLM agent, MCP host, or developer integration needs.

### Machine-readable discovery surfaces

For autonomous discovery, three files are served from the site root:

- `/llms.txt`: a plain-text map of what Pulse is and where the live data lives, written for LLMs.
- `/.well-known/ai-plugin.json`: the plugin manifest for agent platforms that auto-discover tools.
- `/product-truth.json`: the runtime source of truth for the current offer and pricing. Read this rather than hardcoding prices. The public instrument, REST API, and MCP tools are free. The paid-product hypothesis is a privacy-safe cross-partner engagement benchmark for qualified fractional-talent firms.

---

## What the FWI Measures

A 0–100 composite across three dimensions built from **21 tracked inputs**. Inputs are not all statistically independent and availability varies by reading:

| Dimension | Weight | What it captures |
|-----------|--------|------------------|
| **Demand** | 50% | Adzuna fractional job postings (6 roles) + DataForSEO Google Jobs cross-check + SEC Form D financing context |
| **Supply** | 20% | DataForSEO LinkedIn proxy + Brave Talent backstop + GoFractional published operator count + DataForSEO supply-intent trends |
| **Culture** | 30% | DataForSEO Trends + NewsAPI + Mediastack + Brave News + Brave Web + Guardian + Podchaser + Reddit + Hacker News + Wikipedia pageviews |

If a pillar has no live data in a given week, its weight redistributes proportionally and the response surfaces this in `meta.dataCompleteness` and `components.<pillar>.status`.

### Scale

| Score | Label | Meaning |
|-------|-------|---------|
| 75–100 | **Surging** 🚀 | Exceptionally strong measured conditions. |
| 60–74 | **Growing** 📈 | Strong measured conditions. |
| 45–59 | **Stable** ➡️ | Balanced, normal hiring cadence. |
| 30–44 | **Cooling** 📉 | Softening demand. |
| 0–29 | **Contracting** ⚠️ | Market under pressure. |

---

## Public Endpoints (no authentication required)

Base URL: `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1`

These endpoints are genuinely no-auth in production. As of 2026-05-30 the exact bare curl below returns HTTP 200 with no `Authorization` header. There is no key to obtain, no header to send, nothing to sign up for. Copy a command, run it, get JSON or Markdown back.

### `GET /fwi-api/current`

Returns the latest weekly score with all components and top movers.

```bash
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
```

### `GET /fwi-api/history?months=N`

Returns observed score rows for `N` months (1–12). Historical rows are mixed-frequency and should not be described as an uninterrupted weekly series.

```bash
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=6"
```

### `GET /export-brief`

Returns the **weekly market brief** as Markdown, ideal for press, newsletters, or LLM context windows.

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

This is the one endpoint that still requires authentication: a Supabase service-role bearer token. The three read endpoints above (`/current`, `/history`, `/export-brief`) are public no-auth; `/fwi-api/trigger` is not and never will be. It is reserved for ops and on-demand "trigger fresh data" workflows.

### Optional operational API key (`x-api-key`, live now)

The read endpoints above are free and no-auth. A signed-in user can self-serve a **free API key** at [`pulse.fractionl.ai/pricing`](https://pulse.fractionl.ai/pricing) for operational rate controls. Send it as the `x-api-key` header on any read request:

```bash
curl -H "x-api-key: pk_live_..." \
  https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
```

The keyed limit is currently 1,000 requests/day. Keyed responses carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`; exceeding the daily limit returns HTTP 429, and an unknown or revoked key returns HTTP 401. The plaintext key is shown once at creation, and only its SHA-256 hash is stored. API metering is an operational control, not Pulse's paid product. The commercial hypothesis is documented in [`CORPORATE_STRATEGY.md`](CORPORATE_STRATEGY.md).

---

## Rate Limits

| Tier | Daily limit | Auth |
|------|-------------|------|
| Anonymous public read | unmetered (generous, cache-friendly) | none |
| Free key | 1,000 req/day | `x-api-key` (self-serve at `/pricing`) |
| Legacy `pro` schema label | 10,000 req/day | Technical compatibility only; not a current commercial offer |
| Legacy `enterprise` schema label | unlimited | Technical compatibility only; not a current commercial offer |

The anonymous public read stays free, so cache aggressively. Rate accounting applies only when you send an `x-api-key`, and keyed responses report `X-RateLimit-Limit` and `X-RateLimit-Remaining`. Get a free key at `pulse.fractionl.ai/pricing`. Do not describe a larger quota for the same public score as the paid product.

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
    delta30dComparedWith: string | null;  // date of the observed comparison row
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
    context: { description: string; sources: string[] };  // BLS, FRED, Census, OpenAlex; stored, not scored
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
    dataQuality: {
      supply: 'measured' | 'unmeasured';
      supply_signal_count: number;
      demand_signal_count: number;
      culture_signal_count: number;
    } | null;
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
| **DataForSEO Google Jobs** | Same 6 roles via Google Jobs aggregator | Independent cross-check on Adzuna |
| **SEC EDGAR Form D** | Financing-context filings, tech/SaaS, 90-day rolling | Government data, free API. Pulse treats filing velocity as a possible leading context signal, but the relationship to future fractional hiring has not been validated. |

### Supply pillar

| Source | What it measures |
|--------|------------------|
| **DataForSEO LinkedIn** | `site:linkedin.com/in "fractional CFO"` result counts as a public profile-volume proxy |
| **Brave Talent** | Independent public-web profile-volume backstop |
| **GoFractional published network** | First-party published operator count via the official `apify/web-scraper` actor; stored under the legacy `marketplace` category for compatibility |
| **DataForSEO Trends (supply intent)** | Searches like "become fractional executive" and "fractional consulting business" |

### Culture pillar

| Source | What it measures |
|--------|------------------|
| **DataForSEO Google Trends** | Search interest, 90-day, US geo |
| **NewsAPI** | 28-day article volume, exact phrase matching |
| **Mediastack** | Independent news API cross-check |
| **Brave News** | Third news source for triangulation |
| **Brave Web Search** | Total web mentions across sites |
| **The Guardian** | Elite UK media coverage, 90-day window |
| **Podchaser** | Podcast episodes mentioning fractional terms |
| **Reddit** | Posts + engagement in relevant subreddits |
| **Hacker News** | Stories + points via Algolia HN Search |
| **Wikipedia pageviews** | Seven-day interest across a fixed article set |

### Context (stored, not in composite)

| Source | What it captures |
|--------|------------------|
| **BLS** | JOLTS openings, unemployment, and wage series |
| **FRED** | Initial Jobless Claims only; BLS is primary for JOLTS, unemployment, and wages |
| **Census ACS** | US self-employment household percentage |
| **OpenAlex** | Academic and thought-leadership coverage |

Macro context signals enrich narrative without contaminating the index.

---

## SEC Form D financing context

Pulse tracks SEC Form D filing velocity as startup-financing context alongside observed job-posting demand. Companies generally file Form D shortly after an exempt offering, but Pulse has not validated a causal or predictive relationship between filing velocity and future fractional hiring. How the input is handled:

1. Companies must file Form D with the SEC within **15 days of closing a funding round**.
2. We query Form D filings for tech / software / SaaS issuers across a 90-day rolling window.
3. Filing volume is normalised as one context input alongside observed demand signals.
4. Agents must not turn this input into a hiring forecast or a causal claim.

Pulse uses Form D filing velocity as one financing-context input. Go Fractional already publishes fractional demand and compensation benchmarks, and Pulse must not claim that no competitor exists. The Form D input may be methodologically distinctive, but its relationship to future fractional demand has not been validated.

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

- Supabase `pg_cron` prepares DataForSEO Jobs at **05:00 UTC** and runs ingestion at **06:00 UTC**. Vercel retains retry and Monday backstop triggers.
- On failure, `send-pipeline-alert` triggers a Resend email — pipeline reliability is monitored, not hoped for.
- The dashboard uses **Supabase Realtime** subscriptions on `fwi_scores`, `signals`, `cached_insights`, and `data_source_health` — your dashboard updates within seconds of a successful pipeline run, not on the next user refresh.
- Per-source health is exposed via the public-readable `data_source_health` table for any agent that wants to audit which sources reported in a given week.

---

## Contact

- **Benchmark Partner applications / API keys / press:** data@fractionl.ai
- **Live dashboard:** https://pulse.fractionl.ai
