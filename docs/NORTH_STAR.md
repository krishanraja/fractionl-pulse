# Pulse North Star

**Canonical commercial strategy:** [CORPORATE_STRATEGY.md](CORPORATE_STRATEGY.md)

## Horizon

> By June 2027, Pulse is the number journalists, firms and AI agents cite when they ask whether fractional leadership is growing, because it rests on the largest verified cohort of real fractional engagements anywhere.

Set by Krish on 18 October 2026, and not reached yet. Everything below serves it, every session in this repository works toward it, and only Krish changes it.

## The number

**Consecutive days at 10/10 citability**, scored every day from live evidence by `scripts/citability.mjs` against [CITABILITY.md](CITABILITY.md) and recorded in [`citability-log.jsonl`](citability-log.jsonl). Target: **30 days in a row**, set by Krish on 26 October 2026 ("one month for now and then let's move from there"). The goal behind it, in his words: "maintain 10/10 data collection consistently for a number of months so that this becomes a sellable product eventually."

The streak cannot start before 17 November 2026, when the last of three inputs clears the delivery bar (if none misses again), so the earliest the target can be met is 16 December 2026. Any day below 10 resets it to zero. When it is met, Krish sets the next length.

```yaml north-star-metric
metric: "Consecutive days at 10/10 citability (docs/citability-log.jsonl)"
unit: days
direction: up
target: 30
deadline: 2026-12-16
ladder_shape: linear
source: "docs/citability-log.jsonl, written daily by scripts/citability.mjs in .github/workflows/publication-check.yml"
status: active
ladder:
  - [2026-11-17, 1]
  - [2026-11-24, 8]
  - [2026-12-01, 15]
  - [2026-12-08, 22]
  - [2026-12-16, 30]
```

**Stage 0, the sprint (23 to 30 October 2026):** the citability score itself, 10/10 targeted by Friday 30 October; Krish kept the bar at 9.5 for Friday (2026-10-23), and it read 9.5 on 26 October. That score is now the input to the streak above.

Urgency (U1 to U5) is worked out every week from where the number stands against that week's target, by [the harness contract](https://github.com/krishanraja/ai-harness/blob/main/contract/north-star-metric.md). Set by Krish on 23 October 2026.

## The user outcome

A reader can tell, in under one minute, whether fractional leadership demand is expanding or contracting, which C-suite roles are moving, and how complete the evidence is.

Fractional executives, companies considering a fractional hire, researchers, and AI agents receive this public read for free. No consumer Pro plan and no generic API paywall.

## The buyer outcome

A specialist fractional-talent firm can distinguish its own pipeline performance from market movement and benchmark pricing, fill speed, duration, and outcomes against a privacy-safe cohort.

That buyer outcome is not live yet. It depends on verified first-party engagement data from multiple independent partners.

## The moat metric

**Verified partner-contributed engagements in the trailing 12 months that pass schema, provenance, privacy, and quality checks and belong to a publishable cohort.**

No cohort is publishable unless it meets the agreed minimum record count and includes at least three independent organisations.

## Current product and paid hypothesis

- **Live:** Free public index, components, mixed-frequency history, six US-scoped role-demand pages, Ask the Index, weekly brief, REST API, MCP tools, sources and methods, optional accounts, and free API-key management.
- **Validation offer:** £1,500 for a 90-day Founding Benchmark Partner pilot, maximum ten firms.
- **Conditional annual offer:** £6,000 per year only after ten active partners and 500 verified engagements.
- **Conditional enterprise offer:** From £15,000 per year only after 1,500 verified engagements and sufficient cohort coverage.

Paid prices are hypotheses until real customers pay. The free API is a distribution surface. The paid value is a proprietary cohort benchmark and associated service level.

## Explicit non-goals

Pulse is not for adtech or publishers. It is not a job marketplace, career coach, official index, personal rate adviser, or generic staffing data feed. Individual fractional executives are the free audience, not the primary economic buyer.

Pulse does not yet publish a UK market benchmark, role-level executive availability, partner engagement-data ingestion, a partner cohort dashboard, automated partner billing, or a generally available paid benchmark.

## Near-term validation gate

By 31 October 2026, target 25 qualified conversations, ten signed data-sharing letters of intent, five paid pilots, and a credible path to 500 verified trailing-12-month engagement records. If those conditions fail, reposition or stop the paid benchmark before building more infrastructure.
