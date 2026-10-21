---
title: Which fractional C-suite roles are most in demand?
slug: which-fractional-c-suite-roles-are-in-demand
description: How to see which fractional C-suite roles lead on advertised demand this week, what provider data says about finance roles, and what role rankings miss.
answer: The ranking moves week to week, so read it live: the Fractional Working Index ranks six roles, fractional CFO, CMO, CTO, COO, CRO and interim CEO, on US advertised demand over a trailing seven days. Over the longer run, Heidrick & Struggles reports CFOs as 51% of interim leadership requests on its platform.
datePublished: 2026-10-21
dateModified: 2026-10-21
related: is-fractional-leadership-growing-2026, what-is-the-fractional-working-index, how-to-cite-the-fractional-working-index
keywords: fractional CFO demand, fractional CMO demand, fractional CTO, fractional COO, fractional CRO, interim CEO
---
## The live ranking

Pulse publishes a 0 to 100 advertised-demand index for each of six roles. Each has its own page, rebuilt from the public data on every deployment:

- [Fractional CFO](https://pulse.fractionl.ai/fractional-cfo)
- [Fractional CMO](https://pulse.fractionl.ai/fractional-cmo)
- [Fractional CTO](https://pulse.fractionl.ai/fractional-cto)
- [Fractional COO](https://pulse.fractionl.ai/fractional-coo)
- [Fractional CRO](https://pulse.fractionl.ai/fractional-cro)
- [Interim CEO](https://pulse.fractionl.ai/fractional-ceo)

Each page shows the role's level, its band, its change against the previous seven days, the six-role average and the role's rank. The same data is one keyless request away:

```
curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-roles
```

Read `rank` for the order, `demand` and `band` for the level, `change7d` for the movement and `asOf` for the end of the seven-day window. Quote the rank with its date, because it can change the following week.

## How each role is measured

Each role index counts job postings that name the exact phrase, for example "fractional CFO" or "interim CEO", from a US job-board index and a Google Jobs cross-check. Each source is averaged over a trailing seven-day window, the sources are averaged together, and the result is normalised onto the same 0 to 100 scale as the FWI demand pillar. The two discovery sources may overlap and are not described as independent.

The bands match the headline index: Surging at 75 and above, Growing from 60, Stable from 45, Cooling from 30 and Contracting below 30.

## What the longer-run evidence says

- **Finance leads in provider data.** Heidrick & Struggles' 2026 High-End Independent Talent Report puts CFOs at 51% of the leadership requests on its platform, and interim leadership at 51% of its private equity project mix. That is one provider's book, so it is strong evidence about that provider and medium evidence about the market.
- **Free role benchmarks exist elsewhere.** Go Fractional publishes role-level demand and rate data from its own platform and surveys.

## What a role ranking cannot tell you

- **Referral work is invisible.** A large share of fractional engagements never reach a job board, and a posting count cannot see them.
- **Postings are not rates.** A high demand reading is not evidence of willingness to pay, achieved fees or pricing power. Pulse does not publish rate data.
- **Supply is not split by role.** Pulse does not publish a per-role supply or availability score, because its supply sources are not role-differentiated once normalised.
- **Six roles, one country.** Roles beyond the six, and markets outside the US, are not measured.

## Sources

- [Per-role demand indices (JSON, no key)](https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-roles)
- [Heidrick & Struggles, 2026 High-End Independent Talent Report](https://www.heidrick.com/-/media/heidrickcom/files/attachments/2026-high-end-independent-talent-report.pdf?rev=11494cb97e73494f80b759b5fb4d72d7)
- [Go Fractional, State of Fractional Work](https://www.gofractional.com/insights)
- [Fractional CFO demand index](https://pulse.fractionl.ai/fractional-cfo)

## Frequently asked questions

### Is fractional CFO the most in-demand fractional role?

Provider data points that way over the longer run: Heidrick & Struggles reports CFOs as 51% of leadership requests on its platform. For this week's order of the six roles on US advertised demand, read the live rank on the role pages.

### What does the chief executive lane count?

It counts postings that name the exact phrase "interim CEO". The page lives at /fractional-ceo alongside the other five roles, but the phrase it searches for is "interim CEO", and the page names that phrase so the number can be checked.

### What should a fractional CMO or CTO charge?

Pulse does not publish achieved-rate, willingness-to-pay or win-rate data and will not invent a fee. Use the role reading as advertised-demand context next to your own pipeline evidence.

### Are UK roles included?

No. The role-demand collectors are US-scoped, and Pulse does not publish a UK benchmark.
