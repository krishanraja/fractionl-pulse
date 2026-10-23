---
title: How the Fractional Working Index is made
slug: methodology
description: The method behind the Fractional Working Index, as the code runs it: inputs, pillars, the band, the 2026-10-26 seam, validation and limits.
dateModified: 2026-10-23
---
The Fractional Working Index (FWI) is a private composite from 0 to 100 that reads whether demand for fractional C-suite leadership in the United States is expanding or contracting. It is published daily by Fractionl as Pulse. It is not an official statistic, not a forecast, and it has **not been validated** against any external measure (see "Validation" below). This page describes the method as the code runs it, and every change to it is dated on the [changelog](/changelog).

**Owner:** Krish Raja, Fractionl. **Corrections:** [hello@krishraja.com](mailto:hello@krishraja.com). **Live reading:** [pulse.fractionl.ai](/) and the [current reading as JSON](https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current).

## How to cite it

Cite it as "Fractional Working Index (FWI), Pulse by Fractionl", with the reading's as-of date, its band and a link to https://pulse.fractionl.ai. For example: *"The Fractional Working Index read 45 (band 40 to 50) on 26 October 2026 (Pulse by Fractionl, pulse.fractionl.ai)."* Dated readings for the last 12 months are retrievable at `/fwi-api/history?months=12`, and a method change never restates a published reading: it takes effect from a dated seam.

## What a reading is

From 26 October 2026 each reading is a **whole number with a band**, for example **45 (40 to 50)**. The band is the interquartile range of the reading when each pillar's source votes are resampled with replacement 500 times, with a fixed seed per date so it never moves when nothing moved. It says how much the reading depends on which sources voted. It is not a confidence interval on the true state of the market. Readings before 26 October 2026 were published to one decimal place without a band; they are kept exactly as published.

Score bands: 75 and above Surging, 60 to 74 Growing, 45 to 59 Stable, 30 to 44 Cooling, below 30 Contracting.

## The method from 26 October 2026 (v2)

Three pillars, each the mean of one vote per source:

| Pillar | Weight | Inputs |
|---|---|---|
| Demand | 50% | Adzuna US job postings naming each of six roles; Google Jobs results for the same six roles (via DataForSEO); SEC Form D technology filings over 90 days (financing context) |
| Supply | 20% | Census Business Formation Statistics applications in professional services (NAICS 54, seasonally adjusted, monthly); BLS incorporated self-employed (year-over-year change, monthly); Google's result count for LinkedIn profiles naming four fractional roles (via DataForSEO) |
| Culture | 30% | NewsAPI article count over 28 days; Hacker News stories mentioning "fractional" over 30 days; Wikipedia pageviews for six articles |

**One vote per source.** A source that writes several rows (one per role) is averaged to one value before its pillar is averaged, so its influence does not depend on how many rows it writes.

**A missing source holds its last vote for up to 7 days**, then drops out. This stops the pillar jumping because a provider failed for a day.

**The LinkedIn profile count votes the median of its last 14 days.** The underlying Google estimate can move from about 50 to over 100,000 for the same query on consecutive days, so a single day is not trusted.

**The official supply series** are scored as known on each day: the latest month the agency had published by then, compared with its own previous 36 months as 50 + 10 × z, clamped to 0 to 100. A month counts as published from the 20th of the following month (Census) or the 12th (BLS), later than the agencies' own calendars. The BLS series is published unadjusted, so it is scored on its year-over-year change.

**Each input is put on a 0 to 100 scale before averaging:** job-posting counts on a log scale where 200 postings is 100; Form D filings linearly, where 800 filings in 90 days is 50; news counts by square root (15 × √count); LinkedIn profile counts on a log scale where 10,000 is 100; Wikipedia daily views on a log scale where 2,000 is 100; Hacker News by story count and average points.

**If no supply vote exists,** supply is reported as unmeasured and its weight is shared between demand and culture. A pillar is never filled with an assumed value.

**The chain link.** At the 26 October seam the new method would have read higher than the old one on the same days, because the retired inputs held the old level down. To keep the series continuous, a fixed amount is added to every v2 reading: the mean gap between the published readings and the v2 rebuild of the same 28 days before the seam. It is measured once, at the first v2 run, recorded with that reading, and never changed. The value is on the [changelog](/changelog). So a v2 reading is 0.5 × demand + 0.2 × supply + 0.3 × culture + the link amount, rounded to a whole number.

**Anomaly guard.** A reading more than three standard deviations from that source's most recent stored readings (up to eight) is rejected before it is stored.

**Completeness.** Every reading publishes `dataCompleteness`, the weighted share of tracked inputs that arrived. It is a coverage measure, not accuracy.

## What is held out, and why

Five series never enter the score, so they can test it. Two are collected daily alongside the inputs: BLS JOLTS openings in professional and business services, and SEC 8-K filings announcing interim chief financial and chief executive officers. Three are read from the agencies' public files when a test runs: Indeed Hiring Lab job postings for Accounting, Marketing, Software Development and Management; FRED initial jobless claims; and Census weekly business applications. A test that feeds the thing it tests is not a test.

## Validation

As of 23 October 2026 the FWI is **not validated** against any held-out measure. The tests, each reported with its n:

| Test | Result | n | 95% CI |
|---|---|---|---|
| Weekly change in demand vs Indeed postings (pre-registered, single test) | r = -0.53, the opposite sign to the hypothesis | 18 weeks | -0.80 to -0.09 |
| Overall FWI vs Census high-propensity business applications, year over year, same week | r = -0.04 | 18 weeks | -0.50 to 0.43 |
| Weekly change in overall FWI vs initial jobless claims, same week | r = 0.65, found by scanning 288 correlations, not claimed | 19 weeks | 0.28 to 0.85 |

The pre-registered Indeed test failed. The jobless-claims result came from a scan and is being retested on new weeks only, from 10 October 2026. These results describe the index as published before the 26 October seam, and the tests are rerun on the v2 series as its weeks accumulate. The scripts that produce them are public in the repository (`scripts/validate-anchor-indeed.mjs`, `scripts/validate-anchor-weekly.mjs`).

## Limits

- **US only.** The demand and supply inputs are US-scoped. English-language news includes UK material but there is no UK reading.
- **Proxies, not engagements.** No input counts actual fractional engagements. Job postings that name a fractional role, profile counts and business formation are signals around the market, not the market itself.
- **Few inputs.** From the seam the composite has nine inputs, all of which move. Before it, the evidence was measured at 4.4 effective independent inputs of 20 tracked, because eight of them never moved. The rebuild plan adds inputs only through dated seams, each with its measured impact.
- **The culture pillar is thin.** NewsAPI counts are 10 to 25 articles a month, Hacker News is 3 to 6 stories, and Wikipedia sits at 98 to 99 of 100 and includes an article on fractional ownership, which is not fractional leadership. Correcting that page list is on the rebuild plan.
- **The supply official series are broad.** They describe professional-services business formation and incorporated self-employment, not fractional executives specifically.
- **History is mixed.** Thirty-eight days in June 2026 carry a supply value labelled `simulated_estimate` in the history API, and older days have no measured supply. Those labels travel with every export.

## Where the code is

The method runs in `supabase/functions/calculate-fwi` (v2 in `v2.ts`, shared arithmetic in `supabase/functions/_shared/fwi-method.ts`) and the inputs are collected by `supabase/functions/ingest-signals`. The measured impact of the 26 October seam is reproducible with `node scripts/seam-v2-preview.mjs`.
