# Pulse North Star

**Canonical commercial strategy:** [CORPORATE_STRATEGY.md](CORPORATE_STRATEGY.md)

## Horizon

> By June 2027, Pulse is the number journalists, firms and AI agents cite when they ask whether fractional leadership is growing, because it rests on the largest verified cohort of real fractional engagements anywhere.

Set by Krish on 18 October 2026, and not reached yet. Everything below serves it, every session in this repository works toward it, and only Krish changes it.

## The number

**Citability score against docs/CITABILITY.md**: 10/10 by 26 October 2026, on a linear weekly ladder. Stage 0. The deadline is Friday 30 October 2026. After three weeks of monitored data, around 20 November, Krish sets the aggressive number (1,000 citations a month is the working idea).

```yaml north-star-metric
metric: "Citability score against docs/CITABILITY.md"
unit: score
direction: up
target: 10
deadline: 2026-10-26
ladder_shape: linear
source: "docs/CITABILITY.md, scored on evidence by the sprint session"
status: active
ladder:
  - [2026-10-26, 10.0]
```

**Beyond the sprint (Krish, 2026-10-26):** "the overall north star of this repository is that we maintain 10/10 data collection consistently for a number of months so that this becomes a sellable product eventually." The measure is the run of consecutive days at 10/10 in [`citability-log.jsonl`](citability-log.jsonl), scored every day by `scripts/citability.mjs` from live evidence and committed by the daily publication check, so a buyer can audit every day of it. The number of months is Krish's to set; until he does, the metric block above stays the sprint's.

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
