# Weekly Pipeline Audit — Runbook

**Repo:** `krishanraja/fractionl-pulse` · **Live:** `pulse.fractionl.ai` · **Supabase:** `dtlcprcpvdomrehbejhw`
**When:** Monday morning. **Budget: 20 minutes, hard stop.**

This is the authoritative, versioned procedure. Change this file to change what
the weekly audit does — the schedule just points here.

**This is a maintained asset, not a project.** If it starts needing more than
twenty minutes a week, that is the finding, and the answer is probably to reduce
its scope rather than increase the budget.

**Standing rule: read the body, not the status code.** A pipeline that reports
success while writing nothing has failed. A source marked `healthy` that has not
delivered in two of its own cadences has failed. An API that returns 200 with a
stale `asOf` has failed.

---

## How this runbook is structured

Everything mechanical — counting, reconciling, diffing against last week — is in
`scripts/pipeline-audit.mjs`. It is read-only, needs no secrets, and is the
authority on *what is true*. The runbook below is about *what to do with that*.

Do not re-derive the checks by hand. The three times that went wrong are exactly
why the script exists:

- The runbook used to say "count the estimated days". The flag actually written
  is `metadata.data_quality.supply = 'simulated_estimate'`, so anything looking
  for the word "estimated" returns zero and reports a clean bill of health while
  38 simulated days sit in the published history.
- It used to say to search Gmail for `alerts@fractionl.ai`. Since 22af761 the
  deliverable sender is `onboarding@resend.dev` to a different mailbox, so that
  search can never find an alert.
- Reconciling three source sets by hand is a dozen paginated queries before any
  thinking starts, which is most of the twenty minutes.

The script parses every threshold, weight, address and source list out of the
code that actually runs, so it cannot disagree with production.

## 1. Run it

```bash
npm run audit          # human report, verdict first
npm run audit:json     # same thing, machine-readable
```

Exit codes: `0` GREEN, `1` AMBER, `2` RED, `3` the audit itself could not run —
which is itself a finding, because nothing has confirmed the pipeline is healthy.

The script covers, without a fixed source list anywhere in it:

| Area | What it establishes |
|---|---|
| Source universe | Reconciles intended (`SOURCE_CONFIDENCE_WEIGHTS`) vs monitored (`data_source_health`) vs delivering (`signals`, 30d), and flags every asymmetry |
| Schedule | Every calendar day present in `signals`, newest write < 24h, `fwi_scores` row for today, no gap > 7d in history |
| Source health | Failures with `last_error` and days-since-success; **plus** sources marked healthy that are overdue against their own inferred cadence |
| Root cause | Groups failures by the credential that gates them, derived by reading the collectors — so five dead sources report as one vendor account with a blast radius in index-weight |
| Denominator hygiene | Sources weighted but silent > 14 days, quantified as the completeness tax they impose |
| Composite quality | Completeness vs the thresholds in `api/cron/daily-ingest.ts`, week-over-week trend, healthy-source floor |
| **Provenance** | Counts days carrying an invented value, diffs against `docs/audit-baseline.json`, and pulls a known estimated day through every public surface |
| Alert path | Reads the real sender and recipients out of `send-pipeline-alert`, and reports the exact Gmail search to run |
| Surface | Public API 200 + fresh `asOf` + completeness matching the DB; every sitemap URL resolves with its own title; pre-rendered number matches live data |

## 2. Judge what the script cannot

The script establishes facts. These need a person:

- **Is a failing source worth fixing, or should it be retired?** A source failing
  for a fortnight should be fixed or removed from the calculation, not left
  rotting in the denominator where it silently drags completeness. The script
  tells you what each one costs; the decision is yours.
- **Check one source by hand against its origin.** Pick a different one each
  week. If a pillar is sitting at exactly the value it produces when its provider
  caps the response, then a provider limit is being published as a market
  reading. Say so in the report rather than letting the number stand.
- **Did anything cite the index publicly this week?** Search for it. This is the
  entire reason the asset is being kept.
- **Do the sales-facing claims still hold?** `docs/DATA_SOURCES_ROADMAP.md`,
  `docs/SALES_PLAYBOOK.md` and the public API's own source lists all describe the
  index. The script catches weight-table drift; it cannot tell you that a deck
  claims live LinkedIn supply data while that source has been down for a month.

## 3. Verify the alert path when the week had an incident

If the week had completeness < 0.75 or a missed day, an alert email must exist.
The script prints the exact search, with both senders and both recipient lists,
because they change. An incident with no alert email means the alert path is
broken → 🟡 minimum, regardless of what the pipeline reports.

Note the current state: the primary sending domain is unverified, so alerts only
reach the fallback address, which is not a mailbox the audit runs from. Until
`fractionl.ai` is verified at resend.com/domains, absence of an alert in the
primary inbox is not evidence that no alert fired.

## 4. Report

Five lines. Source coverage, sources down, rows written, estimated-day count,
anything needing a decision. The script prints exactly these; add the judgement
from §2 and the deltas against last week.

Then, in order: incidents with root cause and the concrete fix (account, key,
plan, or code) ordered by index impact; deltas vs last week (sources
added/retired/recovered, completeness trend, history depth); and anything
threatening commercialisation — silent degradation, stale sales-facing claims,
single-vendor concentration.

**Verdict standard**

- 🟢 **GREEN** — on schedule, no failing sources, completeness ≥ target
- 🟡 **AMBER** — running but degraded, or any reconciliation drift
- 🔴 **RED** — missed day, completeness < 0.75, fewer than 14 healthy sources,
  public API down, or any estimated value published as measured

## 5. Escalate the same day

- **The estimated-day count changes.** An increase means someone ran a backfill
  or an estimation script against published history.
- **Any public surface presents an estimated value as measured.**
- Source coverage falls sharply.
- The pipeline writes nothing on a scheduled day.
- **Somebody cites the index publicly.** This is a good escalation.

## 6. Never do unattended

- Run any backfill or estimation script
- Change the weights
- Change published pricing
- Add or remove a data source
- Publish a change to the methodology

The audit is read-only. `scripts/pipeline-audit.mjs` writes nothing and needs no
secrets, which is what makes it safe to run unattended in CI. Propose fixes;
apply nothing.

## 7. Maintaining the baseline

`docs/audit-baseline.json` is the committed record of how many days carry an
invented value. It is what makes "the count went up" detectable at all.

Refresh it **only** after a deliberate, recorded decision — never to make a
finding go away:

```bash
npm run audit:baseline   # then review the diff and commit it
```

If the count moved and you did not intend it, that is the incident. Investigate
before touching this file.

---

## Automation

`.github/workflows/weekly-pipeline-audit.yml` runs the audit every Monday at
07:00 UTC (an hour after the daily ingest) and opens a GitHub issue on AMBER or
RED. It needs no secrets — the audit only reads public data.

That job is a backstop against the audit silently not happening, not a
replacement for §2. Nothing in CI decides whether a source is worth keeping.
