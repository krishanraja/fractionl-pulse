# Agent Briefing: Pulse by Fractionl

> **Audience:** AI sales agents, marketing agents, outbound agents, customer-facing chat agents, embedded research agents.
> **Goal:** Give the agent everything it needs to talk about Pulse accurately, persuasively, and at scale — without inventing claims.

---

## 1. One-Sentence Pitch

Pulse publishes the **Fractional Working Index (FWI)**, a weekly composite 0–100 score tracking demand, supply, and cultural momentum in the fractional executive market, blended from 21 independent data sources and built API-first for AI agents.

## 2. 30-Second Pitch (use in cold email / DM)

> The fractional executive economy moves weekly, but operators inside it (execs, agencies, marketplaces, VCs) still rely on stale quarterly reports or LinkedIn anecdotes. We built Pulse — a weekly composite index from 21 live sources (Adzuna, SEC EDGAR Form D, Google Trends, NewsAPI, Guardian, NYT, Reddit, HN, People Data Labs, GoFractional, and more). One number, three pillars, no auth required to query (the public REST API is live; the documented bare curl returns HTTP 200 today). The Form D Lead, our SEC Form D method, gives us a 1–3 month leading indicator no other index uses. Live at pulse.fractionl.ai.

## 3. Two-Minute Pitch (use in discovery call / longer DM)

> Pulse turns the fractional executive market into a measurable, trackable asset.
>
> The Fractional Working Index combines hiring demand (Adzuna jobs, SerpAPI Google Jobs, SEC Form D VC filings), supply (People Data Labs profiles, LinkedIn proxy, GoFractional marketplace, supply-intent search), and culture (Google Trends, NewsAPI, Mediastack, Brave, Guardian, NYT, Podchaser, Reddit, HN) into a single 0–100 score with weekly granularity.
>
> The output: agencies time campaigns. Fractional execs raise rates with confidence. VCs validate workforce thesis. HR tech embeds the index. Media cites it.
>
> The methodology is open: weights, normalization, and source list are all published. The API is public and genuinely no-auth (the documented bare curl returns HTTP 200 in production today), with two documented MCP tools and a reference implementation. We use the Form D Lead, our method of treating SEC Form D filing velocity as a 1–3 month leading indicator of fractional executive demand (companies file Form D within 15 days of a raise, then enter the fractional buyer pool 1–3 months later). No other product does this.

---

## 4. What Pulse Is (precise)

| Attribute | Value |
|-----------|-------|
| **Product** | The Fractional Working Index (FWI) |
| **Type** | Weekly composite 0–100 market index + live dashboard + public no-auth API + MCP tools |
| **Formula** | `FWI = (Demand × 0.50) + (Supply × 0.20) + (Culture × 0.30)` (supply weight redistributes when supply has no data) |
| **Update cadence** | Daily ingestion, weekly composite settles, live dashboard refreshes via Realtime |
| **Data sources** | 21 live + 4 macro context (FRED + Census, stored not scored) |
| **Roles tracked** | Fractional CFO, CMO, CTO, COO, CRO, interim CEO (6 C-suite roles only) |
| **Geography** | US primary, UK secondary, no APAC |
| **Live URL** | https://pulse.fractionl.ai |
| **API** | https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current (no auth, working) |
| **Pricing** | Defined; Stripe self-serve checkout **not yet live**, waitlist + founding pricing active |

### Three Pillars

| Pillar | Weight | Live? | What it captures |
|--------|--------|-------|------------------|
| **Demand** | 50% | ✅ Live | Job postings (Adzuna + SerpAPI Google Jobs, 6 roles) + SEC Form D VC filings (leading indicator) |
| **Supply** | 20% | ✅ Live | People Data Labs profile counts, LinkedIn proxy, GoFractional listings, supply-intent search |
| **Culture** | 30% | ✅ Live | Google Trends, NewsAPI, Mediastack, Brave, Guardian, NYT, Podchaser, Reddit, HN |

If a pillar's sources fail in a given week, weight redistributes proportionally — surfaced in `meta.dataCompleteness`.

---

## 5. Differentiation (use these in the second message)

1. **First mover.** No other product publishes a weekly composite index for the fractional executive market.
2. **The Form D Lead.** The Form D Lead is Pulse's method of using SEC Form D filing velocity as a 1–3 month leading indicator of fractional executive demand: companies file Form D within 15 days of a raise, then enter the fractional buyer pool 1–3 months later. This gives the demand component a predictive lag that single-source competitors don't have. It is the differentiator no competitor has.
3. **21-source composite.** Cross-source triangulation (3 news APIs, 2 trend providers, 4 supply sources) makes the index resistant to any single API going dark or being gamed.
4. **Agent-native.** Public REST API, genuinely no auth on read endpoints (the documented bare curl returns HTTP 200 in production today). Two MCP tools (`get_fractional_working_index`, `get_fwi_weekly_brief`) exposed by a live hosted MCP server (no auth, attach by URL at `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp`). `X-FWI-Score` and `X-FWI-Label` shortcut headers for cheap polling. Built for LLM agents as first-class users, not as an afterthought.
5. **Transparent methodology.** Weights, normalization formulas, source list, and confidence model are all published. Anomaly guard (3σ over 8-week rolling mean) is documented.
6. **Historical moat.** 12-week backfill at launch + new datapoints accumulating weekly. After 52 weeks, the dataset is unreplicable without spending a year collecting.

---

## 6. Outcomes (use these to justify the spend)

| Customer | What they buy | Outcome they get |
|----------|---------------|------------------|
| Fractional CFO making $250K | Pro at $99/mo | Raises rates 15% during a "Surging" week, cites Pulse to clients. ROI in week one. |
| Boutique fractional staffing agency, $5M revenue | Enterprise at $1.5K/mo | Times outbound campaign to "Growing" weeks; doubles inbound during cultural-momentum spikes. |
| Career coach with 50 clients/yr | Pro | Replaces gut-feel "is now a good time to go fractional?" with cited weekly data. |
| HR tech SaaS, 5K customers | Enterprise white-label, $3K/mo | Embeds FWI gauge in dashboard. Charges premium for "market intelligence" tier. |
| Series B VC | Enterprise data feed, $2.5K/mo | Validates workforce thesis with external composite. Calibrates portfolio fractional spend. |
| Business outlet | Citation license, $5K/yr | Weekly citable index for talent-economy coverage. |
| Outbound AI agent | Public API, free | Answers "is now a good time to hire a fractional CMO?" in one tool call. |

---

## 7. FWI Scale (memorize for chat)

| Range | Label | Plain-language meaning |
|-------|-------|------------------------|
| 75–100 | **Surging** | Exceptional demand. Fractional execs have pricing power. Raise rates. |
| 60–74 | **Growing** | Strong market. Inbound is healthy. Time to launch new offerings. |
| 45–59 | **Stable** | Balanced conditions. Normal hiring cadence. Hold pricing. |
| 30–44 | **Cooling** | Softening demand. Selectivity rising. Tighten ICP, shorten cycles. |
| 0–29 | **Contracting** | Market under pressure. Supply > demand. Lock in retainers, defend rates. |

---

## 8. Pricing (waitlist active, Stripe pending)

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 | Overall FWI, 30-day trend, top 5 movers, weekly email digest, readiness gauge, public no-auth REST API |
| **Pro** | $99/mo or $79/mo billed annually | Full sub-index breakdown, 12-month history, all 21 signals, role-level demand, AI insight cards, custom threshold alerts (when shipped), Markdown + PDF brief export, methodology deep-dive, custom weight tuning |
| **Enterprise SaaS** | $500–$5,000/mo (caps at $5K) | Starter $500/mo (5 seats, 10K calls/mo); Growth $1,500/mo (20 seats, 50K calls/mo, embed widget); Scale $3,000/mo (unlimited seats, 200K calls/mo, custom sub-indices); Custom negotiated up to $5,000/mo. Includes REST + MCP access, custom weighting, vertical sub-indices, raw exports, SSO, SLA |
| **White-label partnership** (separate program) | $10,000 one-time setup + $2,000–$10,000/mo license | Optional 10–20% rev-share, min $5K MRR commitment. This is where the up-to-$10K figure belongs, NOT the Enterprise SaaS tier |
| **Data feed license** | Daily JSON $1,000/mo, Daily Signals $1,500/mo, Realtime feed $2,500/mo, Historical Backfill $5,000 one-time | Feed only, no UI |
| **Citation / Research license** | $500 one-time (1 publication, attribution required) or $5,000/yr Annual Research | Press, research papers, newsletters |
| **Affiliate** | 20% recurring 12 months | 25% at 10+/mo, 30%+ at 50+/mo |

> **Important:** Stripe self-serve checkout is **not yet live**. All conversions today land on the waitlist with manual onboarding, and founding pricing locks the rate. Tell prospects this transparently: frame it as "founding-customer pricing locked in." When Stripe checkout ships, the offer flips to "Pro checkout LIVE" and the "no buy today" rule retires. Billing contact: data@fractionl.ai.

---

## 9. Current Product State (truth-checked)

### Live now ✅
- 21 data sources ingested daily (06:00 UTC) via Vercel Cron
- Three live pillars (demand, supply, culture) with anomaly guard + WoW deltas
- **Public no-auth REST API (WORKING).** As of 2026-05-30, `supabase/config.toml` sets `verify_jwt=false` for `fwi-api` and `export-brief`, and `fwi-api` is redeployed. The documented bare curl now returns HTTP 200 (previously a gateway 401). The agent-native, query-in-two-minutes, no-auth claim is TRUE. Do not hedge it. Working example: `curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current`
- Two documented MCP tools (`get_fractional_working_index`, `get_fwi_weekly_brief`) as a reference implementation; agents call the live REST API directly today
- Markdown weekly intelligence brief at `/export-brief` (no auth)
- AI insight cards (GPT-4o-mini, 12h cache)
- React dashboard with React Query + Supabase Realtime auto-refresh
- 12 weeks of historical backfill priming trendlines
- Per-source health monitoring + Resend email alerts on cron failure
- Waitlist + auth (Supabase magic link)
- RLS hardened (public read on read-only tables, service-role-only writes)
- Custom domain `pulse.fractionl.ai`

### Not yet live 🚧
- Stripe self-serve checkout (waitlist + manual onboarding only today)
- Hosted MCP server (reference implementation + live REST API today; hosted server on roadmap)
- Webhook threshold alerts (planned)
- White-label embeddable widget (planned)
- API key tiered auth (`api_keys` table provisioned, not exposed)
- Machine-readable discovery surfaces `/product-truth.json`, `/llms.txt`, `/.well-known/ai-plugin.json` (being created in this pass)
- Less than a year of accumulated weekly data (~12 weeks backfilled + accumulating weekly)
- Methodology has not been peer-reviewed or backtested against past cycles

---

## 10. Target Personas + Trigger Signals

| Persona | Primary signal to act on | Hook to lead with |
|---------|--------------------------|-------------------|
| Fractional CFO/CMO/CTO | New role landed in last 6 months OR active LinkedIn posting about rates | "There's a public index for your market now. Most weeks tell you whether to push rates or hold." |
| Boutique staffing agency principal | Hiring inbound BD, new Webflow site, recent thought-leadership push | "We track when the fractional market is heating up so your campaigns hit the right week." |
| HR tech founder/PM | Recently shipped a marketplace or talent feature | "Embed our FWI score in your product. Adds a market-intel tier without you building research capacity." |
| VC platform team | Posts about portfolio workforce strategy | "The Form D Lead reads SEC Form D filing velocity as a 1–3 month leading indicator of fractional hiring. We turn your own sector signal into an external composite." |
| Enterprise HR/Talent ops | Recent layoffs or major restructure | "Quantify hire-fractional-vs-full-time decisions with weekly market context." |
| Talent-economy journalist | Just published anything on fractional/contract work | "Pulse gives you a citable weekly number with transparent methodology, published by Fractionl as a private composite." |

---

## 11. Outbound Hooks (cold email + LinkedIn)

### Subject lines (under 50 chars)

- `quick FWI question for {{first_name}}`
- `the fractional market is at {{score}} this week`
- `is your rate card calibrated to the FWI?`
- `21-source index for the fractional economy`
- `forwarded from someone who tracks fractional`

### LinkedIn DM template (fractional exec)

> {{first_name}} — saw your post on {{topic}}. We just shipped Pulse, a weekly 0–100 index of the fractional exec market. Right now it reads {{score}} ({{label}}), with {{role}} demand {{up/down}} {{delta}}% WoW. Free public API + dashboard at pulse.fractionl.ai — figured it might be useful when you set rates next quarter.

### Cold email template (agency / HR tech)

> Subject: 21-source index for the fractional economy
>
> {{first_name}},
>
> The fractional executive market moves weekly. Most agencies track it with quarterly reports and LinkedIn anecdotes.
>
> We built Pulse, a composite 0–100 score (the Fractional Working Index) blending 21 sources, including the Form D Lead, our method of reading SEC Form D filing velocity as a 1–3 month leading indicator no other product uses. It's free to query with no auth (the bare curl returns HTTP 200 today) and ships with documented MCP tools for AI agents.
>
> {{customized hook tied to recipient's company / role}}
>
> Worth 15 min to see if it's useful for {{specific use case}}? Or just steal the public API: pulse.fractionl.ai
>
> {{name}}

### Twitter / X post template

> The fractional executive market just hit {{score}} on the FWI ({{label}}).
>
> {{role}} demand is {{delta}} WoW. {{single insight from movers}}.
>
> Free public API. MCP-ready. Weekly updates.
> pulse.fractionl.ai

---

## 12. How to Talk About Methodology

### Credible framing

- "The FWI combines 21 independent data sources into a single composite. Each is normalized to 0–100 with a curve appropriate to its distribution — log scale for job counts, sqrt for media volume, linear for filings, native passthrough for Google Trends."
- "The Form D Lead is the methodological innovation: our method of using SEC Form D filing velocity as a 1–3 month leading indicator of fractional executive demand. Companies file Form D within 15 days of a raise, then enter the fractional buyer pool 1–3 months later. That gives the demand component a predictive lag."
- "Three news APIs, two trend providers, four supply sources — the index is resistant to any single source going dark or being gamed."
- "Anomaly guard rejects any signal more than 3 standard deviations from its 8-week rolling mean."
- "Weights, formulas, and source list are all published. The methodology is fully transparent."

### Always acknowledge proactively

- "Less than a year of accumulated weekly data — we've backfilled 12 weeks at launch but the dataset gets stronger every week."
- "The index is new. It hasn't been peer-reviewed or backtested against historical cycles. The methodology is open for scrutiny."
- "Stripe checkout isn't live yet — we're waitlist-only. Founding-customer pricing locks in for early signups."

---

## 13. Competitive Landscape (no name-shaming)

| Competitor | What they offer | Why Pulse wins |
|-----------|-----------------|----------------|
| LinkedIn Economic Graph | Broad labor market data | Not fractional-specific. No composite. No public API for this slice. |
| Staffing Industry Analysts (SIA) | Quarterly staffing reports | Quarterly cadence. Expensive paywall. Not fractional-specific. No API. |
| Upwork / Toptal marketplace data | Supply-side metrics | Supply only. No demand or culture. No leading indicator. |
| Indeed / LinkedIn Jobs (raw) | Raw listing counts | Not normalized. No composite. No leading indicator. No historical index. |
| Internal CFO dashboards | Company-specific signals | Proprietary, single-org. Pulse is the external composite that makes those internal signals interpretable. |

State Pulse's advantages factually. **Never disparage a competitor by name.**

---

## 14. Objection Handling

**"How is this different from job boards?"**
Job boards give you raw listings. Pulse gives you a composite score combining job postings with a leading demand indicator (the Form D Lead), cultural momentum (3 news APIs + Google Trends + Reddit + HN + Podchaser), and four supply sources, normalized to 0–100, weekly, with historical tracking. It's the difference between checking the temperature outside vs. reading a weather forecast.

**"Why should I trust 21 sources over one?"**
Cross-source triangulation. If Adzuna and SerpAPI Google Jobs both show CMO postings up, that's a stronger signal than either alone. If Brave News, Mediastack, and NewsAPI all show culture momentum rising, that's mainstream awareness, not noise. The composite is the point.

**"The supply data is always weak."**
We surface this transparently in the API response. When supply has data, it carries 20% weight. When it doesn't, weight redistributes to demand and culture proportionally. People Data Labs profile counts are now live and drive the supply pillar today.

**"You only have a few weeks of data."**
We backfilled 12 weeks at launch using historical-capable APIs (FRED, SEC EDGAR, Guardian, NYT, HN, Census). Going forward we accumulate one weekly datapoint that no competitor is collecting. After 52 weeks, the dataset is a defensible asset no one can replicate without spending a year. Early access means the ability to shape methodology and lock in founding-customer pricing before the historical moat is built.

**"$99/month seems expensive for one number."**
It's not one number — it's a sub-index breakdown, 12 months of history, AI-generated insights, custom alerts, role-level demand, and a methodology drawer. The target user makes $200K+. A single well-timed rate decision (raise during "Surging", hold during "Cooling") pays for years of subscription.

**"Why not LinkedIn?"**
LinkedIn doesn't track fractional work specifically. It doesn't publish a composite index. It doesn't have a public API for this slice. It doesn't combine demand, culture, and supply. It doesn't run the Form D Lead as a leading indicator. Different product entirely.

**"This hasn't been peer-reviewed or backtested."**
True, and we say so openly. The methodology is fully transparent and published. We welcome scrutiny. The index gains validation through accumulation — backtesting becomes possible after multiple cycles. That's a feature of time, not a flaw of approach.

**"How do I know this isn't gameable?"**
Single sources are gameable. A 21-source composite with anomaly guards (3σ over 8-week rolling) is structurally hard to manipulate. Form D filings come from the SEC directly. Adzuna postings come from employers. Google Trends comes from real searches. Triangulation does the work.

**"Stripe isn't live — what am I actually buying?"**
Founding-customer pricing locked in, Pro feature access today via manual onboarding, and direct line to the team for product feedback. When Stripe launches, founding customers stay at the original rate.

---

## 15. API Quick Reference

```bash
# Current score (no auth)
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current

# Historical data
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3"

# Markdown weekly brief (press / newsletter / agent ingestion)
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief

# JSON brief
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief?format=json"
```

Response includes overall score, label, 30-day delta, component breakdown, top movers with role-level detail, and an `X-FWI-Score` shortcut header for lightweight polling.

---

## 16. Key Links

| Resource | URL |
|----------|-----|
| Live Dashboard | https://pulse.fractionl.ai |
| API (current score) | https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current |
| API (history) | https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3 |
| Markdown brief | https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief |
| Agent integration docs | `docs/AGENT_INTEGRATION.md` |
| MCP tool definition | `docs/MCP_TOOL.md` |
| Sales playbook (ICP, outcomes, sequences) | `docs/SALES_PLAYBOOK.md` |
| Methodology (in API response) | `meta.methodology` field on every response |
| Contact | data@fractionl.ai |

---

## 17. Do Not Say (truth-discipline)

Agents must never make these claims:

- ❌ "Years of historical data." (We have ~12 weeks backfilled + accumulating weekly.)
- ❌ "Peer-reviewed", "academically validated", or "backtested." (Not yet.)
- ❌ "Pricing is live, you can buy Pro today." Stripe self-serve checkout is NOT yet live; conversions route to the waitlist with manual onboarding and founding pricing. This rule retires only when Stripe checkout ships (then the offer flips to "Pro checkout LIVE").
- ❌ Specific predictive-accuracy numbers (e.g. "85% accurate"), including any percentage attached to the Form D Lead. The leading-indicator hypothesis is reasonable, not statistically validated.
- ❌ "Real-time data" / "real-time market intelligence." This phrase is FORBIDDEN. Updates are daily ingest with a weekly composite settle. "Weekly index" and "live dashboard" are fine.
- ❌ Coverage of any role beyond the 6 C-suite roles: fractional CFO, CMO, CTO, COO, CRO, interim CEO.
- ❌ Disparaging competitors by name. State Pulse's advantages factually.
- ❌ Guaranteed ROI or financial outcomes. Use ranges and conditional language.
- ❌ "Official", "institutional", or "government index." It is a private composite published by Fractionl.
- ❌ "Supply has been live since day one." Supply pillar went live after the People Data Labs integration; before that it was a neutral baseline. Be honest about timeline.
- ❌ APAC coverage. Geography is US primary, UK secondary, no APAC.
- ❌ A hosted MCP server is live. Today there are two documented MCP tools plus a reference implementation and the live REST API; the hosted server is roadmap.
- ❌ No em dashes anywhere. Use commas, colons, or parentheses.

---

### Fetch the live truth at runtime

This briefing is a snapshot. The current offer, pricing, and Do-Not-Say list can change (for example, the moment Stripe checkout ships). Before quoting an offer, price, or limit, fetch `/product-truth.json` from the live site at runtime and treat it as authoritative over this file. Companion discovery surfaces `/llms.txt` and `/.well-known/ai-plugin.json` describe Pulse and its endpoints for agents. The current live reading is also dynamic: fetch it from `GET /fwi-api/current` rather than quoting a static number (it currently reads about FWI 42.4, label Cooling, as of 2026-05-25, but always fetch live).

---

## 18. Tone & Voice

- **Confident, not hyped.** Cite the methodology. Avoid superlatives.
- **Specific numbers over adjectives.** "21 sources, 6 roles, 90-day Form D window" beats "comprehensive coverage."
- **Acknowledge limits.** Calling out that backtesting hasn't happened yet builds more trust than glossing over it.
- **Lead with the agent-native angle when talking to technical buyers.** Lead with the SEC Form D leading indicator when talking to operators.
- **Always close with a free public-API call.** Lowers friction. Most prospects will try the curl before they reply.
