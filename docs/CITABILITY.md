# Citability: can a stranger quote the number and stand behind it?

**Owner:** Krish. **Adopted:** 2026-10-23. **Scored by:** the citability sprint, 2026-10-23 to 2026-10-30.
**This is the North Star number** (`docs/NORTH_STAR.md`): the score below, out of 10, target 10 by Friday 2026-10-30.

A journalist, a fractional-talent firm or an AI assistant should be able to quote the Fractional Working Index and defend the quote if challenged. This file is the test. Ten points, each scored **1** (passes on evidence a stranger could check), **0.5** (partly true, the gap named) or **0** (fails). A point scores on evidence, never on intent or on code that is not live.

How to re-score: run the commands in each row's evidence column against production, read the live site, and change the score only when the evidence changes. Record every re-score in the log at the bottom with the date and the commit.

## The ten points

| # | Point | A pass looks like |
|---|---|---|
| 1 | **Fresh** | A reading for today, no missing day in the last 30, the as-of date on every surface. |
| 2 | **Every input is collecting, continuous and moving** | Every weighted input delivered on at least 90% of the last 30 days, and every weighted input's normalized value moved at least once in the last 28 days. A reading that cannot move is not evidence. No probationary source older than 30 days without a decision. |
| 3 | **Built so a careful analyst accepts it** | The day-to-day movement reflects the market, not which sources happened to arrive. Each source's influence is the weight the methodology states, not an accident of how many rows it writes. |
| 4 | **Honest precision and a stated band** | The number is published at a precision the evidence supports, with its uncertainty band, on every surface that carries it. |
| 5 | **Sources visible per number** | For any reading, a reader can see which inputs actually contributed that day and how each was measured. |
| 6 | **External validation stated with its n** | A dated, published statement of how the index compares with at least one held-out official measure, with r, n and the CI, including when the answer is "no relationship". |
| 7 | **A methodology page people can quote** | One stable URL, server-rendered, that describes the method as the code runs it, with its limits. |
| 8 | **A changelog of methodology seams** | Every change to what the number means has an effective date and its measured before-and-after impact, at a public URL. History is never rewritten. |
| 9 | **Stable citation URL, suggested citation and machine access** | A permanent URL for a dated reading, suggested citation text, and an API, MCP and `llms.txt` an agent can read without a key. |
| 10 | **A named owner and a contact** | A named, accountable owner and a working contact address for corrections, on the methodology page. |

## Score on 2026-10-23: 3.5 / 10

Evidence was read on 2026-10-23 from production (`/fwi-api/current`, `/fwi-api/history`, the public `signals` table), the live site and the repository at `1e5ff2c`. Commands are in the evidence column so anyone can repeat them.

| # | Score | Evidence |
|---|---|---|
| 1 Fresh | **1** | `/fwi-api/current` returns `meta.asOf` 2026-10-23, score 48, completeness 0.94. `npm run audit`: 0 missing days in 30, history 279 days. |
| 2 Inputs collecting and moving | **0** | `node scripts/quality-metrics.mjs`: **8 of the 16 weighted composite inputs have not moved once since 2026-06-01.** Raw values from `signals`: `brave_news` 20 every day for 173 days, `brave_web` 20, `reddit` 60, `brave_talent` 20 per role, all of them the page size the collector requests (`count=20`), not a market count; `guardian` 0 for all 166 days it has existed; `mediastack` 0 every day since 2026-06-01; `podchaser` normalized at its 100 ceiling every day; `gofractional` a published marketing figure (15,000, then 19,000) normalized at 100, and down on 26 of the last 31 days (Apify). `serpapi_trends` raw moves between 2.6 and 5.3 but the normalizer floors it at 5 every day since 2026-08-14. `sec_exec_transitions` has been probationary since 2026-09-21 with no decision. Context input `census_acs` has one value in 145 days. |
| 3 Construction an analyst accepts | **0** | `node scripts/seam-impact.mjs`: the replica reproduces 144 of 145 published days within 0.15, so the following is how the live number is made. A pillar is the mean of signal **rows**, so `adzuna` (six role rows) outvotes `sec_edgar` (one) six to one, which no document states. When a source fails, the pillar jumps to the mean of whoever arrived: the supply pillar falls from about 60 to exactly 33.0 on days only `brave_talent`'s constant arrives (2026-10-01, 10-07, 10-08, 10-12), moving the headline by 5 to 7 points; the culture pillar read between 50.3 and 50.6 on every day from 2026-09-28 to 2026-10-12. Holding a missing source at its last value for up to 7 days halves the day-to-day standard deviation (3.6 to 1.8 points over the last 28 days), which means about half the published daily movement is source arrival, not market. |
| 4 Honest precision and band | **0** | Page title, prerendered HTML and history API publish one decimal (`48.0`, `50.3`). No band on any surface. Bootstrap over arriving sources: interquartile range ±3.0, 90% span 15.4 points on 2026-10-23 (`node scripts/quality-metrics.mjs`). |
| 5 Sources visible per number | **0.5** | `/fwi-api/current` lists each pillar's sources, but as a fixed list: it names GoFractional on a day GoFractional did not arrive. Per-source health is shown in the dashboard. The day's actual contributors exist only in `fwi_scores.metadata`, not in the public response. |
| 6 Validation with n | **0.5** | Measured and recorded in `docs/DATA_QUALITY_STRATEGY.md` §1 (rerun 2026-10-23, 20 weeks): Census BFS high-propensity applications r = -0.04, n = 18, CI [-0.50, 0.43]; FRED ICSA week-on-week change r = 0.65, n = 19, CI [0.28, 0.85], exploratory and not claimed. Nothing of this is published on the product; the answer page says only "not yet validated". |
| 7 Methodology page | **0** | `https://pulse.fractionl.ai/methodology` returns the home page (single-page fallback, title "Fractional Working Index: 48.0"), so there is no page to cite. The in-app "Sources and methods" drawer says "21 data inputs" (it is 20), lists a supply source retired on 2026-09-21, and lists the excluded context series (OpenAlex, FRED, BLS, Census) as inputs to the score. |
| 8 Changelog of seams | **0** | `https://pulse.fractionl.ai/changelog` returns the home page. The seams (2026-09-21 retirement, 2026-10-13 LinkedIn ratio guard) are recorded only in repository docs. |
| 9 Citation and machine access | **1** | Suggested citation is published (`/llms.txt`, Dataset JSON-LD `creditText`, `/answers/how-to-cite-the-fractional-working-index`); `/fwi-api/history` returns every dated reading without a key, so a dated reading is retrievable; MCP server and `llms.txt` answer 200. The gap that keeps this from being strong: the API lives on a Supabase hostname, not `pulse.fractionl.ai`. Scored 1 because every requirement in the row is met; the hostname is tracked as a follow-up. |
| 10 Named owner and contact | **0.5** | Publisher (Fractionl, Mindmaker LLC and Mindmaker Ltd) and `data@fractionl.ai` appear on the site. No named, accountable owner, and no correction route on a methodology page. Whether to name Krish is his decision. |

**Total: 1 + 0 + 0 + 0 + 0.5 + 0.5 + 0 + 0 + 1 + 0.5 = 3.5.**

### What this score corrects

Two figures published on the site and in `llms.txt` were measured wrongly, and this sprint found it:

- **"10.7 effective independent inputs of 20".** The script that produced it set the correlation of a constant input to 0, which the participation ratio reads as perfectly independent, so each constant input added about one to the count. Excluding the 8 constants, the measured figure on 2026-10-23 is **4.4** (145 days, 8 moving sources). The pre-registered hypothesis of "closer to 5 than to 20" in `docs/DATA_QUALITY_STRATEGY.md` §2 was right; the note that called it wrong was wrong.
- **"Every source swings less than the band"** (§5 floor rule). Constant inputs move the composite when removed because they set its level, not because they carry information; their leave-one-out swing measured level, not evidence.

## The order of work

Highest score gain first. Rows 7 to 10 are engineering and copy and can land without changing what the number means; rows 2 to 4 change what the number means and are Krish's decisions, prepared with measured impact (`node scripts/seam-impact.mjs`).

1. Methodology and changelog pages at stable URLs, accurate to the code (points 7, 8; +2). Publishing them is Krish's call.
2. The constant-input retirement, source-vote and missing-source rules, applied from one dated seam and chain-linked so the level does not jump (points 2, 3; +2).
3. A whole number with its band on every surface (point 4; +1).
4. The day's actual contributors in the public API (point 5; +0.5).
5. The validation statement, published with n (point 6; +0.5).
6. A named owner and correction route (point 10; +0.5).

## Rulings (Krish, 2026-10-23)

Every methodology decision this sprint needed, ruled in one batch. Each is applied from one dated seam, **effective 2026-10-26**; no published day before it is restated.

1. **Retire eight inputs from the composite:** `brave_news`, `brave_web`, `reddit`, `brave_talent`, `guardian`, `mediastack`, `podchaser`, `gofractional`. Measured reason in point 2 above.
2. **One vote per source, missing source carried forward.** Each source's rows are averaged to one value, then sources are averaged within the pillar; a source missing on a day holds its own last value for up to 7 days, then drops out.
3. **A supply strategy, not a suspension.** Krish rejected suspending the supply pillar ("we need a supply strategy; we don't just give up on stuff like that"). Supply from the seam: Census Business Formation Statistics applications in professional services (NAICS 54, monthly, seasonally adjusted), BLS incorporated self-employed (FRED `LNU02048984`, monthly), each normalized against its own trailing 36 months and holding its latest release until the next, plus the LinkedIn proxy as one vote on a 14-day median. The official series are backfilled from their release record as a separately labelled series, never written into published history.
4. **Chain-linked, whole number with a band.** A fixed additive offset, measured over the 28 published days before the seam, keeps the new series continuous with the old level; the offset and the before-and-after are published on the changelog. Every surface shows a whole number with its band.
5. **Publish** a server-rendered `/methodology` and `/changelog`, the validation result with its n, and the correction of "10.7 effective independent inputs" to the measured 4.4 on every surface.
6. **Named owner:** Krish Raja, corrections to `data@fractionl.ai`.
7. **`sec_exec_transitions` leaves probation as a permanent held-out anchor**, backfilled from EDGAR full-text search, never fed into the composite.

## Re-score log

| Date | Score | Commit | What moved |
|---|---|---|---|
| 2026-10-23 | 3.5 | this commit | First score. |
