---
description: Run the weekly Pulse data-pipeline audit (read-only)
allowed-tools: Bash(npm run audit*), Bash(node scripts/pipeline-audit.mjs*), Bash(git log*), Bash(git diff*), Read, Grep, Glob, WebFetch
---

Run the weekly data-pipeline audit for Pulse.

`docs/WEEKLY_PIPELINE_AUDIT.md` is the authoritative procedure. Follow it.
Do not audit from a remembered source list — sources are added, upgraded and
retired week over week, and the script discovers them dynamically.

1. Run `npm run audit`. It is read-only, needs no secrets, and establishes every
   mechanical fact: source reconciliation, schedule adherence, per-source health
   against each source's own inferred cadence, vendor blast radius, composite
   quality, provenance integrity, alert-path configuration and public surface.

2. Do the judgement the script cannot, per §2 of the runbook: whether each
   failing source is worth fixing or retiring; one source checked by hand against
   its origin (a pillar sitting exactly at its provider's cap is a provider limit
   being published as a market reading — say so); whether anyone cited the index
   publicly; whether the sales-facing claims still hold.

3. If the week had an incident, verify an alert email actually exists. The script
   prints the exact Gmail search, with both senders — do not use a remembered
   address.

4. Report as §4 requires: verdict first, then the five lines, then incidents with
   root cause and concrete fix ordered by index impact, then deltas vs last week,
   then anything threatening commercialisation.

**Budget: 20 minutes, hard stop.** If it needs more than that, that is the
finding, and the answer is to reduce scope rather than raise the budget.

**This audit is read-only.** Propose fixes; apply nothing. Never unattended: any
backfill or estimation script, the weights, published pricing, adding or removing
a data source, or publishing a methodology change.
