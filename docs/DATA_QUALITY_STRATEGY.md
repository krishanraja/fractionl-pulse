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

**Restatement rule, and it is absolute.** No change made under this strategy
restates published history. A methodology change gets an effective date and a
recorded before/after impact. The series is allowed to have a seam; it is not
allowed to have a rewrite.

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
