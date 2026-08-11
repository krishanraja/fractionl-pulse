# Pulse by Fractionl

**Pulse is the independent market instrument for fractional leadership.** It publishes the Fractional Working Index (FWI), a free 0 to 100 composite showing whether demand is expanding, which C-suite roles are moving, and how strong the evidence is.

[Live product](https://pulse.fractionl.ai) · [Current FWI JSON](https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current) · [Corporate strategy](docs/CORPORATE_STRATEGY.md) · [Technical specification](docs/TECHNICAL_SPEC.md)

## Product scope

Pulse covers fractional CFO, CMO, CTO, COO, CRO, and interim CEO roles. Current role-demand collectors are US-scoped; English-language cultural inputs can include UK material but do not create a UK market benchmark. Twenty-one tracked inputs contribute to three pillars:

```text
FWI = (Demand × 0.50) + (Supply × 0.20) + (Culture × 0.30)
```

Sources refresh daily and the composite is interpreted on a weekly cadence. Pulse is a private composite published by Fractionl, not an official or government index. It is not real-time, peer-reviewed, academically validated, backtested, or a promise of future market performance.

## Who it serves

### Free public audience

- Fractional executives reading market and role movement
- Companies considering a fractional leader
- Researchers and journalists citing the public instrument
- Developers and AI agents using the public REST API or MCP tools

Fractional executives are an important audience, but they are not the primary payer. The public index, role pages, brief, REST API, and MCP tools remain free.

### Primary paying ICP

The first commercial hypothesis is a specialist fractional-executive marketplace, staffing or placement firm, or collective in the United States or United Kingdom that:

- Places several C-suite functions
- Completes at least 50 engagements per year
- Has approximately 5 to 50 staff or £1 million to £30 million in revenue
- Stores structured engagement data in an ATS, CRM, or marketplace
- Lacks an independent market-intelligence function
- Can contribute privacy-safe anonymised engagement records

The economic buyer is usually the founder, CEO, managing director, or COO. They are not buying a larger quota for the public score. The proposed paid value is a private comparison of their book against a verified, multi-partner cohort.

### Explicitly not the ICP

Pulse is not an adtech product and is not for publishers as a paid product. Advertising buyers, media outlets, journalists, individual executives, single-hire companies, generic staffing firms, and AI-agent builders may use the public instrument. They are not the primary economic buyer.

## Problem and positioning

> The fractional leadership market still runs on anecdotes.

Specialist firms see their own pipeline but struggle to separate company-specific performance from market movement. Pricing, supply allocation, expansion, and client advice are often based on a small internal sample, public job searches, peer conversations, and generic staffing reports.

Public promise:

> Read the fractional leadership market like an instrument.

Partner promise:

> Benchmark your book against the market before your pipeline tells you too late.

Go Fractional already publishes free role, demand, and compensation benchmarks. Pulse must not claim to be the first or only fractional index. The paid thesis becomes differentiated only when Pulse combines the transparent public instrument with privacy-safe first-party engagement data from several independent partners.

## Offers and pricing

Paid prices are strategic hypotheses until customers pay. Conditional plans are not generally available.

| Offer | Price | Status |
|---|---:|---|
| Public instrument | £0 | Live, including score, history, role pages, brief, REST API, MCP tools, methodology, and source health |
| Founding Benchmark Partner | £1,500 for 90 days | Application-only validation offer, maximum ten organisations, subject to data and privacy review |
| Benchmark Membership | £6,000 per year | Conditional on ten active partners, 500 verified trailing-12-month engagements, and safe cohorts |
| Enterprise and portfolio | From £15,000 per year | Conditional on 1,500 verified engagements and sufficient cohort coverage |

Every displayed partner cohort must meet the approved minimum record count and contain data from at least three independent organisations. Exact privacy and suppression rules must be approved before partner-data ingestion launches.

See [docs/CORPORATE_STRATEGY.md](docs/CORPORATE_STRATEGY.md) for the evidence matrix, assumptions, ICP, go-to-market plan, and validation gates.

## What is live

- Current FWI, demand, supply, and culture components
- Twelve months of mixed-frequency history, with daily observations accumulating since June 2026
- Six role-demand pages and cross-sectional role movement
- Weekly market brief and machine-readable discovery surfaces
- Public REST endpoints and four hosted MCP tools
- Data completeness and per-source health
- Supabase Auth for saved account context
- Daily scheduled ingestion and pipeline alerts

Historical coverage is not uniform. Supply and culture do not have live coverage across the entire displayed period. Role pages measure demand, not role-specific supply.

## Agent and developer access

Public reads require no authentication:

```bash
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3"
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief
```

Base URL: `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1`

| Endpoint | Purpose |
|---|---|
| `GET /fwi-api/current` | Latest composite, components, prior-period change, movers, source details, and completeness |
| `GET /fwi-api/history?months=N` | Historical score observations, with `N` clamped to 1 through 12 |
| `GET /fwi-roles` | Demand readings for the six covered roles |
| `GET /export-brief` | Weekly brief as Markdown or JSON |
| `POST /fwi-api/trigger` | Service-role-only ingestion trigger, not public |

Optional API keys support operational rate controls. They are not a paid generic-data tier.

Hosted MCP server:

```text
https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp
```

Tools:

- `get_fractional_working_index`
- `get_fwi_weekly_brief`
- `get_content_radar`
- `get_content_brief`

Discovery surfaces:

- `/product-truth.json`
- `/llms.txt`
- `/.well-known/ai-plugin.json`
- `/sitemap.xml`
- `/feed.xml`

## Methodology and integrity

The weighting is Demand 50%, Supply 20%, and Culture 30%. If a pillar has no live data for a reading, its weight is redistributed proportionally and the response exposes the effective weights and completeness.

The tracked inputs include job postings, search interest, company-financing context, professional profiles, GoFractional's published operator-network size, public discourse, news, podcasts, self-employment, and macro context. Context signals enrich interpretation but are excluded from the composite where documented.

Integrity controls include:

- Per-source provenance and health status
- Anomaly checks against rolling history
- Weighted completeness in each score response
- Prior-period comparisons based on observed records
- Idempotent signal writes
- Pipeline execution logs and failure alerts
- A read-only weekly pipeline audit

The SEC Form D input is treated as a financing-context signal that may precede some fractional hiring. Its predictive relationship has not been validated, so Pulse must not attach a forecast-accuracy claim to it.

## Architecture

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion, Recharts, React Query |
| Backend | Supabase Postgres and Edge Functions |
| Auth | Supabase Auth |
| AI summaries | OpenAI model invoked from server-side functions, with caching and rate controls |
| Scheduling | Supabase `pg_cron` for 05:00 DataForSEO Jobs preparation and 06:00 ingest, with Vercel retry/backstop triggers |
| Deployment | Vercel at `pulse.fractionl.ai` |

Core Edge Functions:

| Function | Responsibility |
|---|---|
| `prepare-dataforseo-jobs` | Submit six idempotent async DataForSEO Google Jobs tasks at 05:00 UTC, record task IDs, and leave retrieval to the 06:00 ingest |
| `ingest-signals` | Collect and normalise tracked inputs |
| `calculate-fwi` | Produce the composite and movers |
| `fwi-api` | Serve current, historical, and protected trigger routes |
| `fwi-roles` | Serve role-demand readings |
| `export-brief` | Produce the weekly market brief |
| `generate-pulse-insights` | Produce cached summaries grounded in the index pipeline |
| `fwi-verdict` | Answer a scoped index question with origin, rate, and prompt controls |
| `mcp` | Expose the hosted MCP server |
| `send-pipeline-alert` | Send operational alerts |

## Local development

Requirements: current Node.js LTS and npm.

```bash
git clone https://github.com/krishanraja/fractionl-pulse
cd fractionl-pulse
npm install
Copy-Item .env.example .env
npm run dev
```

The browser bundle requires:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Server routes and scheduled jobs use:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

See [.env.example](.env.example) for the complete integration list. Never commit private keys or service-role credentials.

## Verification

```bash
npx tsc --noEmit
npm run build
npm run lint
npm run audit
npm run audit:json
npm run smoke:release -- --skip-site
```

The audit is read-only. It checks schedule adherence, source health, completeness, and provenance against the committed baseline. A degraded audit is an incident to investigate, not a result to hide. `smoke:release` exercises the public APIs, MCP compatibility, security boundaries, Ask the Index stream, discovery files, and live site routes; set `PULSE_URL` to verify a preview before production.

## Documentation map

| Document | Purpose |
|---|---|
| [Corporate strategy](docs/CORPORATE_STRATEGY.md) | Canonical ICP, buyer pains, positioning, pricing, evidence, and validation gates |
| [North star](docs/NORTH_STAR.md) | User outcome, buyer outcome, moat metric, and near-term gate |
| [Monetization strategy](docs/MONETIZATION_STRATEGY.md) | Packaging, price tests, and commercial rules |
| [Sales playbook](docs/SALES_PLAYBOOK.md) | Qualification, discovery, pilot, objections, and outreach |
| [Agent briefing](docs/AGENT_BRIEFING.md) | Current claims, offers, and prohibited language for AI agents |
| [Design system](docs/DESIGN_SYSTEM.md) | Information architecture, branding, device-specific layouts, interaction rules, and release acceptance widths |
| [Technical specification](docs/TECHNICAL_SPEC.md) | Architecture, schema, functions, and calculations |
| [Agent integration](docs/AGENT_INTEGRATION.md) | REST response and integration reference |
| [MCP tool guide](docs/MCP_TOOL.md) | MCP tools and implementation examples |
| [Data-sources roadmap](docs/DATA_SOURCES_ROADMAP.md) | Input inventory and future data work |
| [Weekly pipeline audit](docs/WEEKLY_PIPELINE_AUDIT.md) | Operational audit runbook |

## Contact

- Product: [pulse.fractionl.ai](https://pulse.fractionl.ai)
- Fractionl: [fractionl.ai](https://fractionl.ai)
- Benchmark Partner applications: [data@fractionl.ai](mailto:data@fractionl.ai?subject=Pulse%20Benchmark%20Partner)
