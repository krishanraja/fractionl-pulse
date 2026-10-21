---
title: How reliable is the Fractional Working Index?
slug: how-reliable-is-the-fractional-working-index
description: What backs a Fractional Working Index reading: completeness, source health, how independent its 20 inputs are, its guards, and what has not been validated.
answer: Treat it as a transparent, directional instrument rather than an official statistic. Every reading publishes its data completeness and per-source health, a September 2026 measurement found its 20 tracked inputs worth 10.7 independent ones, and simulated history is labelled. It has not yet been validated against official statistics and makes no forecasting claim.
datePublished: 2026-10-21
dateModified: 2026-10-21
related: what-is-the-fractional-working-index, how-to-cite-the-fractional-working-index, is-fractional-leadership-growing-2026
keywords: Fractional Working Index methodology, FWI reliability, data completeness, fractional market data quality
---
## What you can check on every reading

- **Data completeness.** Each tracked input carries a quality-and-uniqueness weight. Completeness is the share of that total weight that actually arrived for the reading, published as `meta.dataCompleteness` with a note saying it is not a prediction-accuracy metric. A reading built on half the evidence says so.
- **Per-source health.** The dashboard's sources and methods view publishes the health of each input next to the number rather than in a footnote.
- **Provenance in history.** Rows returned by `GET /fwi-api/history` carry a data-quality field. Thirty-eight days of early supply history are labelled as a simulated estimate rather than passed off as measured.

## How independent are the 20 inputs?

Twenty tracked inputs are not twenty independent signals: several news and search series can move together. Pulse measures this rather than assuming it. Its quality programme computes the **effective number of independent inputs** from the correlation matrix of the inputs (the participation ratio of its eigenvalues, where 20 fully independent inputs score 20 and 20 identical ones score 1).

The first measurement, on 21 September 2026 across 113 days and the 16 sources with enough overlapping data, came to **10.7 effective inputs of 20 tracked**, and no pair of inputs correlated at 0.8 or above. The working hypothesis written down beforehand was about five. The measurement disproved it, and the record keeps the wrong guess rather than editing it out.

## Guards against bad data

- **Anomaly guard.** A new reading more than three standard deviations from its own eight-week history is rejected rather than written into the index.
- **Ratio guard on volatile counts.** A supply proxy built on a search engine's estimated result count can swing between about 50 and over 40,000 for the same role. A guard added to the pipeline code in October 2026 treats a reading more than ten times away from its own 14-day median as missing rather than publishing it as a collapse in supply. Earlier history is not restated.
- **Health from persisted rows.** Since September 2026 a source counts as healthy only when its readings were actually stored, not merely because the collector reported success.
- **Retiring inputs that add nothing.** In September 2026 a supply input whose search terms sat at a reporting floor, and so measured no real variation, was retired and its weight redistributed within its pillar.

## What has not been established

- **External validation.** The index has not yet been validated against an official measure of the demand it tracks. Official series (BLS job openings for professional and business services, FRED initial jobless claims and Census self-employment) are collected outside the composite precisely so it can be tested against them. Early tests are too short to support a claim either way, and none is made.
- **An error band.** Completeness says how much evidence arrived, not how far the number could have moved with a different subset. Treat small moves with care.
- **Forecasting.** It has not been backtested and makes no predictive-accuracy claim. SEC Form D filings are included as financing context, not as a validated leading indicator.

## How to use it responsibly

Quote the band and the as-of date alongside the number, mention completeness when it is low, prefer the 30-day direction over day-to-day changes, and say what the index cannot see: referral-only work, roles beyond the six tracked, and markets outside the US.

## Sources

- [Data quality and evolution strategy](https://github.com/krishanraja/fractionl-pulse/blob/main/docs/DATA_QUALITY_STRATEGY.md)
- [Technical specification: composite, completeness and anomaly guard](https://github.com/krishanraja/fractionl-pulse/blob/main/docs/TECHNICAL_SPEC.md)
- [Fractional Working Index, current reading (JSON, no key)](https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current)
- [Pulse machine-readable product truth](https://pulse.fractionl.ai/product-truth.json)

## Frequently asked questions

### Is the Fractional Working Index an official statistic?

No. It is a private composite published by Fractionl. It is not an official, institutional or government index.

### Has the index been validated?

Not yet. Official labour series are collected outside the composite so that it can be tested against them, but the history is still too short for a claim, and Pulse does not make one.

### What does a low completeness figure mean?

That a smaller share of the weighted evidence base arrived for that reading. The number is still published, with the completeness beside it, so a reader can decide how much weight to put on it.

### Why publish its weaknesses?

Because an instrument people cite has to show how much evidence is behind each reading. A count of inputs says nothing about how much information they carry; measuring and publishing it does.
