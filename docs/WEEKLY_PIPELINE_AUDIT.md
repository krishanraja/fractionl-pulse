# Weekly Pipeline Audit — Runbook

This is the procedure executed by the scheduled weekly audit session. It is
**source-agnostic by design**: it never assumes a fixed source list, so adding,
upgrading, or retiring sources week over week does not invalidate the audit.
Update this file to change what the weekly audit does — the schedule itself
just points here.

**Verdict standard:** the audit ends with one of
- 🟢 **GREEN** — pipeline on schedule, no failing sources, completeness ≥ 0.85
- 🟡 **AMBER** — pipeline running but degraded (any failing source, completeness < 0.85, or any reconciliation drift)
- 🔴 **RED** — pipeline missed a day, completeness < 0.75, healthy sources < 14, or the public API is down

Lead the report with the verdict, then findings ordered by commercial impact.
Compare against last week's audit if available (previous session/report).

---

## 0. Ground truth: where to read from

- **Live database (authoritative for data):** PostgREST at `<SUPABASE_URL>/rest/v1/`
  using the anon key. Read both from `src/lib/supabase.ts` — never hardcode them
  from memory; they can rotate. Public-read tables: `signals`, `fwi_scores`,
  `data_source_health`. (`pipeline_runs` is service-role only; do not rely on it.)
- **Code (authoritative for intent):** `supabase/functions/ingest-signals/index.ts`
  (`SOURCE_CONFIDENCE_WEIGHTS` = the intended composite source set),
  `api/cron/daily-ingest.ts` (alert thresholds), `vercel.json` (cron schedules).
- **Docs (should mirror the above):** `docs/DATA_SOURCES_ROADMAP.md`.
- **Public surface:** `https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current`
  and `/history?months=12` (or the URL currently in `src/lib/supabase.ts`).

## 1. Discover the current source universe (do not hardcode)

Build three sets and reconcile them:

1. **Intended** — keys of `SOURCE_CONFIDENCE_WEIGHTS` in `ingest-signals/index.ts`.
2. **Monitored** — `GET /rest/v1/data_source_health?select=source,status,last_success,last_checked,error_count,metadata`.
3. **Delivering** — distinct `source` values in `signals` over the last 14 days:
   `GET /rest/v1/signals?select=source,date,created_at&date=gte.<today-14d>` (paginate, limit 1000).

Flag every asymmetry:
- Intended but not delivering → broken or keyless source.
- Delivering but not intended → orphan writer (weight denominator wrong).
- Monitored but neither intended nor delivering → stale health row (ignore for
  scoring, list for cleanup) — known long-standing examples: `marketplace`,
  `ats_boards`, `bls_oews`, `fred` (coded, key never set).
- Any source in code but absent from `docs/DATA_SOURCES_ROADMAP.md` §1/§2, or
  vice versa → doc drift; fix the doc or flag it.

A **new source added this week** should appear in all three sets within its
first scheduled run — verify it does, and that its first signals pass the
anomaly guard (present in `signals`, not just attempted).

## 2. Schedule adherence

- From `signals`: collect distinct `date` values for the last 30 days. Every
  calendar day must be present (daily cron, 06:00 UTC). Missing day = 🔴.
- Latest `created_at` must be within 24h.
- `fwi_scores` must have a row for today (or yesterday if run before 06:00 UTC).
- Weekly-cadence sources (currently the content-radar family: check
  `harvest-content-signals/index.ts` for the current set) are expected on
  Mondays — treat ≤7 days stale as healthy for those; infer each source's
  cadence from its own recent history rather than assuming daily.

## 3. Source health & staleness

For each source in the **union** of intended+delivering:
- `data_source_health.status` = failed → report with `metadata.last_error` and
  days since `last_success`.
- Days since last signal > 2× its inferred cadence → stale, report even if
  health says "healthy" (a skipped source updates neither).
- Watch specifically for **provider-level correlation**: multiple sources
  sharing one vendor (e.g. all `serpapi_*` on one quota, all Apify actors on
  one token) failing together is one root cause — report it as one issue with
  the full blast radius.

## 4. Composite quality

- `fwi_scores` (last 14 days): confidence per row; today's `confidence` vs the
  thresholds in `api/cron/daily-ingest.ts` (defaults: completeness 0.75,
  min healthy sources 14; targets in `DATA_SOURCES_ROADMAP.md` §6: ≥ 0.85).
- No gap > 7 days anywhere in `fwi_scores` history; flag any null pillar scores
  in the last 14 days (older demand-only history is expected and documented).
- Sanity-check the public API: `/current` returns HTTP 200 with today's date in
  `meta.asOf`; `/history?months=12` returns > 300 points; `meta.dataCompleteness`
  matches the DB confidence.

## 5. Alert-path verification

- Confirm `send-pipeline-alert` recipients (`ALERT_EMAILS`) are current.
- If this week had completeness < 0.75 or a failed day, verify an alert email
  actually arrived (Gmail search: `from:alerts@fractionl.ai`). An incident
  without an alert email = the alert path is broken → 🟡 minimum.

## 6. Report

Deliver, in this order:
1. Verdict (🟢/🟡/🔴) + one-sentence summary.
2. Incidents: each with root cause, blast radius, days of data lost, and the
   concrete fix (account/key/plan/code), ordered by index impact (use the
   source's confidence weight).
3. Deltas vs last week: sources added/retired/recovered, completeness trend,
   history depth now.
4. Reconciliation drift (code vs DB vs docs) — with the specific file/table.
5. Anything that threatens commercialization: silent degradation, stale
   sales-facing claims, single-vendor concentration.

Do **not** change code, data, or schedules during the audit — it is read-only.
Propose fixes; apply them only when explicitly asked.
