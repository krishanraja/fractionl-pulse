---
repo: krishanraja/fractionl-pulse
product: Pulse by Fractionl
as_of: 2026-09-07
head: 7df98a5
lifecycle: live
production_url: https://pulse.fractionl.ai
state_doc: docs/DOCUMENTATION_GOVERNANCE.md
history_log: docs/history/LOG.md
truth_files: [public/product-truth.json, public/llms.txt, public/.well-known/ai-plugin.json]
authority_order: [production readback, runtime code and applied database state, docs/CORPORATE_STRATEGY.md, public/product-truth.json, task-specific guides under docs/]
steward: https://github.com/krishanraja/control-center/blob/main/docs/steward/RUNBOOK.md
never_publish: [the product name and its domain, the index name and abbreviation, the current score or label, any named data source or provider, pricing hypotheses and validation targets, Supabase project ids, credential and secret names, alert mailbox addresses, per-provider spend figures]
---
# Pulse by Fractionl: where it is right now

## What it is

Pulse is the independent market instrument for fractional leadership: a free, public 0 to 100 Fractional Working Index (FWI) that shows whether demand for fractional C-suite leaders is expanding, which roles are moving, and how strong the evidence is. Twenty-one tracked inputs feed three pillars (Demand 50%, Supply 20%, Culture 30%); the score is recalculated after each successful daily ingest and read through a weekly brief and seven-day role windows. It is a React and Supabase build on Vercel: edge functions collect and normalise the inputs, a public REST API and a hosted MCP server serve the reading to people and agents, and per-source health, completeness and provenance are published next to the number. Published by Fractionl, not an official index. The commercial hypothesis, a private cross-partner benchmark for specialist fractional-talent firms, is not live (`docs/CORPORATE_STRATEGY.md`).

## Who it is for and why it matters for Mindmake

Pulse is not a Mindmake product and Mindmake does not sell it. Its own audiences and buyer are in `docs/CORPORATE_STRATEGY.md`. For Mindmake it is proof. The room_face buyer (`control-center/docs/ICP.md`: a senior leader at a PE or VC backed media, adtech, publishing or data business, quietly behind on what is coming) runs or funds a data business. An independent market index with 21 inputs, a daily pipeline, published methodology, per-source health, a public API and an MCP server is the kind of asset that business would scope as a quarter's work for a team. One person built it and runs it with AI, in public, with the failures left in.

Angles a writer can use (the registry anonymises this repo; say "a side build", never the name):

- **The honest instrument.** Every reading carries its completeness and per-source health. Thirty-eight days of history carry an explicit "simulated estimate" label rather than being passed off as measured, and a committed baseline makes any change to that count an incident (`docs/WEEKLY_PIPELINE_AUDIT.md`, `docs/audit-baseline.json`).
- **Read the body, not the status code.** Two collectors were dead for weeks while every run reported success: one because a vendor retired a build tag the run URL pinned, one because an in-function auth check rejected the pipeline's own calls. The fix commit of 29 August 2026 names both and how long each had been dead. The weekly audit exists because "a pipeline that reports success while writing nothing has failed."
- **Provider concentration, measured in index weight.** One exhausted vendor account took out four inputs on 4 August 2026. The cutover to a second provider kept an independent backstop for the most exposed proxy, and the audit script groups failures by the credential that gates them so five dead sources report as one vendor account (`docs/DATA_SOURCES_ROADMAP.md`).
- **Discipline about claims.** The repo's own rules forbid calling the index first, only, real-time or predictive, and forbid turning a migration or a feature flag into a live-product claim (`docs/DOCUMENTATION_GOVERNANCE.md`). That is the standard the buyer's own data team should be held to.

Objection it answers: "One person with AI can prototype, but cannot run a data product." Here is one that has accumulated daily observations since June 2026, with its audit trail in the open.

## Where it is right now (as of 2026-09-07)

- **Lifecycle: live**, in the governance doc's own vocabulary: a user can use the public instrument in production now and the repo's last production readback (11 August 2026: `docs/DATA_SOURCES_ROADMAP.md` section 1, `public/product-truth.json` `production_snapshot`) proves it. The steward did not read production on 2026-09-07. Anything below marked "not read back" is code truth only.
- **Live (readback 2026-08-11):** the public FWI with demand, supply and culture components; twelve months of mixed-frequency history; six US-scoped role-demand pages; the weekly brief; Ask the Index; public REST endpoints; four hosted MCP tools; discovery files at `/product-truth.json`, `/llms.txt` and `/.well-known/ai-plugin.json`; optional accounts and free operational API keys.
- **Schedule (code, and the 2026-08-11 readback):** Supabase `pg_cron` prepares the Google Jobs tasks at 05:00 UTC; Vercel runs the main ingest at 06:00 UTC daily with a Monday backstop; a Supabase Monday backstop remains (`vercel.json`, `docs/TECHNICAL_SPEC.md` section 2). A read-only pipeline audit runs Mondays 07:00 UTC and opens an issue on AMBER or RED (`.github/workflows/weekly-pipeline-audit.yml`).
- **Repaired in code on 2026-08-29, not read back:** the GoFractional supply collector (dead since 2026-07-03) and insights generation (dead since 2026-08-10). Commit `7df98a5` states both fixes were already running in production before the merge. The `production_snapshot` in `public/product-truth.json` predates the fix and still lists that collector as failed; treat it as the 11 August evidence it says it is, and query `data_source_health` for today.
- **Validation offer, not revenue:** Founding Benchmark Partner, application only (`src/pages/Pricing.tsx` shows it and the enterprise tier; the membership tier is strategy-defined and not displayed). Benchmark Membership and Enterprise are **Conditional** on partner-data gates that do not exist yet. Partner-data ingestion, the cohort dashboard, suppression rules and partner billing are **Planned** (`public/product-truth.json` `not_live`).
- **Legacy dormant:** consumer subscription, Stripe checkout and waitlist infrastructure remain in the tree and are not offers.
- **Known operational gap (2026-08-07, unchanged in code):** the alert sending domain is unverified, so pipeline alerts reach only the fallback mailbox (`docs/DATA_SOURCES_ROADMAP.md` section 3).

## What changed recently

- 2026-08-29 **Two production fixes restored to `main`** (`a123e81`, `7df98a5`). Why: the repo had drifted from what was running. The GoFractional collector had failed on every run since 2026-07-03 because the vendor retired the `latest` build tag its run URL pinned; the fix drops the pin and adds the proxy configuration the newer build requires. Insights generation had returned 403 on every daily cron call since 2026-08-10 because an in-function check compared the bearer token to the service-role key; the check was removed and the gateway's JWT verification is the auth. The merge conflict was `origin/main` reintroducing the broken URL, "resolved in favour of the fix." No document moved at the time; `docs/TECHNICAL_SPEC.md` and `docs/DATA_SOURCES_ROADMAP.md` were reconciled on 2026-09-07.
- 2026-08-12 **Vite dev server allows `.vercel.run` hosts** (`70c9aff`). No documentation consequence.
- 2026-08-11 **Pipeline cutover and full documentation reconciliation** (`e76c6f7` to `429cd68`, seven commits). Why: a single exhausted provider account had taken out four inputs on 4 August. Paid Google Jobs tasks are now prepared at 05:00 UTC and retrieved at 06:00 UTC so a chargeable POST is never retried automatically; a provider response parser that assumed an array met an object; a mover label was normalised by migration; every doc, the three truth files and `scripts/docs-audit.mjs` were reconciled against a production readback (FWI 51.4, completeness 0.81, 17 of 21 sources contributing).

## What is next and what is waiting on Krish

- Next: a production readback (`data_source_health`, `pipeline_runs`, `cached_insights.valid_until`, `/fwi-api/current`) to confirm the two 2026-08-29 fixes are delivering, then refresh `production_snapshot` in `public/product-truth.json` and the readback notes in `docs/DATA_SOURCES_ROADMAP.md`. Until then both carry the 11 August evidence and say so.
- Waiting on Krish: verify the alert sending domain with the email provider so alerts reach more than the fallback mailbox (`docs/DATA_SOURCES_ROADMAP.md` section 3).
- Waiting on Krish: the commercial validation gate of 31 October 2026 (25 qualified conversations, ten letters of intent, five paid pilots) in `docs/CORPORATE_STRATEGY.md` section 8. No progress figures exist in the repo; the steward records none.
- Waiting on Krish: `docs/FLEET_WIRING.md` and the governance ownership map say "Mindmaker OS". The OS was renamed Mindmake on 2026-08-29 (control-center). Renaming is a naming decision, not drift the steward resolves.

## Read next

The authority order is the truth hierarchy in `docs/DOCUMENTATION_GOVERNANCE.md`: production readback, then runtime code and applied database state, then the documents below.

1. `docs/DOCUMENTATION_GOVERNANCE.md`: which statement wins, the status vocabulary (Live, Validation offer, Conditional, Legacy dormant, Planned), the reconciliation checklist.
2. `docs/CORPORATE_STRATEGY.md`: the canonical commercial strategy, ICP, pricing hypotheses and evidence matrix. Commercial claims come from here and are Krish's.
3. `public/product-truth.json`, `public/llms.txt`, `public/.well-known/ai-plugin.json`: the machine contract agents fetch before quoting anything; they move with the prose.
4. `README.md`: scope, live surfaces, API, architecture, setup, document map.
5. `docs/TECHNICAL_SPEC.md`: edge functions, schedule, schema, sources, composite, API. Reconciled against `main` at `7df98a5`.
6. `docs/DATA_SOURCES_ROADMAP.md`: the 21 inputs, confidence weights, incidents, cost model, roadmap. Code side reconciled at `7df98a5`; database side last read 2026-08-11.
7. `docs/WEEKLY_PIPELINE_AUDIT.md` with `.github/workflows/weekly-pipeline-audit.yml` and `scripts/pipeline-audit.mjs`: a versioned runbook with a thin scheduled invoker. The docs steward follows the same pattern: the procedure lives in control-center and `.github/workflows/docs-steward.yml` only calls it.
8. `docs/AGENT_BRIEFING.md`, `docs/AUTONOMOUS_GTM_PLAYBOOK.md`, `docs/SALES_PLAYBOOK.md`: what an agent may say and do, in that order.
9. `docs/AGENT_INTEGRATION.md` and `docs/MCP_TOOL.md`: REST and MCP contracts. `docs/DESIGN_SYSTEM.md`: the interface contract. `docs/FLEET_WIRING.md`: attribution wiring to the OS warehouse, pending on the OS side.
10. `docs/NORTH_STAR.md` and `docs/MONETIZATION_STRATEGY.md`: short views of the same strategy; both name `CORPORATE_STRATEGY.md` as canonical.

## Do not trust

- `public/product-truth.json` `production_snapshot` and the two readback notes in `docs/DATA_SOURCES_ROADMAP.md` section 1 as a current reading: they are dated 2026-08-11 and say so. The 2026-08-29 collector fix is not reflected in them. Fetch `/fwi-api/current` and query `data_source_health`.
- `docs/TECHNICAL_SPEC.md` section 11 "Recent Major Changes": a partial list kept as history; `git log` is the record.
- `meta.nextUpdate` in `/fwi-api/current`: a legacy next-Sunday marker, not the next ingest time (`docs/AGENT_BRIEFING.md`).
- Migrations `008` and `009` define the Supabase `pulse-daily-ingest`, `pulse-daily-insights` and `pulse-daily-redeploy` `pg_cron` jobs. The 2026-08-11 readback did not find them active; do not describe them as running (`docs/TECHNICAL_SPEC.md` section 2, `docs/FLEET_WIRING.md`). The Monday `weekly-fwi-ingest` job from migration `002` was found active.
- Nothing else is superseded. `docs/NORTH_STAR.md`, `docs/CORPORATE_STRATEGY.md` and `docs/MONETIZATION_STRATEGY.md` overlap on prices and release gates and were checked for contradiction on 2026-09-07: none found. Prices, gates and the 31 October stop rule agree, and the pricing page shows the two tiers `MONETIZATION_STRATEGY.md` says it shows.
