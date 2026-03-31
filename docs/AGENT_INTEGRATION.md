# Agent Integration Guide

The FWI API is designed to be consumed by AI agents as a primary user, not as an afterthought. This guide covers everything a developer or AI system needs to integrate fractional market intelligence into any workflow.

---

## What the FWI Measures

The **Fractional Working Index** is a weekly composite score (0-100) measuring the health of the fractional executive market across three dimensions:

| Dimension | Weight | What it captures |
|-----------|--------|-----------------|
| **Demand** | 50% | Job posting volume for fractional roles + VC funding pipeline (leading indicator) |
| **Supply** | 20% | Availability of fractional executives on specialist platforms |
| **Culture** | 30% | Search intent + media velocity around fractional work |

**Scale:**
- **75-100**: Surging. Exceptional demand, take rates high.
- **60-74**: Growing. Strong market, opportunities abundant.
- **45-59**: Stable. Balanced, normal activity.
- **30-44**: Cooling. Softening demand.
- **0-29**: Contracting. Market under pressure.

---

## Public Endpoints (no authentication)

### Current FWI Score

```
GET https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
```

Returns the latest weekly score with all components and top movers.

**Example:**
```bash
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
```

### Historical Scores

```
GET https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3
```

Returns weekly data points for the requested period (1-12 months).

**Example:**
```bash
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=6"
```

---

## Authenticated Endpoints (API key required)

Pass your API key in the `x-api-key` header:

```bash
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current \
  -H "x-api-key: YOUR_API_KEY"
```

### Trigger Fresh Collection

```
POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/trigger
Authorization: Bearer SERVICE_ROLE_KEY
```

Triggers an immediate data collection run outside the weekly schedule. Service role only.

---

## Rate Limits

| Tier | Daily limit | Use case |
|------|-------------|----------|
| Public (no key) | 1,000 req/day | Prototypes, widgets, low-volume agents |
| Pro | 10,000 req/day | Production apps, dashboards |
| Enterprise | Unlimited | Data licensing, platform integrations |

Contact `data@fractionl.ai` for API keys.

---

## Response Schema

### `/current` full response

```typescript
interface FWICurrentResponse {
  meta: {
    index: string;           // "Fractional Working Index (FWI)"
    description: string;
    publisher: string;       // "Fractionl"
    version: string;         // "1.0"
    asOf: string;            // "2026-03-21" - date of last collection
    methodology: string;     // weight formula
    scale: string;           // label guide
    dataSource: 'live' | 'partial' | 'baseline';
    confidence: number;      // 0-1, based on sources that succeeded
    nextUpdate: string;      // ISO timestamp of next scheduled run
  };
  score: {
    overall: number;         // 0-100
    label: string;           // "Growing"
    emoji: string;           // "📈"
    delta30d: number;        // change vs previous reading
    components: {
      demand:  { score: number; weight: number; sources: string[] };
      supply:  { score: number; weight: number; sources: string[]; note?: string };
      culture: { score: number; weight: number; sources: string[] };
    };
  };
  topMovers: Array<{
    role: string;            // "Fractional CFO"
    signalType: string;      // "demand"
    changePct: number;       // relative to market average
    insight: string;         // plain language explanation
  }>;
  signals: {
    demand:  { description: string; roles: string[]; leadingIndicator: string };
    supply:  { description: string; status: string };
    culture: { description: string; sources: string[] };
  };
}
```

---

## Data Sources (defensible methodology)

| Source | Signal | Update frequency | Why it's defensible |
|--------|--------|-----------------|-------------------|
| **Adzuna** | Fractional job postings, 6 C-suite roles | Weekly | Exact phrase matching ("fractional CFO"). Genuine fractional listings, not general exec search. |
| **SEC Form D** | VC funding filings, tech companies | Weekly | Government data, free API. Companies that raised Series A/B/C in last 90 days are the primary fractional buyer pool. No other index uses this as a leading indicator. |
| **Google Trends** (Apify) | Search interest for fractional terms | Weekly | 0-100 native scale, 90-day rolling, US-geo. Early signal of hiring intent before postings appear. |
| **NewsAPI** | Media coverage, 28-day | Weekly | Article velocity for exact phrase mentions. Tracks cultural moment/mainstream awareness. |

**Supply data (Q2 2026):** Direct marketplace listings from Contra and Toptal will replace the current neutral baseline. When live, this becomes the most unique signal, measuring actual fractional executive availability on specialist platforms.

---

## The Leading Indicator Signal

The SEC Form D integration is the most novel piece of the methodology. Here is how it works:

1. Companies must file Form D with the SEC within 15 days of closing a funding round.
2. We query filings for tech/software/SaaS companies across a rolling 90-day window.
3. High filing volume in a period predicts fractional executive hiring volume 1-3 months later. Companies raise, stabilise, then hire fractional leadership to execute before committing to full-time.
4. This lag means the FWI demand component has a **predictive** element, not just a lagging measure.

No competing fractional market index uses funding velocity as a demand predictor. It is the methodology differentiator.

---

## Webhook Setup (roadmap)

Webhook alerts are on the Q2 2026 roadmap. When live:

```bash
# Subscribe to threshold alerts
curl -X POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/webhooks \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["score_above_75", "score_below_30", "weekly_update"],
    "roles": ["Fractional CMO", "Fractional CFO"]
  }'
```

Webhook payload on trigger:
```json
{
  "event": "score_above_75",
  "fwi": 76.2,
  "label": "Surging",
  "delta": 4.1,
  "timestamp": "2026-04-07T00:00:00Z"
}
```

---

## Caching Strategy

The FWI updates once per week. Build your integrations accordingly:

- **Widgets/embeds**: Serve from your own cache, refresh every 24h
- **AI agent context**: Cache in session memory for 24h, re-fetch on Monday
- **API responses**: `Cache-Control: public, max-age=3600` is set on all responses
- **Response headers** expose `X-FWI-Score` and `X-FWI-Label` for lightweight checks without parsing body

---

## MCP Tool Definition

See [MCP_TOOL.md](./MCP_TOOL.md) for the complete tool definition, example implementation for Claude and OpenAI, and agent workflow examples.