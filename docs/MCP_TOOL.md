# FWI as an MCP Tool

The Fractional Working Index is designed to be consumed by AI agents as a first-class data source. This document describes how to integrate the FWI into any MCP-compatible agent or AI workflow.

---

## Tool Definition

```json
{
  "name": "get_fractional_working_index",
  "description": "Get the current Fractional Working Index (FWI) score and market signals for the fractional executive market. Returns a composite 0-100 score with sub-indices for demand, supply, and culture, plus the top-moving roles. Use this when answering questions about fractional executive market conditions, hiring timing, or talent availability.",
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

---

## Endpoints

### Current Score (no auth)

```bash
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
```

### Historical Data (no auth)

```bash
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3"
```

---

## Example Response

```json
{
  "meta": {
    "index": "Fractional Working Index (FWI)",
    "description": "Composite score measuring the health and momentum of the fractional executive market.",
    "asOf": "2026-03-21",
    "methodology": "FWI = (Demand × 0.5) + (Supply × 0.2) + (Culture × 0.3)",
    "scale": "0-100: <30 Contracting · 30-44 Cooling · 45-59 Stable · 60-74 Growing · 75+ Surging",
    "dataSource": "live",
    "confidence": 1.0,
    "nextUpdate": "2026-03-28T00:00:00Z"
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
        "sources": ["Adzuna fractional job postings", "SEC Form D VC filings (90-day)"]
      },
      "supply": {
        "score": 50.0,
        "weight": 0.2,
        "sources": ["Baseline placeholder. Contra marketplace integration Q2 2026."]
      },
      "culture": {
        "score": 54.0,
        "weight": 0.3,
        "sources": ["Google Trends search interest", "NewsAPI media coverage (28-day)"]
      }
    }
  },
  "topMovers": [
    { "role": "Fractional CFO", "signalType": "demand", "changePct": 42, "insight": "121 jobs, well above market average" },
    { "role": "Fractional CTO", "signalType": "demand", "changePct": 11, "insight": "19 jobs, above market average" },
    { "role": "Fractional CMO", "signalType": "demand", "changePct": -3, "insight": "13 jobs, below market average" }
  ]
}
```

---

## Agent Implementation (Claude / OpenAI function calling)

### Claude Tool Use

```python
tools = [{
    "name": "get_fractional_working_index",
    "description": "Get current FWI score and fractional executive market signals",
    "input_schema": {
        "type": "object",
        "properties": {
            "months": {"type": "number", "description": "Months of history (1-12)"}
        }
    }
}]

# Tool execution handler
def execute_fwi_tool(input: dict) -> dict:
    import httpx
    months = input.get("months", 1)
    if months > 1:
        url = f"https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months={months}"
    else:
        url = "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current"
    return httpx.get(url).json()
```

### OpenAI Function Calling

```json
{
  "type": "function",
  "function": {
    "name": "get_fractional_working_index",
    "description": "Returns the current Fractional Working Index score and market signals",
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

---

## Example Use Cases

**1. AI Talent Scout**
> "Is now a good time for a Series B company to hire a fractional CMO?"

Agent queries `/fwi-api/current`, reads demand score + CMO mover position, returns timing recommendation.

**2. VC Portfolio Tool**
> "Which fractional executive roles are seeing the most demand growth this quarter?"

Agent queries `/fwi-api/history?months=3`, compares mover trends across periods.

**3. Staffing Platform Widget**
> Embedded FWI score badge updated weekly via `/fwi-api/current`, refreshed server-side with `Cache-Control: max-age=3600`.

**4. Weekly AI Market Brief**
> Automated newsletter agent calls `/fwi-api/current` every Monday, writes a paragraph on fractional market conditions, appends to a broader talent market summary.

---

## Rate Limits

| Tier | Limit | Auth |
|------|-------|------|
| Public | 1,000 req/day | None |
| Pro | 10,000 req/day | `x-api-key` header |
| Enterprise | Unlimited | `x-api-key` header |

Contact `data@fractionl.ai` for Pro/Enterprise API keys.

---

## Caching Guidance

The FWI updates weekly. Response headers include:
```
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
X-FWI-Score: 62.4
X-FWI-Label: Growing
```

Cache aggressively. The score changes at most once per week.