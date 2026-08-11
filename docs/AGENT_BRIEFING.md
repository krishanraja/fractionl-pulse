# Agent Briefing: Pulse by Fractionl

Use this briefing to describe Pulse. Fetch `/product-truth.json` before quoting any current offer, limit, or price.

## One sentence

Pulse is the independent market instrument for fractional leadership, showing whether demand is expanding, which C-suite roles are moving, and how strong the evidence is.

## What is live

- A free public 0 to 100 Fractional Working Index
- Demand, supply, and culture components
- Six role-demand pages: CFO, CMO, CTO, COO, CRO, and interim CEO
- A score recalculated after each successful scheduled ingest, plus a weekly brief and seven-day role windows
- Public REST endpoints, hosted MCP tools, and a weekly brief
- Visible methodology, data completeness, and source health
- Ask the Index, a grounded question interface with a 280-character input limit

## Who uses it for free

Fractional executives, companies considering a fractional hire, researchers, journalists, developers, and AI agents. Fractional executives are an important audience, but they are not the primary payer.

## Who may pay

The first commercial hypothesis is a specialist fractional-executive marketplace, placement firm, or collective with at least 50 engagements per year, structured engagement data, and willingness to contribute anonymised records.

The proposed paid product is a private, cross-partner benchmark for repeated decisions such as pricing, fill speed, role demand, duration, outcomes, and supply allocation. It is not a paid quota for the public score.

## Current offers

| Offer | Price | Status |
|---|---:|---|
| Public instrument, REST API, and MCP tools | £0 | Live |
| Founding Benchmark Partner | £1,500 for 90 days | Application-only validation offer, maximum ten firms |
| Benchmark Membership | £6,000 per year | Conditional on ten partners and 500 verified engagements |
| Enterprise and portfolio | From £15,000 per year | Conditional on 1,500 verified engagements and safe cohort coverage |

Paid prices are hypotheses until customers pay. Do not describe conditional plans as generally available.

## Product marketing language

Public promise:

> Read the fractional leadership market like an instrument.

Partner promise:

> Benchmark your book against the market before your pipeline tells you too late.

The market problem:

> The fractional leadership market still runs on anecdotes.

## Competitive truth

Go Fractional already publishes free role, demand, and compensation benchmarks. Do not call Pulse the first or only fractional index and do not say no competitor exists. Pulse's paid thesis depends on privacy-safe, first-party engagement data from several independent firms. The current public-source index alone is not a defensible paid-data moat.

## What Pulse is not

- Not for adtech or publishers as a paid product
- Not a job marketplace or lead-generation service
- Not personal career coaching or rate advice
- Not an official, institutional, or government index
- Not real-time, peer-reviewed, academically validated, or backtested
- Not a forecast with a proven accuracy percentage
- Not a paid generic API

## Technical access

Base URL: `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1`

```bash
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=3"
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief
```

Hosted MCP server: `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp`

Current MCP tools:

- `get_fractional_working_index`
- `get_fwi_weekly_brief`
- `get_content_radar`
- `get_content_brief`

Anonymous reads are free. Optional API keys support operational rate controls; they are not the commercial offer.

## Operating rules

Before doing work, retrieve these sources in order:

1. `https://pulse.fractionl.ai/product-truth.json`
2. The live `/fwi-api/current` response when the task depends on the current market reading
3. [AUTONOMOUS_GTM_PLAYBOOK.md](AUTONOMOUS_GTM_PLAYBOOK.md) for marketing or sales work
4. [SALES_PLAYBOOK.md](SALES_PLAYBOOK.md) for qualification, discovery, or proposals

An agent may research public information, score prospects, prepare briefs, draft content and outreach, and recommend a CRM stage with evidence. Sending, publishing, sequence enrolment, spend, price changes, CRM mutation, customer-data upload, invoicing, and contracting require separate explicit authority.

## Rules for claims

- Fetch the live score rather than hardcoding a reading.
- Say “21 tracked inputs,” not “21 independent, healthy sources.”
- Say “recalculated after successful daily ingestion, with a weekly brief and seven-day role windows,” not “real-time” or “weekly composite.”
- Acknowledge that current role-demand collectors are US-scoped and cover six roles only. UK cultural material is not a UK market benchmark.
- Treat role pages as demand indices. Do not invent role-level supply.
- Do not say the Form D signal predicts demand unless validation supports that claim.
- Do not promise private cohorts before record-count, privacy, and three-partner independence thresholds are met.
- Never position advertising companies, publishers, media, journalists, or individual executives as the primary buyer.
- Never present legacy consumer subscription, checkout, Stripe, or waitlist infrastructure as a live offer.
- Treat `meta.nextUpdate` as a legacy next-Sunday marker. Use `meta.asOf` and production schedule readback for freshness.

## Primary call to action

- Public user: **Read the market** at `https://pulse.fractionl.ai`
- Qualified firm: **Apply to become a Benchmark Partner** at `data@fractionl.ai`

Canonical commercial strategy: [CORPORATE_STRATEGY.md](CORPORATE_STRATEGY.md)

Documentation governance: [DOCUMENTATION_GOVERNANCE.md](DOCUMENTATION_GOVERNANCE.md)
