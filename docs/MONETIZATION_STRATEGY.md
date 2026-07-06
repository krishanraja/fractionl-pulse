# Monetization Strategy: Fractional Working Index

> **MODEL UPDATE (2026-07-06): the human dashboard is now FREE; monetization moved to the metered agent/enterprise API.** The $99/mo human Pro tier was retired. Rationale from the product audit: the exact data sold as Pro was already free and unauthenticated via the public API (so a human paywall protected nothing), and zero API keys had ever been issued. The paid wedge is now the metered API (self-serve free key at 1,000 req/day, higher keyed tiers, enterprise/data licensing). The Pro-tier and Stripe-checkout content below is retained for historical reference and for a possible future human tier, but it is NOT the current model. See [NORTH_STAR.md](NORTH_STAR.md).

## Executive Summary

Pulse monetizes the Fractional Working Index across four revenue streams: SaaS subscriptions (Free, Pro, Enterprise), data licensing (research, media, feed), partnership revenue (white-label, affiliate), and AI-agent-native API access. This document is the source of truth for pricing, packaging, target ICP, ROI proofs, and go-to-market sequencing — designed to be consumed by AI sales agents at scale.

> **Status note (HISTORICAL, pre-2026-07 human-Pro model; superseded by the banner above):** In the retired human-Pro model, Stripe self-serve checkout was never live and all conversions routed through the waitlist with manual onboarding (Stripe account: Fractionl AI, shared with Circle; billing contact: data@fractionl.ai), with founding-customer pricing locking the rate for waitlist signups. This describes a past plan and applies only if a human paid tier is ever reintroduced. It is NOT the current model; the human dashboard is free and the paid product is the metered agent API plus enterprise and data licensing.

---

## 1. Revenue Model Overview

```
                           REVENUE STREAMS
                                   │
        ┌──────────────────────────┼─────────────────────────┐
        ▼                          ▼                         ▼
┌────────────────┐        ┌────────────────┐        ┌───────────────┐
│  SaaS Tiers    │        │ Data Licensing │        │  Partnerships │
│                │        │                │        │               │
│ • Free         │        │ • Citation     │        │ • White-label │
│ • Pro $99/mo   │        │ • Daily feed   │        │ • Embeds      │
│ • Enterprise   │        │ • Realtime     │        │ • Affiliates  │
│ • API access   │        │ • Backfill     │        │ • Integrations│
└────────────────┘        └────────────────┘        └───────────────┘
```

---

## 2. SaaS Subscription Tiers

### Free — Lead Generation

**Purpose:** awareness, email capture, agent prospecting

| Feature | Included |
|---------|----------|
| Overall FWI score | ✅ |
| 30-day trend indicator | ✅ |
| Top 5 movers | ✅ |
| Weekly email digest | ✅ |
| Readiness assessment gauge | ✅ |
| Public REST API access (1K req/day) | ✅ |
| Sub-index breakdown | ❌ |
| Historical data | ❌ |
| AI insights | ❌ |
| Custom alerts | ❌ |
| Markdown brief export | ❌ |

**Conversion levers:**
- Gated 12-month history requires email
- "Pro" features visible but blurred on dashboard
- Weekly digest CTAs to Pro
- Score-band-triggered upsell ("FWI just hit Surging — Pro users got the alert 2 days ago")

### Pro — $99 / month ($79 / month annual)

**Purpose:** core revenue driver for individual operators and small teams

| Feature | Included |
|---------|----------|
| Everything in Free | ✅ |
| Full sub-index breakdown (demand / supply / culture) | ✅ |
| 12-month historical data + trendlines | ✅ |
| Per-source signal table (all 21 sources) | ✅ |
| Role-level Adzuna demand breakdown | ✅ |
| AI-powered insight cards (GPT-4o-mini) | ✅ |
| Custom threshold alerts | ✅ (when webhooks ship) |
| Markdown weekly brief export | ✅ |
| PDF report export | ✅ |
| Methodology deep-dive (anomaly guard, normalization curves) | ✅ |
| Custom weight tuning + readiness gauge personalization | ✅ |
| Priority support | ✅ |

**Target customers (Pro)**

| ICP | Why they convert |
|-----|------------------|
| Fractional CFO/CMO/CTO making $200K+ | Pricing and timing decisions. ROI in week one. |
| Boutique fractional staffing agency principal | Outbound timing, client advisory ammunition |
| Career coach with fractional-curious client base | Cited weekly data instead of gut feel |
| Solo HR consultant | Workforce-planning credibility tool |
| Talent-economy newsletter writer | Citable weekly source for content |

**Acquisition channels (Pro)**

- LinkedIn organic (founder + customer thought leadership)
- LinkedIn paid (job-title targeted: "Fractional CFO", "Interim CEO", agency principals)
- Content marketing — weekly market brief embedded in newsletters
- Podcast appearances on fractional / talent-economy shows
- Referral program (1 month free for both sides)
- "FWI hit Surging" public posts — score band as discovery hook

**Unit economics (target)**

| Metric | Target |
|--------|--------|
| CAC (Pro) | < $150 blended |
| LTV (Pro, 8mo avg tenure) | $800 |
| LTV : CAC | > 5:1 |
| Gross margin | 85% (data costs are fixed; subs are pure margin) |
| Free → Pro conversion | 5% |
| Annual:monthly mix target | 40 / 60 |

### Enterprise — $500 to $5,000 / month

**Purpose:** high-value accounts with API, white-label, or custom needs

| Feature | Included |
|---------|----------|
| Everything in Pro | ✅ |
| API access (REST, MCP, planned GraphQL) | ✅ |
| White-label embeddable widget | ✅ (planned) |
| Custom weighting models for industry sub-indices | ✅ |
| Industry / vertical sub-indices on request | ✅ |
| Raw data exports (signals + scores, JSON / CSV) | ✅ |
| SSO / SAML | ✅ |
| Dedicated success manager | ✅ |
| 99.9% uptime SLA | ✅ |
| Custom integrations | ✅ |

**Pricing matrix**

| Package | Price / month | Includes |
|---------|---------------|----------|
| Starter | $500 | 5 seats, basic API, 10K calls/mo, citation rights |
| Growth | $1,500 | 20 seats, full API, 50K calls/mo, embeddable widget |
| Scale | $3,000 | Unlimited seats, 200K calls/mo, custom sub-indices |
| Custom | Negotiated, up to $5,000/mo | Dedicated indices, custom weighting, SSO, SLA |

Enterprise SaaS caps at $5,000/mo. Includes REST + MCP access, custom weighting, vertical sub-indices, raw exports, SSO, and SLA. The white-label PARTNERSHIP (setup fee + $2,000 to $10,000/mo license) is a separate program documented in Section 4, not an Enterprise SaaS tier.

**Target customers (Enterprise)**

| ICP | What they buy | Why they pay |
|-----|---------------|--------------|
| HR tech / talent marketplace SaaS | API + white-label | Embeds market intelligence, charges premium tier without building research function |
| Boutique → mid-market staffing agency | Embed + advisory | Differentiates against larger competitors with cited weekly data |
| Series A–C VC platform team | Data feed | Validates portfolio workforce thesis with external composite |
| Enterprise HR / talent ops | API + advisory | Quantifies hire-fractional-vs-full-time decisions, de-risks workforce planning |
| Business media outlet | Citation + feed | Weekly citable index with transparent methodology |

---

## 3. Data Licensing

### Research & Media License

**Use case:** academic papers, journalism, industry reports

| Package | Price | Terms |
|---------|-------|-------|
| Citation License | $500 one-time | Use in 1 publication, attribution required |
| Annual Research | $5,000 / year | Unlimited citations + raw history access |
| Media Partnership | Negotiated | Embargo / exclusivity options for major outlets |

**Requirements**
- Attribution: "Source: Fractional Working Index, Pulse by Fractionl (pulse.fractionl.ai)"
- No reselling or redistribution of raw signals
- Embargo compliance for exclusive access tiers

### Data Feed License

**Use case:** integration into third-party platforms

| Tier | Price / month | Delivery |
|------|---------------|----------|
| Daily JSON Feed | $1,000 | S3 push or webhook, weekly composite |
| Daily Signals Feed | $1,500 | S3 push, raw 21-source signals + composite |
| Realtime feed | $2,500 | WebSocket / SSE, change events pushed on every pipeline settle |
| Historical Backfill | $5,000 one-time | Full dataset since launch (CSV + Parquet) |

**Terms**
- Non-exclusive license
- Internal use only (no resale of raw)
- Rate limits per tier
- Attribution required in any user-facing derived product

---

## 4. Partnership Revenue

### White-Label Partnership Program

This is a **separate program** from the Enterprise SaaS tiers (which cap at $5,000/mo). The up-to-$10,000/mo figure belongs here, not in Enterprise SaaS.

**Offer:** full FWI dashboard with partner branding, embeddable in their product

| Component | Pricing |
|-----------|---------|
| Setup fee | $10,000 one-time |
| Monthly license | $2,000 – $10,000 |
| Revenue share option | 10–20% of partner-attributed revenue |

**Partner requirements**
- Minimum $5K MRR commitment
- Co-marketing agreement
- Joint case study + logo placement
- Quarterly business review

### Affiliate Program

**Structure:** 20% recurring commission for 12 months

| Level | Requirements | Commission |
|-------|--------------|------------|
| Standard | Any verified referral | 20% |
| Partner | 10+ referrals / month | 25% |
| Elite | 50+ referrals / month | 30% + bonus |

**Tracking:** unique referral codes + 90-day cookie

### Strategic Integration Partners

Embed Pulse data inside marketplaces and HR tools as a "market context" tier:

- Talent marketplaces (fractional placement platforms)
- ATS / HRIS vendors (workforce planning modules)
- VC portfolio platforms (founder dashboards)
- Career-coaching SaaS (client advisory layer)
- Newsletter / media platforms (weekly citation widget)

---

## 5. ICP, Outcomes, and ROI Proof Points (for AI sales agents)

### ICP 1 — Fractional Executive ($200K+ income)

**Trigger signals (use in outbound):** new client landed, new pricing page, LinkedIn post about rates, podcast appearance, job-title change to "Fractional"

**Outcome they get:** confidence to raise rates 10–25% during "Surging" weeks; cited data when negotiating with clients; readiness gauge calibrated to personal situation.

**ROI math:**
- Pro = $99/mo = $1,188/yr
- One $5K rate increase per year = 4.2x return
- Two clients × $5K/yr rate confidence = 8.4x return

**Best-fit message:** "There's a public index for your market now. Most weeks tell you whether to push rates or hold. {{score}} this week, {{label}} band — your move."

### ICP 2 — Boutique Fractional Staffing Agency ($1M–20M revenue)

**Trigger signals:** new BD hire, recent thought-leadership push, expanded service line, new website, hiring "Head of Marketing"

**Outcome they get:** time outbound campaigns to "Growing" / "Surging" weeks; double inbound during cultural-momentum spikes; pitch decks with cited weekly data instead of stale industry reports.

**ROI math:**
- Enterprise Growth tier = $1,500/mo = $18K/yr
- One additional placement per year (avg fee $25K) = 1.4x return on its own
- Pipeline timing improvement of 20% on $5M revenue = $1M revenue impact

**Best-fit message:** "Most agencies time outbound by quarter. Pulse times outbound by week. Last week was Growing — your campaigns hit a market that wanted them."

### ICP 3 — HR Tech / Talent Marketplace SaaS

**Trigger signals:** recently shipped a marketplace feature, new "intelligence" tier, founder hiring data engineers, content about "talent economy"

**Outcome they get:** embed FWI gauge in product, charge premium "market intelligence" tier without building a research function, cite Pulse in marketing.

**ROI math:**
- Enterprise Scale ($3,000/mo, SaaS caps at $5K) or the separate white-label partnership ($10K setup + $2K–$10K/mo)
- Adds $50–$500 per customer to their premium tier
- 200 customers × $100 uplift = $240K ARR addition

**Best-fit message:** "Your customers want market context. We deliver it as one API call. Embed our index in your dashboard, charge an intelligence tier, keep the margin."

### ICP 4 — Series A–C VC / PE Platform Team

**Trigger signals:** posts about portfolio workforce strategy, recent platform-team hire, "operating partner" content, fractional-program launch in portfolio

**Outcome they get:** validate workforce thesis with external composite; calibrate portfolio fractional spend; arm portfolio CEOs with citable market context.

**ROI math:**
- Enterprise Growth tier = $1,500/mo = $18K/yr
- Distributed across 30-portfolio fund = $50/company/mo
- One avoided hiring mistake on a portfolio company > years of subscription

**Best-fit message:** "The Form D Lead, our method of using SEC Form D filing velocity as a 1 to 3 month leading indicator of fractional executive demand, turns your sector signal into an external composite that arms every portfolio CEO. Companies file Form D within 15 days of a raise, then enter the fractional buyer pool 1 to 3 months later."

### ICP 5 — Enterprise HR / Talent Ops (500+ employees)

**Trigger signals:** recent layoff, restructure announcement, new VP Talent, fractional-program pilot, workforce-planning RFP

**Outcome they get:** quantified hire-fractional-vs-full-time decisions; weekly market context for budget reviews; risk-adjusted workforce planning.

**ROI math:**
- Enterprise Growth = $1,500/mo = $18K/yr
- One avoided full-time hire that should've been fractional ($250K loaded vs $80K fractional) = ~9x return

**Best-fit message:** "Your workforce planning runs quarterly. The fractional market moves weekly. Pulse closes the gap."

### ICP 6 — Talent-Economy Journalist / Outlet

**Trigger signals:** recently published anything on fractional / contract work, beat reassignment, new newsletter launch, request for industry data

**Outcome they get:** citable weekly index, quotable expert source, embargo access for major stories.

**ROI math:** $5K/yr citation license vs. months of original research per article.

**Best-fit message:** "Stop chasing one-off data points. We publish a citable weekly index with transparent methodology. The next time you write about fractional work, you've got a source."

### ICP 7 — AI Agent Builder / Outbound Tool

**Trigger signals:** building outbound automation, talent-market chatbot, VC research agent, fractional matching platform

**Outcome they get:** one tool call answers "is now a good time to hire fractional X?"; personalized outbound branches on score band; eliminated need to stitch 5 APIs.

**Best-fit message:** "Free public API, MCP-ready, no auth. Plug it into your agent in 2 minutes. Your prospect asks 'is now the right time?' — your agent answers with cited data."

---

## 6. Pricing Psychology

### Anchoring
- Always show Enterprise pricing first on outbound to enterprise prospects
- Pro feels affordable by comparison ($99 vs $1,500)
- Free establishes floor value

### Decoy effect
- Pro monthly $99 vs Pro annual $79 effective ($948 / 12) — anchored saving = $240/yr
- Headline messaging: "Save $240/yr on annual"

### Loss aversion
- "You're missing 67% of market signals on Free"
- Downgrade friction: "You'll lose your historical data + custom weights"

### Social proof
- "Join {{n}} fractional executives" (when count is meaningful)
- Customer logos on pricing page
- Real-time waitlist counter

### Trigger-band pricing
- Score-band-driven CTAs: "FWI hit Surging — see which roles led the move"
- Re-engagement on band changes: "Market just flipped from Growing to Surging — Pro users were alerted yesterday"

---

## 7. Go-to-Market Sequencing

### Phase 1 — Foundation (Live now)

- ✅ Free dashboard + public no-auth REST API live (verify_jwt=false on fwi-api and export-brief; bare curl returns HTTP 200)
- ✅ 21 sources operational
- ✅ Daily cron + Resend alerts
- ✅ Waitlist active
- ✅ Markdown brief export
- ✅ Machine-readable discovery surfaces shipped (/product-truth.json, /llms.txt)
- 🚧 Build email list to 1,000 subscribers
- 🚧 Content marketing (weekly briefs as newsletter)

### Phase 2 — Pro Launch (next)

- 🚧 Stripe integration + checkout
- 🚧 Email launch to waitlist
- 🚧 Referral program activation
- 🚧 Webhook threshold alerts
- 🚧 Custom alerts UI in dashboard
- **Target:** 50 Pro subscribers in first month, 200 in first quarter

### Phase 3 — Enterprise Pilots

- Outbound to 20 enterprise prospects (HR tech, agencies, VCs)
- Sign 3–5 pilot accounts at Growth or Scale
- Build case studies with named logos
- Refine enterprise packaging from real conversations
- White-label widget GA

### Phase 4 — Scale

- Paid acquisition (LinkedIn, Google, podcast sponsorships)
- Strategic integration partners (HR tech, marketplaces)
- Data licensing deals with media outlets
- Affiliate program activation
- API tier auth + SLA enforcement
- **Target:** $50K MRR

---

## 8. Financial Projections (Year 1 from Pro launch)

| Quarter | Pro subs | Enterprise | MRR | ARR |
|---------|----------|------------|-----|-----|
| Q1 | 50 | 1 | $5,500 | $66K |
| Q2 | 150 | 3 | $18,000 | $216K |
| Q3 | 300 | 7 | $43,500 | $522K |
| Q4 | 500 | 12 | $79,000 | $948K |

### Cost structure (Year 1)

| Category | Monthly | Annual |
|----------|---------|--------|
| Infrastructure (Vercel + Supabase Pro) | $200 | $2,400 |
| Data sources (paid APIs: Adzuna, NewsAPI, Mediastack, Apify, SerpAPI, PDL, Podchaser) | $2,000 | $24,000 |
| OpenAI (insights generation) | $100 | $1,200 |
| Resend (email alerts + digests) | $50 | $600 |
| Marketing (paid + content) | $5,000 | $60,000 |
| Support (contractor part-time) | $2,000 | $24,000 |
| Tools / SaaS | $300 | $3,600 |
| **Total** | **$9,650** | **$115,800** |

### Break-even

- Monthly fixed costs: ~$10,000
- Pro contribution margin: ~$84/sub (85% gross)
- Enterprise contribution: ~$1,275 average (85% gross)
- Break-even: ~100 Pro + 2 Enterprise

---

## 9. Competitive Moat

### Defensibility factors

1. **Data network effects** — more users → more signal sources → more white-label embeds → more demand for the index
2. **Methodology IP** — published composite calculation, anomaly guard, leading-indicator architecture; reproducible only with engineering effort + paid API budget + 52 weeks of patience
3. **First-mover advantage** — brand association with "fractional index", media relationships, SEO authority on every fractional+market query
4. **Switching costs** — historical data lock-in, embedded widgets, integration dependencies, custom-weight personalization
5. **Agent-native moat** — every agent built against the public no-auth API is a passive distribution channel that gets stronger weekly
6. **Cross-source triangulation** — single sources are gameable; 21-source composites with anomaly guards are not
7. **The Form D Lead** — our named method of using SEC Form D filing velocity as a 1 to 3 month leading indicator of fractional executive demand (companies file Form D within 15 days of a raise, then enter the fractional buyer pool 1 to 3 months later). The differentiator no competitor has.

### Competitive responses

| Competitor move | Pulse response |
|-----------------|----------------|
| Large player enters | Double down on niche depth and methodology transparency |
| Price undercut | Emphasize data quality, source breadth, leading indicator |
| Source overlap | Negotiate exclusive partnerships (marketplace data) |
| Feature copy | Accelerate composite + AI insights cadence |
| Free clone | Surface the cost of running 21 paid APIs publicly |

---

## 10. Key Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data source rate limits / cost spike | Medium | High | Multi-source redundancy (3 news APIs, 2 trends), `SKIP_SOURCES` env override |
| Single source goes dark | Medium | Medium | Composite design absorbs single-source loss; weight redistributes |
| Low Free → Pro conversion | Medium | High | Score-band-triggered CTAs, gated history, custom alerts |
| Long enterprise sales cycle | High | Medium | Self-serve Pro + product-led growth motion before enterprise outreach |
| Methodology challenged publicly | Low | High | Transparent docs, peer-review-friendly stance, anomaly guard documented |
| Stripe launch delay | Medium | Medium | Manual enterprise onboarding, founding-customer pricing as inducement |
| Index gaming attempt | Low | Medium | Anomaly guard, cross-source triangulation, manual review of large WoW deltas |

---

## 11. Success Metrics

### North star
- **Primary:** Monthly Recurring Revenue (MRR)
- **Secondary:** Active Pro subscribers + Enterprise ACV

### Leading indicators

| Metric | Target | Frequency |
|--------|--------|-----------|
| Free signups | 200 / week | Weekly |
| Public API requests | 50K / week | Weekly |
| Free → Pro conversion | 5% | Monthly |
| Pro churn rate | < 5% / month | Monthly |
| NPS (Pro) | > 50 | Quarterly |
| API integrations published (3rd-party) | 1+ / quarter | Quarterly |
| Weekly brief opens | > 35% | Weekly |
| Cited mentions in press | 1+ / month | Monthly |
| Agent-driven API requests (MCP / function call) | 25%+ of total by month 12 | Monthly |

---

## 12. Sales Anchors for AI Agents

When an AI sales agent qualifies a prospect, it should reach for one of these anchors based on what the prospect just said:

| Prospect signal | Anchor |
|-----------------|--------|
| "We rely on quarterly reports" | "Quarterly is too slow for fractional. We publish weekly. Try the API right now: `curl pulse.fractionl.ai/api/current`." |
| "We use LinkedIn to track this" | "LinkedIn doesn't track fractional specifically. We track 6 roles, weekly, with the Form D Lead: SEC Form D filing velocity as a 1 to 3 month leading indicator." |
| "Is this another job board?" | "Composite, not raw. 21 sources. Demand + supply + culture. Single number, weekly cadence, transparent methodology." |
| "How do you handle gaming?" | "Anomaly guard rejects anything more than 3σ from its 8-week rolling mean. 21-source triangulation, not single-source." |
| "Why $99/month?" | "Target user makes $200K. One well-timed rate decision pays for years. Pro includes 21 signals + 12mo history + AI insights." |
| "How fresh is the data?" | "Daily ingest at 06:00 UTC. Weekly composite settle. The live dashboard pushes updates within seconds of pipeline completion via Supabase subscriptions." |
| "I want to embed this in my product" | "White-label PARTNERSHIP, $10K setup + $2K–$10K/mo license (separate from Enterprise SaaS, which caps at $5K/mo). Custom sub-indices on request. The public no-auth API covers most embed use cases." |
| "I'm building an AI agent that needs this" | "MCP tool definition is in the repo. Free public API. Two endpoints. Includes shortcut headers for cheap polling. Ship in 10 minutes." |

For full outbound sequences, qualifying questions, and discovery scripts, see [`SALES_PLAYBOOK.md`](./SALES_PLAYBOOK.md).
