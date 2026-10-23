---
title: How reliable is the Fractional Working Index?
slug: how-reliable-is-the-fractional-working-index
description: What backs a Fractional Working Index reading: its band, completeness, how much independent evidence it rests on, its guards, and its failed validation.
answer: Treat it as a transparent, directional instrument, not an official statistic. From 26 October 2026 every reading is a whole number with a band, built from ten inputs that all move. Its inputs measured 4.4 effective independent signals, and the index has not been validated: a pre-registered test against Indeed postings failed.
datePublished: 2026-10-21
dateModified: 2026-10-23
related: what-is-the-fractional-working-index, how-to-cite-the-fractional-working-index, is-fractional-leadership-growing-2026
keywords: Fractional Working Index methodology, FWI reliability, data completeness, fractional market data quality
---
## What you can check on every reading

- **Data completeness.** Each tracked input carries a quality-and-uniqueness weight. Completeness is the share of that total weight that actually arrived for the reading, published as `meta.dataCompleteness` with a note saying it is not a prediction-accuracy metric. A reading built on half the evidence says so.
- **Per-source health.** The dashboard's sources and methods view publishes the health of each input next to the number rather than in a footnote.
- **Provenance in history.** Rows returned by `GET /fwi-api/history` carry a data-quality field. Thirty-eight days of early supply history are labelled as a simulated estimate rather than passed off as measured.

## How much independent evidence is there?

Pulse measures this rather than assuming it, as the **effective number of independent inputs**: the participation ratio of the inputs' correlation matrix, where 20 fully independent inputs score 20 and 20 identical ones score 1.

The figure published from 21 September 2026, **10.7 effective inputs of 20 tracked**, was wrong. On 23 October 2026 the calculation was found to count an input whose value never moves as perfectly independent, and eight of the 20 inputs had not moved once since June: four stored a search provider's page size, two stored zero, two sat at the top of their scale. Measured correctly, the figure is **4.4**. The hypothesis written down before the first measurement, about five, was right.

The nine inputs that never moved, including a search-interest series stuck at its floor, were retired from the reading of 26 October 2026. Removing them changes the information in the index by nothing, because they carried none; it removes a false appearance of breadth. Two official supply series that do move were added at the same seam, two culture inputs were replaced by corrected versions, and the search-interest series returned scored against its own history, so it can move. Earlier readings are kept as published, and the [changelog](https://pulse.fractionl.ai/changelog) dates the change.

## Guards against bad data

- **Anomaly guard.** A new reading more than three standard deviations from its source's recent readings is rejected rather than written into the index.
- **One vote per source, missing sources carried.** From 26 October 2026 each source gets one vote in its pillar, and a source missing for a day holds its last vote for up to seven days, so a provider outage no longer moves the number.
- **Median on volatile counts.** A supply proxy built on a search engine's estimated result count can swing between about 50 and over 100,000 for the same role. From 26 October 2026 it votes the median of its last 14 days, and a reading more than ten times from that median is treated as missing.
- **Health from persisted rows.** Since September 2026 a source counts as healthy only when its readings were actually stored, not merely because the collector reported success.
- **Retiring inputs that add nothing.** In September 2026 a supply input whose search terms sat at a reporting floor, and so measured no real variation, was retired and its weight redistributed within its pillar.

## What has not been established

- **External validation.** The index is not validated. A single test written down before the data was pulled, weekly change in the demand pillar against Indeed's postings index for the matching functions, came out at r = -0.53 over 18 weeks, the opposite sign to the hypothesis. Against Census business applications the correlation is about zero (r = -0.04, n = 18). A positive link with weekly jobless claims (r = 0.65, n = 19) was found by scanning 288 correlations and is not claimed. Every test and its n are on the [methodology page](https://pulse.fractionl.ai/methodology).
- **What the band is and is not.** From 26 October 2026 the band beside each reading is the range the number lands in when its sources are resampled. It says how much the reading depends on which sources voted, not how far it is from the true state of the market.
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
