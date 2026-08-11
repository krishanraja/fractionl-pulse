# FWI as an MCP Tool

The Fractional Working Index is built for AI agents as a first-class data source. This document covers how to integrate the FWI into any MCP-compatible agent, Claude tool-use loop, OpenAI function call, or general LLM workflow.

Four MCP tools are live: `get_fractional_working_index`, `get_fwi_weekly_brief`, `get_content_radar`, and `get_content_brief`. The hosted server uses stateless Streamable HTTP and JSON-RPC 2.0 with no authentication. Attach it at `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp`. Agents can also call the public REST endpoints directly.

For autonomous discovery, Pulse also serves `/llms.txt` and `/.well-known/ai-plugin.json` from the site root, and `/product-truth.json` as the runtime source of truth for the current offer and pricing (read it rather than hardcoding prices).

---

## Tool Definitions

### Primary tool — current snapshot + history

```json
{
  "name": "get_fractional_working_index",
  "description": "Get the current Fractional Working Index (FWI) score for the fractional executive market. Returns a composite 0-100 score with sub-indices for demand, supply, and culture, plus role comparisons and evidence limits. Use it as market context, not as personal rate advice or a local-market forecast. Includes up to 12 months of mixed-frequency history if requested.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "months": {
        "type": "number",
        "description": "Number of months of historical data to include (1-12). Default: 1 (current only).",
        "minimum": 1,
        "maximum": 12,
        "default": 1
      }
    },
    "required": []
  }
}
```

### Secondary tool — weekly Markdown brief

```json
{
  "name": "get_fwi_weekly_brief",
  "description": "Get the weekly Fractional Working Index intelligence brief as ready-to-cite Markdown. Includes the headline score, component breakdown, top movers, AI insights, and citation block. Use this when generating a newsletter, blog post, or research summary about the fractional executive market.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "format": {
        "type": "string",
        "enum": ["markdown", "json"],
        "default": "markdown",
        "description": "Output format. Use 'markdown' for press/newsletter output, 'json' for structured agent consumption."
      }
    },
    "required": []
  }
}
```

### Content Radar tools

`get_content_radar` returns the latest structured topic and question radar. `get_content_brief` returns the current content brief as Markdown or JSON. These surfaces report observed content-signal movement; they do not represent search volume, market demand, or a promise that a topic will perform.

---

## Endpoints

All read endpoints are no-auth in production. The bare curl commands below return data without an `Authorization` header, API key, or signup.

```bash
# Current score (no auth required, returns 200 with no Authorization header)
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current

# Historical data (no auth required)
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3"

# Markdown weekly brief (no auth required)
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief

# JSON brief (no auth required)
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief?format=json"
```

The only authenticated endpoint is `POST /fwi-api/trigger`, which forces an immediate ingest run and requires a Supabase service-role bearer token. It is not public and is not needed for any read or agent workflow.

---

## Example Response (`/fwi-api/current`)

```json
{
  "meta": {
    "index": "Fractional Working Index (FWI)",
    "description": "Composite score measuring the health and momentum of the fractional executive market across demand, supply, and culture signals.",
    "publisher": "Fractionl",
    "version": "1.0",
    "asOf": "2026-04-21",
    "methodology": "FWI = (Demand × 0.5) + (Supply × 0.2) + (Culture × 0.3)",
    "scale": "0-100: <30 Contracting · 30-44 Cooling · 45-59 Stable · 60-74 Growing · 75+ Surging",
    "dataSource": "live",
    "dataCompleteness": 0.92,
    "dataCompletenessNote": "Weighted tracked-input coverage for this reading. Inputs are not all statistically independent, and the value does not measure prediction accuracy.",
    "nextUpdate": "2026-04-27T00:00:00Z"
  },
  "score": {
    "overall": 62.4,
    "label": "Growing",
    "emoji": "📈",
    "delta30d": 2.1,
    "delta30dComparedWith": "2026-03-22",
    "components": {
      "demand": {
        "score": 71.0,
        "weight": 0.5,
        "sources": [
          "Adzuna fractional job postings",
          "SerpAPI Google Jobs cross-check",
          "SEC Form D VC filings (90-day)"
        ]
      },
      "supply": {
        "score": 54.2,
        "weight": 0.2,
        "sources": [
          "SerpAPI LinkedIn supply proxy",
          "Brave LinkedIn talent proxy",
          "GoFractional marketplace listings",
          "Supply-side search intent (SerpAPI)"
        ],
        "status": "live",
        "note": null
      },
      "culture": {
        "score": 56.8,
        "weight": 0.3,
        "sources": [
          "Google Trends search interest",
          "NewsAPI + Mediastack + Brave News media coverage",
          "Guardian prestige media",
          "Podchaser podcast mentions",
          "Reddit + HN community discourse",
          "Brave Web discourse monitoring",
          "Wikipedia article interest"
        ]
      }
    }
  },
  "topMovers": [
    { "role": "Fractional CFO", "signalType": "demand", "changePct": 42, "insight": "121 jobs - above market average" },
    { "role": "Fractional CTO", "signalType": "demand", "changePct": 11, "insight": "19 jobs - above market average" },
    { "role": "VC Funding Pipeline", "signalType": "demand", "changePct": 18, "insight": "1,043 tech filings (90d) - strong funding" },
    { "role": "Search Interest", "signalType": "momentum", "changePct": 14, "insight": "Search interest trending up vs 48 last week" }
  ],
  "signals": {
    "demand":  { "description": "...", "roles": ["Fractional CFO", "..."], "sources": ["Adzuna", "..."], "leadingIndicator": "SEC Form D filings provide financing context; the relationship to future demand is not validated" },
    "supply":  { "description": "...", "sources": ["SerpAPI LinkedIn proxy", "Brave Talent", "..."] },
    "culture": { "description": "...", "sources": ["Google Trends", "..."] },
    "context": { "description": "Macro and research context signals (not used in composite score)", "sources": ["BLS", "FRED", "Census ACS", "OpenAlex"] }
  }
}
```

---

## Agent Implementation

### Claude Tool Use

```python
import anthropic
import httpx

client = anthropic.Anthropic()

tools = [{
    "name": "get_fractional_working_index",
    "description": "Get current FWI score and fractional executive market signals. Use this when answering questions about fractional executive hiring conditions, timing, or rates.",
    "input_schema": {
        "type": "object",
        "properties": {
            "months": {"type": "number", "description": "Months of history (1-12)"}
        }
    }
}]

def execute_fwi_tool(input: dict) -> dict:
    months = input.get("months", 1)
    if months > 1:
        url = f"https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months={months}"
    else:
        url = "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current"
    return httpx.get(url).json()

response = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=1024,
    tools=tools,
    messages=[{
        "role": "user",
        "content": "Is now a good time to raise my fractional CMO rates?"
    }],
)
```

### OpenAI Function Calling

```json
{
  "type": "function",
  "function": {
    "name": "get_fractional_working_index",
    "description": "Returns the current Fractional Working Index score and fractional executive market signals.",
    "parameters": {
      "type": "object",
      "properties": {
        "months": {
          "type": "number",
          "description": "Months of historical data to return (1-12)"
        }
      }
    }
  }
}
```

### Hosted server protocol

The server supports the current stateless MCP protocol (`2026-07-28`) and the legacy `2024-11-05` initialize flow for older hosts. Current Streamable HTTP requests send `MCP-Protocol-Version`, `Mcp-Method`, and, for a named tool call, `Mcp-Name`. The server rejects unsupported versions and header/body mismatches. Tool execution failures return `isError: true` inside the JSON-RPC result.

---

## Example Use Cases

**1. AI Talent Scout**
> "Is now a good time for a Series B company to hire a fractional CMO?"

Agent calls `get_fractional_working_index`, reads the US-primary score and current Fractional CMO comparison, then returns measured market context and the evidence boundary. It does not turn that context into personal rate advice.

**2. VC Portfolio Tool**
> "Which fractional executive roles are strongest relative to the current role average?"

Agent calls `get_fractional_working_index()`, labels role movers as cross-sectional comparisons, and returns the strongest current roles. The history endpoint does not include historical role movers.

**3. Staffing Platform Widget**
Embed an FWI score badge on every product page. Refresh server-side every hour using `Cache-Control: max-age=3600`. Display `X-FWI-Label` as the band.

**4. Weekly AI Market Brief**
Newsletter agent calls `get_fwi_weekly_brief` every Monday morning, prepends an editorial intro, and ships. Citation block is already included.

**5. Sales Outbound Personalization**
Outbound agent calls `get_fractional_working_index`, branches the email opener on the score band ("with the FWI sitting at 64 — Growing — for the third week running…"), and references `topMovers[0].role` to make the message land.

**6. Agent Self-Briefing on Conversation Start**
Customer-facing chat agent calls `get_fractional_working_index` on every new session and stores the snapshot in working memory. All subsequent answers reference today's actual market state.

---

## Caching Guidance

The composite settles weekly even though ingestion runs daily. Response headers:

```
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
X-FWI-Score: 62.4
X-FWI-Label: Growing
```

Cache aggressively. Inputs refresh daily and the product interprets the composite on a weekly cadence. For lightweight polling, read `X-FWI-Score` / `X-FWI-Label` headers without parsing the body.

---

## Rate Limits

| Tier | Limit | Auth |
|------|-------|------|
| Anonymous public read | unmetered (generous, cache-friendly) | none |
| Free key | 1,000 req/day | `x-api-key` (self-serve at `/pricing`) |
| Legacy `pro` schema label | 10,000 req/day | Technical compatibility only; not a current commercial offer |
| Legacy `enterprise` schema label | unlimited | Technical compatibility only; not a current commercial offer |

The anonymous public read, including the hosted MCP server, stays free. Rate accounting applies only to REST calls that send an `x-api-key`: keyed responses carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`, over-limit returns HTTP 429, and an unknown or revoked key returns HTTP 401.

A signed-in user self-serves a free API key (1,000 requests/day) at `pulse.fractionl.ai/pricing`. The key is an operational control, not a paid generic-data tier. Qualified fractional-talent firms can contact `data@fractionl.ai` about the Founding Benchmark Partner validation offer.

---

## What Agents Should Never Claim

- "Years of historical data": the index has 12+ months of history (from August 2025; full three-pillar composite from April 2026), not years.
- "Peer-reviewed", "academically validated", or "backtested": none of these are true.
- "Real-time market intelligence": this phrase is forbidden. It is daily ingest with a weekly composite settle. Say "weekly index" or "live dashboard" instead.
- Coverage of non-C-suite fractional roles: only the 6 C-suite roles are tracked (fractional CFO, CMO, CTO, COO, CRO, interim CEO).
- An official, institutional, or government index: the publisher is Fractionl, a private composite.
- Any claim that Form D filings predict fractional hiring. Pulse tracks them as financing context, and the relationship to future demand has not been validated.

See [`AGENT_BRIEFING.md`](./AGENT_BRIEFING.md) for the full truth-discipline list and outbound playbook.
