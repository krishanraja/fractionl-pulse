---
title: Fractional Working Index changelog
slug: changelog
description: Every change to what the Fractional Working Index means, with its effective date and measured impact. Published readings are not restated.
dateModified: 2026-10-23
---
Every change to what the Fractional Working Index measures or how it is computed is listed here with its effective date and, where it was measured, its impact. The rule since 23 October 2026: **a change takes effect from a dated seam and never restates a published reading.** Two entries from June 2026, below, predate that rule and did change published history; they are disclosed rather than hidden. Method: [how the index is made](/methodology). Corrections: [hello@krishraja.com](mailto:hello@krishraja.com).

## 26 October 2026: method v2 (the seam)

**Effective from the reading of 26 October 2026. Readings before it are unchanged.** Ruled by Krish Raja on 23 October 2026.

- **Nine inputs retired** because their values never moved: four Brave-derived inputs (news, web mentions, Reddit, LinkedIn talent) stored the page size their collector requested (20), not a count; The Guardian and Mediastack stored 0 every day; Podchaser and GoFractional sat at the normalizer's ceiling of 100; Google Trends search interest sat at the normalizer's floor of 5 from 14 August 2026.
- **Two official supply series added:** Census business applications in professional services (NAICS 54) and BLS incorporated self-employed.
- **Two culture inputs replaced and one rescored**, each after a repair was tried, collected as a trial from 23 October 2026 with 60 days rebuilt from its own dated archive, and passed the entry gate: Wikipedia now reads the interim management and fractional executive articles, dropping the article on fractional ownership and the general executive-role articles that held it at 98 to 99 of 100; Hacker News now counts stories and comments naming fractional and interim executive roles, not 3 to 6 stories mentioning the word; Google Trends search interest, which was retired above for sitting at its floor, returns scored against its own trailing 28 days, so it can move. The composite has ten inputs.
- **One vote per source**, instead of one vote per stored row.
- **A missing source holds its last vote for up to 7 days**; the LinkedIn profile count votes its 14-day median.
- **Whole numbers with a band** replace one decimal place.
- **Chain-linked:** a fixed amount, measured once at the first v2 run over the 28 published days before the seam, is added to every v2 reading so the series is continuous. Measured in a preview on 23 October 2026 over 26 September to 23 October, with the ten inputs above: **-9.0 points**; on that day the published 48 would have read **49 (45 to 53)** under v2. {{seam_link}}
- **Day-to-day movement:** the standard deviation of the daily change over the 28 preview days falls from 3.6 to 2.1 points, because a source failing for a day no longer moves the pillar.
- The LinkedIn ratio guard written on 13 October 2026 switches on with v2; it had not been deployed before.
- **The anomaly guard holds, then confirms**, instead of rejecting outright. Under v1 a rejected reading was never stored, so a real level change kept being compared with the old level: NewsAPI's genuine fall on 13 October 2026 was rejected for nine days, until 21 October.

## 23 October 2026: correction to "effective independent inputs"

The figure "10.7 effective independent inputs of 20 tracked", published from 21 September 2026, was a measurement error: the calculation counted an input that never moves as perfectly independent. Measured correctly, the figure was **4.4**. No reading changed; the statement did.

## 21 September 2026: supply-intent search terms retired

Four Google Trends supply-intent terms sat at the reporting floor. Over the 113 days from 1 June 2026 they contributed on 56 and pulled the supply pillar from 65.13 to 59.71 on those days, **-1.08 on the headline**. Removed from the reading of 21 September 2026; earlier readings unchanged. Absent trend readings stopped being counted as zero from the same date.

## 11 August 2026: provider change for search-derived inputs

Search, jobs and LinkedIn-profile inputs moved from SerpAPI to DataForSEO after one exhausted account took out four inputs on 4 August 2026. Input names were kept for continuity. Impact not measured.

## 5 June 2026: simulated supply on 38 historical days (restated history)

On 38 days before measured supply existed, a supply value was estimated and the overall reading recomputed with it. Each of those days carries `supply: simulated_estimate` in the history API, and the original overall reading is preserved in the row's metadata. This changed published readings.

## 2 June 2026: placeholder values removed (restated history)

The pipeline had been writing placeholder values (supply 0, 10 or 50; culture 50) when an input was missing. 114 supply and 40 culture placeholders were set to null and the affected overall readings recomputed, with the originals preserved in metadata and a backup table. From the same date a missing pillar is reported as unmeasured and its weight redistributed. This changed published readings.

## 30 May 2026: dead inputs retired

Four inputs that had failed on every run for weeks were removed: an Apify Google Trends actor, an Apify supply-trends actor, People Data Labs and the New York Times. Readings from that date on. Impact not measured.
