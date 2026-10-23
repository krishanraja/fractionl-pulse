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

## Current score: 7 / 10 (2026-10-23, after the day's fixes)

| # | Now | Evidence a stranger can check | What moves it |
|---|---|---|---|
| 1 Fresh | 1 | `/fwi-api/current` `meta.asOf` is today | |
| 2 Inputs moving | 0 | Today's published reading still includes the nine constant inputs | First v2 reading, 2026-10-26: `contributors` lists nine moving inputs |
| 3 Construction | 0 | v2 (one vote per source, carry-forward) is deployed (`calculate-fwi` v53) but publishes from 2026-10-26 | Same |
| 4 Precision and band | 0 | Today's reading has no band | 2026-10-26: `score.band`, page title and app show `NN (low to high)` |
| 5 Sources per number | 1 | `/fwi-api/current` `contributors`, each marked scored or held out | |
| 6 Validation with n | 1 | `/methodology#validation`, `product-truth.json` `methodology.external_validation` | |
| 7 Methodology page | 1 | `https://pulse.fractionl.ai/methodology`, server-rendered, own title | |
| 8 Changelog | 1 | `https://pulse.fractionl.ai/changelog`; the 2026-10-26 entry gets its fixed link amount at the first v2 run | |
| 9 Citation and machine access | 1 | `meta.citation`, `llms.txt`, MCP, `/fwi-api/history` | |
| 10 Owner and contact | 1 | Krish Raja and `hello@krishraja.com` on `/methodology`, the API (`meta.owner`), `llms.txt` and `product-truth.json`; it is Krish's standing public address. `npm run smoke:release` fails if a page points at a dead `fractionl.ai` mailbox | |

Expected on 2026-10-26 once the first v2 reading is read back: 10.

## First score on 2026-10-23: 3.5 / 10

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
6. **Named owner:** Krish Raja, corrections to `data@fractionl.ai`. Superseded the same day: Krish shut down the fractionl.ai Google Workspace, so that address no longer receives; every inbound contact moved to `hello@krishraja.com`, his standing address for public-facing work.
7. **`sec_exec_transitions` leaves probation as a permanent held-out anchor**, backfilled from EDGAR full-text search, never fed into the composite.
8. **Retire `serpapi_trends` at the same seam** (later the same day). The audit gate added in this sprint found its vote fixed at the normalizer floor of 5 since 2026-08-14. Krish's condition: a plan to rebuild the evidence base, below.
9. **Deploy now; apply the health-row migration (`021`) after the first v2 run.**

## Rebuild plan: adding information back, one dated seam at a time

Krish's concern on 2026-10-23, in his words: "I am worried we are now gutting the data and without a plan to make any improvements." This is the plan.

**What the retirement removes, measured.** The nine retired inputs carried no information: their values never moved, so removing them changes the effective number of independent inputs by zero (4.4 before, measured by `node scripts/quality-metrics.mjs` with constants excluded). What they did was set the composite's level and fake its breadth. The seam adds two official supply series that move, so the evidence base after 2026-10-26 is larger in information than before it, while smaller in count: 9 composite inputs that all move, against 16 of which 7 moved.

**The entry gate, for every new input.** A candidate joins the composite only when it passes all six, and only at a dated Monday seam, chain-linked so the series stays continuous:

1. **Dated provenance:** 28 days collected, or backfilled from a public record that carries its own dates. Never estimated.
2. **It moves:** it passes the audit's 28-day movement gate (`npm run audit`).
3. **It adds information:** |r| < 0.8 against every existing input on 7-day changes, measured by `npm run trial` (Ruling, Krish, 2026-10-23: two series that merely trend together correlate in levels without sharing information; the level r is still printed).
4. **It is not an anchor:** nothing held out for validation (Indeed postings, JOLTS professional services, FRED ICSA, Census BFS weekly, SEC 8-K interim appointments) ever enters the composite.
5. **Impact measured:** the before-and-after from `node scripts/seam-v2-preview.mjs` is written into the decision.
6. **Krish rules on it.** Then it lands on `/changelog` with its effective date.

**Candidates, in order of expected information per unit of cost.** All are free.

| Candidate | Pillar | What it adds | Backfill | Status, 2026-10-23 |
|---|---|---|---|---|
| Podchaser new podcasts per week (the retired collector, re-measured as a flow) | Culture | A count that moves: 25 to 59 new matching podcasts a week since June, against a stock total that sat at the normalizer ceiling | Yes, from the dated totals already stored in `signals` since 2026-06-01 | Measured from stored data; needs a guard for index glitches (-588 and +475 in two weeks of July) |
| GDELT news volume for the fractional terms | Culture | One honest, keyless news-volume series to replace the four constant news inputs | Yes, daily from 2017 in GDELT's own archive | Not verified: GDELT rate-limits this container's shared address; to test from the pipeline's address |
| Hacker News and Wikipedia, already collected, given more terms and pages | Culture | Breadth inside inputs that already move | Yes, both archives are dated | Ready to measure |
| Census Business Formation Statistics by state for NAICS 54 | Supply | Geography inside the new official supply series | Yes, monthly from 2004 | Same file as the 2026-10-26 series |
| Companies House officer appointments (UK) | Supply, UK | The first second-geography input; structured, dated appointment records | Yes | Free key needed; UK only, so a separate UK reading, not the US composite |
| Verified partner engagement records | All three | The only fractional-specific supply and demand data, and the moat in `docs/NORTH_STAR.md` | From each partner's own dated records | Depends on the partner programme in `docs/CORPORATE_STRATEGY.md` |

**The trial lane, built 2026-10-23** (Ruling, Krish, 2026-10-23). Candidates are collected by `supabase/functions/collect-trials` at 06:30 UTC daily and stored as `signal_type = 'candidate'`, which neither method reads, so a trial cannot move a published number. `npm run trial` checks each one against the gate above and measures its impact with the same method module the pipeline runs. First read, 2026-10-23, after a 60-day backfill from each trial's dated archive (Google Jobs cannot be backfilled):

| Trial | Days | Highest level r (gate) | On 7-day changes (information) | Impact, last 28 days | Gate |
|---|---|---|---|---|---|
| Podchaser new podcasts per week (added to culture) | 53 | 0.45 vs Census NAICS 54, n = 53 | 0.63 vs HN, n = 31 | +0.2 mean, max 0.9 | **Passes 1 to 5; ready for a ruling** |
| GDELT news volume (added to culture) | 23 | -0.36, n = 23 | -0.14, n = 12 | -0.3 mean, max 3.5 | Fails 1: GDELT's timeline has a gap from 14 Sep to 20 Oct, and it counts only 3 to 7 articles a week |
| Wikipedia, interim and fractional executive articles only (replacing the current list) | 60 | 0.81 vs NewsAPI, n = 51 | 0.34, n = 53 | -5.0 mean, max 7.5 | Fails 3 on levels |
| Hacker News stories and comments for the roles (replacing current HN) | 60 | 0.84 vs SEC Form D, n = 53 | 0.58, n = 40 | +1.4 mean, max 4.8 | Fails 3 on levels |
| Google Jobs at depth 100 (replacing depth 10) | 0 | | | | Collection starts with the 2026-10-24 05:00 UTC preparation |

The two level failures were shared trends rather than shared information: Hacker News mentions rose from 9 to 25 a month while Form D filings rose steadily. **Rulings (Krish, 2026-10-23):** check 3 is read on 7-day changes, which makes Wikipedia (0.34) and wider Hacker News (0.58) ready for a ruling too; GDELT is dropped from the lane (its 23 trial rows are kept as the record); and Podchaser-as-flow joins the culture pillar at a dated seam on **Monday 23 November 2026**, chain-linked, with its before-and-after measured at the 20 November review and published on the changelog.

**Repairs before retirement (Krish, 2026-10-23: "make sure you are not treating data sources as unfixable and instead just retiring them when there was a pretty simple fix at play").** The nine retirements were made on the evidence that each input never moved, without testing whether a simple repair would make it move. That was a gap in the process, now closed: every retired input was tested (`collect-trials ?diagnose=repairs`, the pipeline's own keys), and every one with a working repair is back in the trial lane. Today's readings:

| Retired input | Cause | Repair (trial) | 2026-10-23 |
|---|---|---|---|
| Google Trends | normalizer floored raw 2.6 to 5.3 at 5 | score raw on its own trailing 28 days (`trial_trends`) | 72; **passes 1 to 5**, backfilled 60 days |
| Guardian | exact phrases genuinely had 0 hits in 90 days | interim-executive wording plus "fractional" (`trial_guardian`) | 25 articles; **passes 1 to 5**, backfilled. Caveat: "fractional" also matches unrelated uses, to check before a ruling |
| Mediastack | the two-word keyword returned 0 | single keyword "fractional" (`trial_mediastack`) | 21 articles |
| Brave News | one page of 20 over a month, always full | past week, 50 per request (`trial_brave_news`) | 22, uncapped |
| Brave web | one page of 20, always full | past week per role term, paged (`trial_brave_web`) | 50, uncapped |
| Reddit via Brave | one page of 20, always full | past month per role term, paged (`trial_reddit`) | 9, uncapped |
| Podchaser | the total sat at the ceiling | weekly new podcasts (`trial_podchaser_flow`) | ruled in for 2026-11-23 |
| LinkedIn talent via Brave | page cap | none works: 0 under any time filter | stays retired; the DataForSEO LinkedIn count remains |
| GoFractional | a published marketing figure | none: not a measurement | stays retired |

The retirement at the 2026-10-26 seam stands, because each input still reads constant in its retired form. A repaired form returns only through the gate and a ruling. The rule going forward, added to the entry gate's spirit: **no input is retired as broken until a repair has been tried and has failed, with the test recorded.**

**Relevance check, 2026-10-23 (gate check 0, Ruling, Krish, 2026-10-23).** Krish asked for the Guardian's "fractional" matches to be checked. They were all unrelated, which showed the gate could pass an input that measures the wrong thing, so every text-match trial was sampled and the dated reviews are in `docs/trial-relevance.json`:

| Trial | Sample | Verdict |
|---|---|---|
| Guardian (repair) | 7 of 7 "fractional" matches unrelated (cricket, F1, fractional jet ownership); "interim CEO" matches name individual executives | **Dropped**; the original retirement was right |
| Mediastack (repair) | about 1 in 21 on topic; the keyword matches "fraction" | **Dropped**; the original retirement was right |
| Podchaser weekly flow (ruled in for 2026-11-23) | about 3 of the 50 newest matches on topic; the search is fuzzy | **Fails check 0.** Repair tried: a title-and-description filter keeps 46 of 46 relevant shows, but only 2 started in the last 90 days, so the count has sat at 2 since 2026-09-23 and fails check 2 |
| Brave web | 48 of 49 on topic, top site 18% | passes check 0 |
| Brave News | 22 of 22 on topic, one site 73% | passes by counting distinct sites |
| Hacker News (wide) | 15 of 15 on topic | passes; ready for a ruling |
| Reddit | 2 of 2 on topic | passes; small |

**Dates.** The first review is the 20 November checkpoint, after three weeks of v2 data. Podchaser-as-flow and GDELT are measured against the gate by then, and any that pass are put to Krish for a seam on **Monday 23 November 2026**. The state-level BFS cut and the broader Hacker News and Wikipedia terms follow at the next monthly seam, **Monday 21 December 2026**. Companies House and partner data are 2027 work, and their dates come from the partner programme, not from this file.

## Re-score log

| Date | Score | Commit | What moved |
|---|---|---|---|
| 2026-10-23 | 3.5 | `e4d5572` | First score. |
| 2026-10-23 | 6.5 | `1dd4d1e` | Live on production and read back: `/methodology` and `/changelog` (7, 8); validation with n on the methodology page, `llms.txt` and `product-truth.json` (6); `contributors` in `/fwi-api/current` lists the inputs that made the reading, held-out ones marked (5); owner named, corrections to `hello@krishraja.com` (10, half: the mailbox has not been shown to receive). Method v2 is deployed behind the 2026-10-26 seam but has not published a reading, so 2, 3 and 4 still score 0 on live evidence. `npm run smoke:release` 18/18. |
| 2026-10-23 | 7 | this commit | Point 10 to 1: `data@fractionl.ai` stopped receiving when Krish shut the fractionl.ai Workspace; every public contact now reads `hello@krishraja.com`. Migration `020` applied, so the audit reads the run log. |
