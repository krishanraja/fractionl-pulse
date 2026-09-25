# Data Quality & Evolution Strategy

**Status:** Active. **Owner:** Krish. **Adopted:** 2026-09-21.
**Companion:** `docs/WEEKLY_PIPELINE_AUDIT.md` (is it working) — this file is
*is it getting better*. The two are deliberately separate; see §6.

---

## The premise

Pulse currently answers "how many inputs does it have" with a count. That was
the right claim at twenty sources built by one person. It is the wrong claim for
an instrument a data business is meant to respect, because a count says nothing
about how much *information* is in it.

Three things are true of the pipeline today and none of them are visible in the
count:

1. **Nothing validates the index against reality.** Twenty inputs feed a
   composite that has never been checked against an external measure of the
   thing it claims to track. A buyer's data team will ask this first, and the
   honest answer right now is "we don't know".
2. **The inputs are not independent, and the repo already knows it** — every
   surface carries the "inputs are not all statistically independent" caveat.
   Four news APIs and four search-derived series are not eight signals. Nobody
   has measured how many they actually are.
3. **The number has no error band.** Completeness says how much of the evidence
   base arrived. It does not say how much the answer would have moved if a
   different subset had arrived, which is the question a reader actually has.

The retirement of `serpapi_supply_trends` on 2026-09-21 is the proof case. It
was not broken. It ran, reported success, and measured something with no
variance — a search-volume floor — for months, and moved the headline by −1.08
on half of all days. A count-based view could never have caught it. A
contribution-based view catches it in week one.

**So the strategy is: stop counting sources, start measuring information.**
Everything below is free or near-free, because the constraint is real and
because a quality programme that needs budget approval is a quality programme
that does not happen.

---

## 1. Validation: anchor the index to official statistics

The highest-value thing available, and it costs nothing, because the data is
already being collected.

`bls`, `fred` and `census_acs` are currently **context** inputs — collected,
excluded from the composite. That is the correct treatment for the composite and
the wrong treatment for the programme. Promoted to a **validation set** rather
than an input, they answer the question the composite cannot ask of itself.

The method:

- Hold the official series out of the composite permanently. A validation set
  that feeds the thing it validates is not a validation set.
- Each week, compute the correlation between the FWI (and each pillar) and each
  official series at lags 0 to 12 weeks. Official statistics are slow; if the
  FWI leads them, that is the claim worth having, and if it tracks nothing, that
  is worth knowing before a partner discovers it.
- Report the coefficient, the lag, the sample size and the confidence interval.
  Never report a correlation without its n — at 15 weekly observations almost
  anything looks significant.

Candidate anchors, all free APIs, in order of how directly they measure the
phenomenon:

| Anchor | Why it is the right anchor | Status |
|---|---|---|
| BLS JOLTS job openings, professional & business services | Closest official measure of the demand the index claims to track | Verify availability |
| Census Business Formation Statistics, high-propensity applications | Fractional operators incorporate; formation velocity is the supply-side ground truth | Verify availability |
| FRED nonemployer / incorporated self-employed | The population fractional executives come from | Partly wired via `fred` |

**Success looks like:** a published, dated statement of the form "the FWI's
demand pillar leads BLS JOLTS professional-services openings by N weeks at
r = X, n = Y". That single sentence is worth more than five more inputs.

**Failure is also a result.** If the correlation is near zero, the index is
measuring conversation rather than market, and it should say so on the
methodology page rather than wait to be caught.

**First measurement, 2026-09-24** (`scripts/validate-anchor.mjs`, daily era
2026-06-01 to today, lag 0, one row per official release rather than one row
per day — see the script header for why a daily join would overstate n).

```
BLS JOLTS job openings (total nonfarm)        n = 5 releases
  r(FWI demand)   = -0.326   95% CI [-0.94, 0.78]
  r(FWI overall)  = -0.447   95% CI [-0.95, 0.72]

FRED initial jobless claims (ICSA)            n = 5 releases
  r(FWI demand)   =  0.312   95% CI [-0.79, 0.94]
  r(FWI culture)  = -0.902   95% CI [-0.99, -0.10]

Census ACS self-employment                    1 distinct value in 116 days
  skipped — zero variance across the daily era, not usable as an anchor
```

**The result is not a correlation, it is that the pipeline is too young to
validate yet, and that is worth knowing precisely rather than approximately.**
Every anchor except Census ACS produced *a* number, and every CI except one
spans nearly the full [-1, 1] range — at n = 4-5 independent releases that is
the correct CI, not a bug, and no coefficient here should be read as evidence
of anything. The one exception, FRED ICSA against the culture pillar
(r = -0.90, CI excludes zero), is flagged and explicitly not claimed: eight
pillar × anchor pairs were tested at n = 5, and one CI excluding zero by
chance alone is the expected outcome of that many comparisons, not a
discovery. It should be re-checked once FRED has more releases, not acted on.

**Census ACS fails the same test `serpapi_supply_trends` failed** for a
different reason: it collects successfully every day and carries zero
information, because ACS 5-year estimates update annually and the collector
has only ever seen the one 2023 value. It should not be treated as a
candidate anchor going forward; it may still be worth keeping as a slow
background context signal, but it cannot validate anything on the timescale
this programme runs on.

**What would unblock this, in order of speed:**
- FRED ICSA is the fastest path — it releases weekly and Pulse only started
  collecting it 2026-08-11 (5 releases so far). Continuing collection with no
  other change reaches n ≈ 12-15 (the point a CI stops spanning the full
  range) in roughly 7-10 more weeks, around late November 2026.
- BLS JOLTS releases monthly, so the same n ≈ 12-15 threshold is 12+ months
  away on the currently wired series regardless of how much BLS history is
  pulled — the FWI's own daily era, not BLS's, is the limiting length.
- **Done 2026-09-24:** the professional & business services series this
  section names as the better anchor is now collected. `JTS540099000000000JOL`
  is confirmed correct against the BLS series directory
  (`download.bls.gov/pub/time.series/jt/jt.series`): seasonally adjusted, job
  openings level, industry code `540099` = "Professional and business
  services" per `jt.industry`, covering 2000-M12 to 2026-M07 — the same
  coverage as the total nonfarm series. It is added to `ingest-signals`'
  `BLS_SERIES` rather than replacing total nonfarm, under its own category
  `job_openings_pbs`. Two reasons: the series sit at different levels
  (trailing-12 means 1,237 vs 7,106 thousand openings), so reusing the
  `job_openings` category would write a step change into the middle of the
  column this script correlates on and manufacture a spurious result; and
  both series ship in the one BLS request that already runs, so keeping the
  broader control costs nothing. Both stay `signal_type: 'context'`, so the
  composite, the weights and the published input count are unchanged.
  Its own n starts at zero: the first release lands at the next monthly
  JOLTS publication, so it reaches n ≈ 12-15 around late 2027. That is the
  cost of not having wired it sooner, and it is why it is wired now.

**Recommendation:** re-run `node scripts/validate-anchor.mjs` in this same
Thursday session once FRED ICSA crosses ~12 releases (~late November 2026);
until then, no anchor here supports a claim in either direction and none
should be published.

---

## 2. Independence: publish the effective number of inputs

A weekly correlation matrix across the twenty inputs, and from it a single
published number: the **effective number of independent inputs**.

Use the participation ratio of the correlation matrix's eigenvalues — for a
matrix with eigenvalues λᵢ, `(Σλᵢ)² / Σλᵢ²`. Twenty perfectly independent
inputs give 20. Twenty perfectly correlated inputs give 1. The real answer is
somewhere in between and is almost certainly closer to 5 than to 20.

Two reasons this is worth doing, and the second is the important one:

- **It makes the weight table honest.** If `newsapi`, `mediastack`,
  `brave_news` and `guardian` move together at r > 0.9, their combined 0.12
  weight is buying one signal at four times the price, and either three of them
  should go or the weights should reflect it.
- **It is a claim nobody else in this category makes.** "Twenty inputs" is a
  marketing number that every competitor can match by adding RSS feeds.
  "Twenty inputs, 6.2 effective" is an admission that reads as rigour, and it is
  the kind of thing the buyer's own data team cannot say about their own
  dashboards. Publishing your own weakest number is the strongest available
  credibility move, and it is free.

Cost: one query and about forty lines of maths, run weekly.
Built and running: `scripts/quality-metrics.mjs`.

**First measurement, 2026-09-21** (113 days, 16 sources with enough overlap):

```
Effective inputs   10.7 of 20 tracked (53.5% of the count)
No pair of inputs correlates at |r| >= 0.8
Most redundant:    serpapi_trends 0.45, serpapi_linkedin 0.40, sec_edgar 0.37
                   (mean |r| against every other input)
```

**This contradicted the hypothesis above and the hypothesis was wrong.** The
expectation written into the first draft of this file was that the four news
APIs would collapse into one signal and the effective count would be nearer 5
than 20. It is 10.7, and not one pair reaches the 0.8 redundancy threshold. The
inputs are substantially more independent than the count suggested they would
be. Recorded here rather than quietly edited out, because a strategy that only
keeps its correct predictions is not evidence of anything.

The claim to publish is therefore **"20 tracked inputs, 10.7 effective"** — and
it is a stronger claim than expected, which is the opposite of the usual reason
for publishing your own weakest number.

---

## 3. Error bars: say how much the answer could have moved

Completeness is a coverage number. It does not tell a reader how much the score
depends on which sources happened to arrive.

Bootstrap it. For each published day, resample the available sources with
replacement a few hundred times, recompute the composite each time, and publish
the interquartile range beside the score. Pure arithmetic over data already in
the table — no new collection, no provider, no cost.

What it buys: a day at completeness 0.90 where the present sources agree is a
tight band; a day at 0.90 where they disagree is a wide one. Those are different
days and the index currently reports them identically. It also gives the weekly
audit a far better degradation trigger than a completeness threshold — the
question stops being "did enough arrive" and becomes "did enough arrive to say
anything".

**First measurement, 2026-09-21** (`scripts/quality-metrics.mjs`, 500 draws/day,
seeded so a band never moves when nothing moved):

```
Latest 2026-09-21   median 52.4   IQR ±3.3   90% span 16.7 points
Last 28 days        mean IQR 7.0 points
Widest day          2026-09-12, 90% span 22.1 points
```

**This is the most actionable number in this document and it is a problem.** The
FWI is published to one decimal place. The resampling says that on a typical
recent day, the composite would have landed anywhere in a ~7-point interquartile
range on a different draw of the same day's sources. A tenth of a point is two
orders of magnitude finer than the evidence supports, and every surface — the
page title, the API, the RSS feed, the OG image — carries that false precision.

What it measures, precisely, so it is not over-read: the dispersion of the
composite under resampling *which of the day's arriving sources feed each
pillar*. It is not a confidence interval on the true state of the market, and it
should never be described as one. It answers "how much does today's number
depend on which sources happened to show up", which is a question the index
currently cannot answer at all.

The decision this forces, and it is Krish's: publish the band beside the score,
round the score to something the evidence supports, or both. The recommendation
is both — a whole number with a stated band is more credible than a decimal with
none, and "52 ± 3" survives scrutiny that "52.6" does not.

---

## 4. New inputs: hard signals, not more search

The next input should not be another way of counting the word "fractional" on
the internet. Judge every candidate on **marginal information**, not on whether
it is free and easy — the correlation matrix from §2 is the test, and a
candidate that correlates above 0.8 with an existing input is rejected however
cheap it is.

Ranked candidates, all free, all independent of search and news:

1. **SEC EDGAR full-text search on 8-K Item 5.02.** Item 5.02 is
   "Departure of Directors or Certain Officers; Election of Directors;
   Appointment of Certain Officers". It is a legally required filing that
   directly records executive transitions, including interim appointments. This
   is the single strongest free signal available to this index: a hard,
   audited, dated record of the exact event the index is about, with no search
   engine between the event and the measurement. The repo already talks to
   EDGAR for Form D, so the access pattern is known.
2. **Census Business Formation Statistics.** Weekly and free. Business
   applications with high propensity to become employers, which is the closest
   free proxy for fractional operators setting up.
3. **Companies House (UK) director appointments.** Free API, structured
   appointment and resignation records. Not for the current index — the US
   scoping is a deliberate claim — but it is the cheapest possible path to a
   second geography if that is ever wanted, and worth knowing the shape of.

**Shipped 2026-09-21: `sec_exec_transitions`, probationary.** Candidate 1,
implemented and collecting. SEC full-text search over 8-K filings, free, no key,
no provider account. Verified volumes over the 90 days to 2026-09-21:
"interim chief financial officer" 381 filings, "interim chief executive officer"
337.

Two terms only, and the restraint is the entire lesson from
`serpapi_supply_trends`. The obvious extensions all sit at the reporting floor
and were rejected on the spot for exactly the reason the retired source was
retired: "interim chief operating officer" 4, "interim chief technology officer"
4, "fractional chief financial officer" 7, "fractional chief marketing officer"
0, "interim chief marketing officer" 0. A term that cannot move is not evidence,
however relevant it sounds. Adding all seven would have rebuilt the exact defect
this programme exists to prevent, on day one.

It is **probationary**: collected and stored, zero weight, excluded from the
composite and from the published input count, declared in `PROBATIONARY_SOURCES`
in `ingest-signals` and understood by the weekly audit. It earns weight from a
measured result under §5 or it is dropped. A candidate source that silently
starts moving the published number before anything has validated it is how an
index loses the right to be called one.

Explicitly rejected: anything requiring a scraper against a site whose terms
forbid it, and anything that is a fourth news API. The first is a legal risk for
a published instrument and the second adds cost without adding information.

---

## 5. The ratchet: how it actually improves

A strategy document that is read once is worth nothing. This one is enforced by
a weekly session that must produce exactly one of four outcomes:

1. **A validation result.** One anchor, one correlation, with its lag and n.
2. **A promotion.** One candidate source evaluated against the correlation
   matrix and either wired up or rejected, with the number that decided it.
3. **A retirement proposal.** Any input whose correlation-adjusted marginal
   contribution has been below the floor for four consecutive weeks. This is the
   systematic version of what happened to `serpapi_supply_trends` by accident.
4. **A quality primitive.** One of §2 or §3 built and running.

One per week. Not a backlog, not a list — a list is how this dies. If a week
produces none of the four, the reason is the finding and it goes in the report.

**The floor rule.** An input earns its place by moving the answer. An input that
correlates above 0.8 with a cheaper input, or whose removal changes the
composite by less than the published error band, is not evidence — it is
decoration with a running cost. Four consecutive weeks below the floor and it is
proposed for retirement, with the measured impact stated, the way §2 of
`DATA_SOURCES_ROADMAP.md` now states it for `serpapi_supply_trends`.

**Built 2026-09-25** (`scripts/quality-metrics.mjs`, outcome 4 — a quality
primitive): the floor rule as written names a specific number, "the composite
changes by less than the published error band" if a source is removed, and
nothing computed that number. §2 measured redundancy (mean |r| against other
inputs) and §3 measured the band, but redundancy is a proxy for the floor
rule, not the test itself — a source can correlate with nothing and still
move the composite by less than noise. The script now does the literal test:
for every day a source contributed, it recomputes the composite with that
source's rows pulled from its pillar and records the swing, then compares the
mean swing to the 28-day mean IQR band from §3.

**First read, 2026-09-25**, 117 days, 16 composite-eligible sources:

```
Band (28-day mean IQR)                              6.79 points
Every one of 16 sources reads below it, range 0.30 (newsapi) to 5.40 (serpapi_linkedin)
```

**This is a result, not a bug, and it changes what the floor rule can mean in
practice.** Every pillar but supply carries several sources, so one source's
share of a pillar's mean is diluted by the others in it, while the band is
resampled across all three pillars at once — noise that accumulates across
the whole composite against a swing that is confined to one pillar. Applying
the rule exactly as written, every source in a multi-source pillar will
structurally under-run a composite-wide band, four weeks running, regardless
of whether it is redundant. Read literally, the rule would propose most of
the index for retirement at once, which cannot be the intent — §5 exists to
retire one input at a time on a measured case, not to empty the pillars.

**Decision needed, not yet Krish's call:** compare a source's swing to a
band scoped to its own pillar (recomputed the same way, resampling only that
pillar) rather than the whole-composite band, or keep the composite-wide
band but raise or lower the bar it is compared to. No source is proposed for
retirement from this first read either way — one week is one week, and §5
requires four consecutive reads under whichever floor is adopted. The number
above is recorded so the four-week clock, once it starts, starts from a
comparison that has been thought through rather than the first one that ran.

---

## 6. Why this is separate from the weekly audit

`docs/WEEKLY_PIPELINE_AUDIT.md` asks whether the pipeline is working. This asks
whether it is getting better. They are run as separate sessions on separate days
for one reason: when they share a session, the broken thing always wins. A
failing collector is concrete and urgent, and building a correlation matrix is
neither, so the correlation matrix never gets built. Monday is integrity.
Thursday is evolution. A red pipeline on Thursday defers the evolution work to
the next week rather than consuming it.

Both sessions are read-only against production. Everything here is a proposal
until Krish decides, because every item in §1 to §4 changes what the published
number means, and that is his call and not an agent's.
