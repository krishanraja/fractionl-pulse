# Agent Briefing: Pulse by Fractionl

## Quick Pitch

Pulse publishes the Fractional Working Index (FWI) -- the only real-time composite score (0-100) tracking demand, supply, and cultural momentum in the fractional executive market. It combines job postings, SEC Form D filings (a leading indicator no competitor uses), search trends, and media coverage into a single weekly number designed for both human analysts and AI agents.

---

## 1. What Pulse Is

**Product:** The Fractional Working Index (FWI) -- a weekly composite 0-100 score measuring the health of the fractional executive market.

**Formula:** `FWI = (Demand x 0.50) + (Supply x 0.20) + (Culture x 0.30)`

**Three Pillars:**

| Pillar | Weight | Status | What It Measures |
|--------|--------|--------|-----------------|
| Demand | 50% | Live | Job postings + VC funding pipeline |
| Supply | 20% | Neutral baseline (live data Q2 2026) | Fractional exec availability |
| Culture | 30% | Live | Search interest + media coverage |

**Interfaces:**
- Dashboard: `fractionl-pulse.vercel.app`
- Public API: `/fwi-api/current` (no auth required)
- MCP tool definition ships with the repo

**Update cadence:** Weekly

---

## 2. Value Proposition and Differentiation

### Core Value
A single, normalized number that answers: "How healthy is the fractional executive market right now, and where is it heading?"

### Differentiation
- **First mover.** No other product publishes a real-time composite index for the fractional executive market.
- **SEC Form D as leading indicator.** Companies that file Form D (Series A/B/C raises) enter the fractional buyer pool 1-3 months later. No competitor uses this signal.
- **Composite methodology.** Combines demand, supply, and culture signals into one score. Competitors offer fragments (job boards, marketplace listings, or quarterly reports), never a composite.
- **Agent-native design.** Public API, structured JSON schema, MCP tool definition, `X-FWI-Score` shortcut header. Built for AI agents as first-class consumers.
- **Historical moat.** 52 weeks of weekly data creates a dataset no competitor can replicate without spending a year collecting it.

---

## 3. Score Scale

| Range | Label | Meaning |
|-------|-------|---------|
| 75-100 | Surging | Exceptional demand. Fractional executives have pricing power. |
| 60-74 | Growing | Strong market. Opportunities abundant for qualified operators. |
| 45-59 | Stable | Balanced conditions. Normal hiring cadence. |
| 30-44 | Cooling | Softening demand. Selectivity increasing. |
| 0-29 | Contracting | Market under pressure. Supply exceeds demand. |

---

## 4. Data Sources (Live)

| Source | Signal | Normalization | Unique Angle |
|--------|--------|--------------|-------------|
| Adzuna Jobs API | Fractional C-suite job postings (CFO, CMO, CTO, COO, CRO, interim CEO) | Log scale: 200 listings = score 100 | Exact phrase matching filters out non-fractional exec search |
| SEC EDGAR Form D | VC funding filings (Series A/B/C) as leading demand indicator | Linear: 800 filings/90 days = score 50 | 1-3 month predictive lag on fractional hiring demand. No competitor uses this. |
| Google Trends (via Apify) | Search interest for fractional terms, 90-day rolling, US geo | Passthrough (already 0-100) | Precedes job postings by 4-6 weeks |
| NewsAPI | Media coverage volume for fractional executive terms, 28-day window | Sqrt scale: ~44 articles = score 100 | Tracks mainstream awareness velocity |

**Supply (not yet live):** Neutral baseline at 50. Marketplace integrations (Contra, Toptal) planned for Q2 2026. This is disclosed transparently in the methodology.

---

## 5. Pricing Model

Pricing is defined but Stripe integration is not yet live. Payments are not currently accepted.

| Tier | Price | Includes |
|------|-------|---------|
| **Free** | $0 | Overall score, 30-day trend, top 5 movers, weekly email digest, readiness gauge |
| **Pro** | $99/mo ($79/mo annual) | Full sub-index breakdown, 12-month history, all signals, AI insights, custom alerts, methodology deep-dive, PDF exports |
| **Enterprise** | $500-5,000/mo | API access, white-label embed, custom weighting, industry sub-indices, SSO, SLA |

---

## 6. Current Product State

### Live Now
- React dashboard with professional UI
- Four-source signal ingestion (Adzuna, SEC EDGAR, Google Trends, NewsAPI)
- Weekly FWI score calculation and publication
- Public API (no auth, JSON response)
- AI insight cards (GPT-4o-mini generated)
- Waitlist and auth system
- Supply "Coming Soon" UI

### Not Yet Live
- Supply pillar data (Q2 2026)
- Stripe payment integration (Q3 2026)
- Webhook threshold alerts (Q2 2026)
- White-label embed (Q3 2026)
- Only a few weeks of historical data accumulated so far
- Index has not been peer-reviewed or backtested against major market events

---

## 7. Target Personas and Use Cases

| Persona | Income/Budget | Use Case | Why They Pay |
|---------|--------------|----------|-------------|
| Fractional executives | $200K+ individual income | Timing market entry, setting rates, deciding when to take on new clients | A single well-timed rate adjustment or market entry decision pays for years of subscription |
| Small staffing agencies | Revenue $1M-20M | Competitive intel, market timing, client advisory | Data-driven positioning against larger firms |
| Career coaches | Revenue varies | Advising clients considering fractional transition | Credibility tool: data-backed guidance vs. gut feel |
| HR tech platforms | SaaS companies | Embedding market intelligence into their product | White-label API enriches their platform without building from scratch |
| VC/PE firms | AUM $50M+ | Market thesis validation, portfolio company workforce guidance | Leading indicator (Form D signal) validates their own deal flow patterns |
| Enterprise HR | Companies 500+ employees | Workforce planning: hire fractional vs. full-time decisions | Quantified market conditions reduce hiring risk |

---

## 8. How to Talk About the Methodology

### Credible Framing
- The FWI combines four independent data sources into a single composite score. Each source is normalized to a 0-100 scale using a method appropriate to its distribution (log, linear, sqrt, or passthrough).
- The SEC Form D signal is a genuine methodological innovation. Companies that raise venture funding file Form D with the SEC. These companies enter the fractional executive buyer pool 1-3 months after filing. This creates a leading indicator.
- The methodology is fully documented and transparent. Weights, normalization curves, and data sources are published.

### What to Emphasize
- Composite approach (not just one data point)
- Leading indicator capability (Form D predates hiring by 1-3 months)
- Transparency of methodology
- Agent-native API design

### What to Acknowledge Proactively
- Supply data is not live yet (neutral baseline until Q2 2026)
- Historical dataset is still young (weeks, not years)
- The index is new and has not been backtested against past market events

---

## 9. Competitive Landscape

### Direct Competitors
None. No other product publishes a real-time composite index for the fractional executive market.

### Indirect Competitors

| Competitor | What They Offer | Why Pulse Wins |
|-----------|----------------|---------------|
| LinkedIn Economic Graph | Broad labor market data | Not fractional-specific. No composite index. No public API. No demand + culture + supply composite. |
| Staffing Industry Analysts (SIA) | Quarterly staffing reports | Quarterly (not weekly). Expensive. Not specific to fractional C-suite. No API. |
| Upwork/Toptal marketplace data | Supply-side marketplace metrics | Supply only, not indexed. No demand signal. No leading indicators. No composite methodology. |
| Job boards (Indeed, LinkedIn Jobs) | Raw job listing counts | Raw data, not normalized. No composite. No leading indicator. No culture signal. No historical tracking as an index. |

---

## 10. Objection Handling

**"How is this different from just looking at job boards?"**
Job boards give you raw listings. Pulse gives you a composite score that combines job postings with a leading demand indicator (SEC Form D), cultural momentum (search trends + media coverage), and supply-side data -- all normalized to a 0-100 scale with historical tracking. It is the difference between checking the temperature outside vs. reading a weather forecast.

**"The supply data is missing."**
Correct. We are transparent about this. Supply is at a neutral baseline (50) until we launch marketplace integrations with Contra and Toptal in Q2 2026. The demand and culture pillars (80% of the current weight) are fully live with real data.

**"You only have a few weeks of data."**
Every longitudinal data product starts at week one. We accumulate one data point per week that no competitor is collecting. After 52 weeks, that dataset is a defensible asset no one can replicate without spending a year. Early access means the ability to shape the methodology and get in before the historical moat is built.

**"$99/month seems expensive for a single number."**
The target user earns $200K+ annually. A single well-timed decision -- raising rates during a "Surging" period, or delaying market entry during "Cooling" -- pays for years of the subscription. Pro also includes full sub-index breakdowns, 12-month history, AI insights, and custom alerts.

**"Why not just use LinkedIn?"**
LinkedIn does not track fractional work specifically. It does not publish a composite index. It does not have a public API for this data. It does not combine demand, culture, and supply signals. It does not use SEC Form D as a leading indicator.

**"This hasn't been peer-reviewed or backtested."**
True, and we say so openly. The methodology is fully transparent and published. We welcome scrutiny. The index gains validation through accumulation: as we collect data through multiple market cycles, backtesting becomes possible. That is a feature of time, not a flaw of approach.

---

## 11. API Quick Reference (for Agent Integration)

```bash
# Current score (no auth required)
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current

# Historical data
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3"
```

Response includes: overall score, label, 30-day delta, component breakdown (demand/supply/culture with scores and weights), top movers with role-level detail and insights.

Headers include `X-FWI-Score` for lightweight polling.

---

## 12. Key Links

| Resource | URL |
|----------|-----|
| Live Dashboard | https://fractionl-pulse.vercel.app |
| API (current score) | https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current |
| API (history) | https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3 |
| Agent Integration Docs | docs/AGENT_INTEGRATION.md |
| MCP Tool Definition | docs/MCP_TOOL.md |
| Methodology (in API response) | Included in `meta` field of every API response |
| Contact (data licensing) | data@fractionl.ai |

---

## Do Not Say

Agents must never make the following claims:

- **Do not claim the supply pillar has live data.** It is at a neutral baseline until Q2 2026.
- **Do not claim years of historical data.** The index has only been running for a few weeks.
- **Do not claim the index has been peer-reviewed, academically validated, or backtested.** It has not.
- **Do not claim pricing is live or that users can purchase Pro/Enterprise today.** Stripe is not integrated. Waitlist only.
- **Do not claim predictive accuracy with specific numbers** (e.g., "85% accurate"). The leading indicator relationship (Form D to hiring) is a reasonable hypothesis based on funding-to-hiring patterns, not a validated statistical model.
- **Do not claim real-time data.** The index updates weekly, not in real time.
- **Do not claim coverage of non-C-suite fractional roles.** The index tracks six roles: fractional CFO, CMO, CTO, COO, CRO, and interim CEO.
- **Do not disparage competitors by name.** State Pulse's advantages factually.
- **Do not guarantee ROI or financial outcomes** from using the index.
- **Do not imply the index is an official government or institutional metric.** It is a proprietary composite index published by Fractionl.
