---
title: What is the Fractional Working Index?
slug: what-is-the-fractional-working-index
description: The Fractional Working Index (FWI) explained: what it measures, its three pillars and weights, its five bands, how often it updates and its limits.
answer: The Fractional Working Index (FWI) is a free 0 to 100 composite of fractional leadership market health, published by Fractionl as Pulse. It weights demand 50%, supply 20% and culture 30%, is recalculated after each daily ingest, and from 26 October 2026 publishes each reading as a whole number with its band.
datePublished: 2026-10-21
dateModified: 2026-10-23
related: how-reliable-is-the-fractional-working-index, how-to-cite-the-fractional-working-index
keywords: Fractional Working Index, FWI, fractional leadership index, fractional executive market
---
## In one paragraph

The Fractional Working Index (FWI) is the reading at the centre of Pulse by Fractionl, an independent market instrument for fractional leadership. It is meant to let a reader tell, in under a minute, whether demand for fractional C-suite leaders is expanding or contracting, which roles are moving, and how complete the evidence is. The public index, its REST API and its MCP tools are free, with no key needed for reads.

## What it covers

- **Roles:** six role-demand lanes, fractional CFO, CMO, CTO, COO, CRO and interim CEO. Nothing beyond those six is claimed.
- **Geography:** the role-demand collectors are United States scoped. Cultural inputs are English-language and can include UK material, but that does not make the FWI a UK benchmark.
- **History:** the public API exposes up to 12 months of mixed-frequency observations. Daily score rows have accumulated since June 2026, and the full three-pillar composite does not exist for the whole period.

## The three pillars

| Pillar | Weight | What it reads |
|---|---|---|
| Demand | 50% | Job postings that name each of the six roles, plus startup-financing context from SEC Form D filings |
| Supply | 20% | Public signals of fractional executives offering their services |
| Culture | 30% | News, search interest, podcasts, forums and reference-page attention for fractional work |

If a pillar has no usable data for a reading, its weight is redistributed across the others and the API says so. Official labour statistics (BLS job openings, FRED initial jobless claims and Census self-employment) are collected as context and kept out of the composite, so they can be used to check it.

## The five bands

- **Surging:** 75 and above
- **Growing:** 60 to 74
- **Stable:** 45 to 59
- **Cooling:** 30 to 44
- **Contracting:** below 30

## How often it changes

The score is recalculated after each successful daily ingest. It is interpreted through a weekly brief and seven-day role windows, so the honest description is "recalculated daily, read weekly". The response field `meta.nextUpdate` is a legacy next-Sunday marker; use `meta.asOf` for the date of a reading.

## Where to read it

- The dashboard at [pulse.fractionl.ai](https://pulse.fractionl.ai/)
- Six role pages, for example [fractional CFO demand](https://pulse.fractionl.ai/fractional-cfo)
- `GET /fwi-api/current`, `GET /fwi-api/history?months=N`, `GET /fwi-roles` and `GET /export-brief` under `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1`, all free and keyless
- A hosted MCP server with four tools, including `get_fractional_working_index` and `get_fwi_weekly_brief`

## What it is not

It is not an official, institutional or government index. It is not a forecast, has not been backtested and makes no predictive-accuracy claim. It is not a job marketplace, rate adviser or career service. Its role pages measure advertised demand; Pulse does not publish a per-role supply score.

## Sources

- [Pulse machine-readable product truth](https://pulse.fractionl.ai/product-truth.json)
- [Pulse llms.txt](https://pulse.fractionl.ai/llms.txt)
- [Agent integration guide and response schema](https://github.com/krishanraja/fractionl-pulse/blob/main/docs/AGENT_INTEGRATION.md)
- [Technical specification: sources, normalisation and composite](https://github.com/krishanraja/fractionl-pulse/blob/main/docs/TECHNICAL_SPEC.md)

## Frequently asked questions

### Who publishes the Fractional Working Index?

Fractionl publishes it as part of Pulse. Pulse is a Mindmaker LLC company, with Mindmaker Ltd in the UK.

### Is the Fractional Working Index free to use?

Yes. The dashboard, the REST API and the MCP tools are free, and public reads need no key. Optional free keys exist only for operational rate accounting.

### Does a higher score mean higher fractional rates?

No. The index reads advertised demand, supply signals and attention. It does not measure achieved fees, willingness to pay or win rates, and Pulse will not invent a rate.

### What does data completeness mean?

It is the weighted share of the tracked evidence base that arrived for a reading. It says how much of the evidence was present, not how accurate the number is.
