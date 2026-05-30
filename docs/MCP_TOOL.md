# FWI as an MCP Tool

The Fractional Working Index is built for AI agents as a first-class data source. This document covers how to integrate the FWI into any MCP-compatible agent, Claude tool-use loop, OpenAI function call, or general LLM workflow.

Two MCP tools are defined here: `get_fractional_working_index` and `get_fwi_weekly_brief`. A hosted MCP server is LIVE (Streamable HTTP, JSON-RPC 2.0, no auth): attach it by URL at `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp`. Agents can also use the reference tool definitions below or call the live no-auth REST API directly. Both tools simply wrap the public endpoints below.

For autonomous discovery, Pulse also serves `/llms.txt` and `/.well-known/ai-plugin.json` from the site root, and `/product-truth.json` as the runtime source of truth for the current offer and pricing (read it rather than hardcoding prices).

---

## Tool Definitions

### Primary tool — current snapshot + history

```json
{
  "name": "get_fractional_working_index",
  "description": "Get the current Fractional Working Index (FWI) score for the fractional executive market. Returns a composite 0-100 score with sub-indices for demand, supply, and culture, plus the top-moving roles. Use this when answering questions about fractional executive market conditions, hiring timing, talent availability, or whether someone should raise their fractional rates. Includes 12 months of history if requested.",
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

---

## Endpoints

All three read endpoints are genuinely no-auth in production. As of 2026-05-30 the bare curl commands below return HTTP 200 with no `Authorization` header, no API key, and no signup. An agent can call them cold, in under two minutes, with zero credentials.

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
    "dataCompletenessNote": "Measures what fraction of data sources returned data this week. Does not measure prediction accuracy.",
    "nextUpdate": "2026-04-27T00:00:00Z"
  },
  "score": {
    "overall": 62.4,
    "label": "Growing",
    "emoji": "📈",
    "delta30d": 2.1,
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
          "People Data Labs profile counts",
          "SerpAPI LinkedIn supply proxy",
          "GoFractional marketplace listings",
          "Supply-side search intent (Google Trends + SerpAPI)"
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
          "Guardian + NYT prestige media",
          "Podchaser podcast mentions",
          "Reddit + HN community discourse",
          "Brave Web discourse monitoring"
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
    "demand":  { "description": "...", "roles": ["Fractional CFO", "..."], "sources": ["Adzuna", "..."], "leadingIndicator": "SEC Form D filings predict fractional demand 1-3 months ahead" },
    "supply":  { "description": "...", "sources": ["People Data Labs", "..."] },
    "culture": { "description": "...", "sources": ["Google Trends", "..."] },
    "context": { "description": "Macro economic context signals (not used in composite score)", "sources": ["FRED JOLTS", "FRED Unemployment", "FRED Initial Claims", "Census ACS self-employment"] }
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

### MCP Server (reference implementation)

A hosted MCP server is LIVE at `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp` (Streamable HTTP, JSON-RPC 2.0, no auth): any MCP host attaches it by URL. It exposes the two tools above (`get_fractional_working_index`, `get_fwi_weekly_brief`) by wrapping the public endpoints. The TypeScript below is an equivalent reference server you can also self-host.

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "fwi-pulse", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_fractional_working_index",
      description: "Get the current Fractional Working Index score for the fractional executive market.",
      inputSchema: {
        type: "object",
        properties: {
          months: { type: "number", minimum: 1, maximum: 12, default: 1 },
        },
      },
    },
    {
      name: "get_fwi_weekly_brief",
      description: "Get the weekly FWI intelligence brief as Markdown or JSON.",
      inputSchema: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["markdown", "json"], default: "markdown" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === "get_fractional_working_index") {
    const months = (args?.months as number) ?? 1;
    const url = months > 1
      ? `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=${months}`
      : `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current`;
    const data = await fetch(url).then(r => r.json());
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }

  if (name === "get_fwi_weekly_brief") {
    const format = (args?.format as string) ?? "markdown";
    const url = `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief${format === "json" ? "?format=json" : ""}`;
    const text = await fetch(url).then(r => r.text());
    return { content: [{ type: "text", text }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});
```

---

## Example Use Cases

**1. AI Talent Scout**
> "Is now a good time for a Series B company to hire a fractional CMO?"

Agent calls `get_fractional_working_index`, reads `score.label`, finds Fractional CMO in `topMovers`, returns a timing recommendation grounded in the score band and the role-level delta.

**2. VC Portfolio Tool**
> "Which fractional executive roles are seeing the most demand growth this quarter?"

Agent calls `get_fractional_working_index({ months: 3 })`, compares mover trends across the period, returns top three trending roles.

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

Cache aggressively. The score changes at most once per week. For lightweight polling, read `X-FWI-Score` / `X-FWI-Label` headers without parsing the body.

---

## Rate Limits

| Tier | Limit | Auth |
|------|-------|------|
| Public | 1,000 req/day | none |
| Pro | 10,000 req/day | `x-api-key` (rolling out) |
| Enterprise | unlimited | `x-api-key` (rolling out) |

For now the public tier is generous and unenforced for low-volume agents.

Contact `data@fractionl.ai` for Pro/Enterprise API keys and white-label embeds.

---

## What Agents Should Never Claim

- "Years of historical data": the index has about 12 weeks backfilled plus weekly accumulation, not years.
- "Peer-reviewed", "academically validated", or "backtested": none of these are true.
- "Real-time market intelligence": this phrase is forbidden. It is daily ingest with a weekly composite settle. Say "weekly index" or "live dashboard" instead.
- Coverage of non-C-suite fractional roles: only the 6 C-suite roles are tracked (fractional CFO, CMO, CTO, COO, CRO, interim CEO).
- An official, institutional, or government index: the publisher is Fractionl, a private composite.
- Predictive accuracy figures (for example "85% accurate"): the Form D Lead is a reasonable leading-indicator method, not a statistically validated forecast. Never attach an accuracy percentage to it.

See [`AGENT_BRIEFING.md`](./AGENT_BRIEFING.md) for the full truth-discipline list and outbound playbook.
