---
repo: krishanraja/fractionl-pulse
product: Pulse by Fractionl
as_of: 2026-11-28
head: ed18a07
lifecycle: live
production_url: https://pulse.fractionl.ai
state_doc: docs/DOCUMENTATION_GOVERNANCE.md
history_log: docs/history/LOG.md
truth_files: [public/product-truth.json, public/llms.txt, public/.well-known/ai-plugin.json]
authority_order: [production readback, runtime code and applied database state, docs/CORPORATE_STRATEGY.md, public/product-truth.json, task-specific guides under docs/]
steward: https://github.com/krishanraja/ai-harness/blob/main/docs/steward/RUNBOOK.md
never_publish: [the product name and its domain, the index name and abbreviation, the current score or label, any named data source or provider, pricing hypotheses and validation targets, Supabase project ids, credential and secret names, alert mailbox addresses, per-provider spend figures]
---
# Pulse by Fractionl: where it is right now

## What it is

Pulse is the independent market instrument for fractional leadership: a free, public 0 to 100 Fractional Working Index (FWI) that shows whether demand for fractional C-suite leaders is expanding, which roles are moving, and how strong the evidence is. Twenty tracked inputs feed three pillars (Demand 50%, Supply 20%, Culture 30%); the score is recalculated after each successful daily ingest and read through a weekly brief and seven-day role windows. It is a React and Supabase build on Vercel: edge functions collect and normalise the inputs, a public REST API and a hosted MCP server serve the reading to people and agents, and per-source health, completeness and provenance are published next to the number. Published by Fractionl, not an official index. The commercial hypothesis, a private cross-partner benchmark for specialist fractional-talent firms, is not live (`docs/CORPORATE_STRATEGY.md`). Method v2 has been the published reading since 2026-10-26 (whole number with a band, one vote per source); `docs/CITABILITY.md` holds the rulings.

## Who it is for and why it matters for Mindmake

Pulse sits under the Mindmaker LLC (United States) and Mindmaker Ltd (United Kingdom) umbrella, published under the Fractionl name; Mindmake does not sell it. Its audiences and buyer are in `docs/CORPORATE_STRATEGY.md`. For Mindmake it is proof. The room_face buyer (`control-center/docs/ICP.md`: a senior leader at a PE or VC backed media, adtech, publishing or data business, quietly behind on what is coming) runs or funds a data business, and an independent index with a daily pipeline, published methodology, per-source health, a public API and an MCP server is what that business would scope as a quarter's work for a team. One person built it and runs it with AI, in public, with the failures left in.

Angles a writer can use (the registry anonymises this repo; say "a side build", never the name):

- **The honest instrument.** Every reading carries its completeness and per-source health; history that was estimated carries an explicit "simulated estimate" label (`docs/WEEKLY_PIPELINE_AUDIT.md`, `docs/audit-baseline.json`).
- **Read the body, not the status code.** Two collectors were dead for weeks while every run reported success; the weekly audit exists because "a pipeline that reports success while writing nothing has failed."
- **Inputs must measure the thing.** Eight of 16 weighted inputs had never moved, and 7 of 7 Guardian "fractional" matches were cricket and jets; the entry gate now checks relevance before an input can join (`docs/CITABILITY.md`).
- **Discipline about claims.** The repo's rules forbid calling the index first, only, real-time or predictive (`docs/DOCUMENTATION_GOVERNANCE.md`).

Objection it answers: "One person with AI can prototype, but cannot run a data product." Here is one that has collected daily since June 2026, with its audit trail in the open.

## Where it is right now (as of 2026-11-28)

<!-- north-star-state {"week_of": "2026-10-26", "week_target": 0, "current": 0, "current_as_of": "2026-11-27", "current_source": "docs/citability-log.jsonl", "urgency": 2, "urgency_reason": "the streak cannot start before 2026-12-23 after serpapi_linkedin slipped again, so one missed day pushes the start again; U2 inferred, the harness contract was not readable from the session that set it"} --> **North Star number: U2, on the ladder but with no slack.** Days in a row at 10/10 citability: 0 of 30 (target set by Krish on 2026-10-26: one month, then extend), recorded daily in `docs/citability-log.jsonl` by `npm run citability`. 2026-11-27 scored 9/10 (reading 50, band 46 to 55); the one input-delivery check scored 0, with four open gaps: `serpapi_jobs` at 23 of 30 days, `serpapi_linkedin` at 16 of 30, `trial_trends` at 22 of 30 (each clears 2026-12-16 or later, `serpapi_linkedin` not before 2026-12-23, only if it misses no more) and `trial_wikipedia` at 26 of 30 (clears 2026-12-08). The streak can start on 2026-12-23 at the earliest, so the earliest the 30 days can be met is 2027-01-21 (inferred from the log's clearing dates, not re-run). Stage 0 of the sprint (Friday 30 October) closed at 9.5, the bar Krish kept.

- DataForSEO has rejected Pulse's login (HTTP 401, code 40100) since 2026-11-13, so serpapi_jobs, serpapi_linkedin and trial_trends have delivered nothing since 2026-11-12. Krish said he updated it on 2026-11-18, but at 18:54 UTC Pulse's Supabase project still showed both DataForSEO secrets last changed on 2026-08-11. PR #78 (input watch plus a free DataForSEO login check) merged 2026-11-19. Alert emails go through the backup sender because the Resend account behind Pulse's key reports fractionl.ai as not verified. (2026-11-19)
- **Lifecycle: live**, in the governance doc's vocabulary. Last direct production readback 2026-09-24 (20 health rows, 18 healthy); the 2026-10-26 seam day was read back (46, band 42 to 51, ten votes, completeness 0.97). `public/product-truth.json` `production_snapshot` and `docs/DATA_SOURCES_ROADMAP.md` section 1 are stamped 2026-08-11 and are stale; this file carries the current reading.
- **Live surfaces:** the public FWI with demand, supply and culture components, six US-scoped role pages, the weekly brief, Ask the Index, public REST endpoints, four hosted MCP tools, `/methodology`, `/changelog`, terms and privacy, discovery files, optional accounts and free operational API keys. The `/answers` hub is built in code (`docs/ANSWER_HUB.md`); whether it is live is unverified.
- **Schedule (readback 2026-09-21):** one collection per calendar day, Vercel primary ingest 06:00 UTC with a Supabase backstop at 08:00, trial collection 05:40 and 06:30, daily publication check; function deploys run from main (`docs/TECHNICAL_SPEC.md` section 2).
- **Watching:** the pinned issue "Pulse status (rewritten daily)" is the live status; incidents open their own issue and one bounded Claude investigation. No hidden Claude schedules exist for Pulse.
- **Inputs:** 9 never-moving inputs retired at the seam; repaired Wikipedia, Hacker News (wide) and Trends joined; further candidates run in the trial lane outside the index until they pass the gate (`docs/CITABILITY.md`). `sec_exec_transitions` and the JOLTS professional services anchor are collected at zero weight.
- **Validation offer, not revenue:** Founding Benchmark Partner, application only (`src/pages/Pricing.tsx`). Benchmark Membership and Enterprise are Conditional on partner-data gates that do not exist; partner ingestion, cohort dashboard and billing are Planned (`public/product-truth.json` `not_live`). Legacy consumer subscription, Stripe checkout and waitlist code stays in the tree and is not an offer.

## What changed recently

- 2026-11-20 **Two new keys, a page reader and a web search, were added to Pulse's edge function secrets and nothing uses them yet** (`56e22ba`, PR #81). Checked by name only. They are readable from edge functions, not from GitHub Actions or Vercel without a secret write that needs Krish's yes. Rule kept: a new input starts in the trial lane and must pass the entry gate in `docs/CITABILITY.md`; a page reader that returns text is not an input until it is shown to measure the thing.
- 2026-11-18 An index input whose provider rejects Pulse's account now opens an issue assigned to Krish on day one, and any input missing two days in a row opens one too (PR #78, merged 2026-11-19). DataForSEO's login had been rejected for six days with no issue opened, because the daily check only raised one on a publication failure or a drop from 10.
- 2026-11-18 Ruling (Krish, 2026-11-18): all Podchaser attention goes to growth-mindmake and growth-makeyourmindup. The trial spent about 1,200 of the shared 25,000 monthly Podchaser points a day (82% of November's) to read 3 every day. This replaces the earlier ruling that brought a Podchaser input in on 2026-11-23. Pulse no longer calls Podchaser (trial input dropped, Monday harvest no longer reads it); no published FWI input changed.
- 2026-11-15 **The SEC executive-transitions series was evaluated and not promoted, because its stored value cannot carry a signal** (`5a45c17`, PR #57). The stored number is a rolling 90-day count: 26 rows, raw 687 to 743 (CV 1.9%), the same near-constant defect as the retired `serpapi_supply_trends`. Counted per calendar week the same filings swing 35 to 115 (CV 35%). Against the demand pillar, n = 20 weeks, r = 0.35 with a 95% CI of -0.11 to 0.69: no relationship demonstrated, none ruled out. Two culture correlations came from a single week. Stays at zero weight (`docs/DATA_QUALITY_STRATEGY.md`, `npm run evaluate:sec`).


## What is next and what is waiting on Krish

- Next (2026-11-26): Confirm serpapi_jobs, serpapi_linkedin, trial_trends and trial_wikipedia show a new last_success in data_source_health after the 06:00 UTC ingest; the two checks that failed on 2026-11-19 passed from 2026-11-20.
- Decision for Krish: whether to adopt the peer-relative test as the data-quality §5 floor rule; both absolute bands are structurally unreachable (`docs/DATA_QUALITY_STRATEGY.md`, commit `12bad4f`).
- Decision for Krish: whether to re-specify the `sec_exec_transitions` collected value as a 7-day filing count instead of the 90-day count, with an effective date and no restatement; proposed in `docs/DATA_QUALITY_STRATEGY.md`, re-run at n >= 30 weeks (about 2026-12-28).
- Waiting on a person: the North Star check below is dated 2026-11-20, 8 days old (audit limit 7). Only a session that re-reads the North Star against its work may re-date it, so the steward leaves it.
- Decision for Krish: whether to remove the now unused Podchaser secrets from Pulse's Supabase project, with the secret rotation.
- Decision for Krish: the Apify allowance behind the GoFractional collector (a rejected proxied run is retried once without a proxy, which does not address the allowance).
- Decision for Krish: the 31 October 2026 commercial validation gate in `docs/CORPORATE_STRATEGY.md` section 8; the repo holds no progress figures.
- Decision for Krish: `docs/FLEET_WIRING.md` and the governance ownership map still say "Mindmaker OS"; the OS was renamed Mindmake on 2026-08-29. Renaming is a naming call, not drift the steward resolves.
- North Star check (2026-11-20): recalibration proposed. The 2026-11-18 proposal on the deadline stands for Krish; a trial input moves the citability streak only if it clears the delivery bar.

## Read next

The authority order is the truth hierarchy in `docs/DOCUMENTATION_GOVERNANCE.md`: production readback, then runtime code and applied database state, then the documents below.

0. `AGENTS.md`: entry file; carries the canon block rendered from `krishanraja/ai-harness`, which the steward never writes.
1. `docs/DOCUMENTATION_GOVERNANCE.md`: which statement wins, the status vocabulary, the reconciliation checklist.
2. `docs/CORPORATE_STRATEGY.md`: canonical commercial strategy; commercial claims are Krish's.
3. `public/product-truth.json`, `public/llms.txt`, `public/.well-known/ai-plugin.json`: the machine contract agents fetch before quoting.
4. `README.md`, `docs/TECHNICAL_SPEC.md`, `docs/DATA_SOURCES_ROADMAP.md`: scope, schedule, schema, sources (the roadmap's database side was last read 2026-08-11).
5. `docs/CITABILITY.md`, `docs/DATA_QUALITY_STRATEGY.md`, `docs/WEEKLY_PIPELINE_AUDIT.md`: the 10-point checklist and rulings, the improvement programme, the audit runbook.
6. `docs/AGENT_BRIEFING.md`, `docs/AUTONOMOUS_GTM_PLAYBOOK.md`, `docs/SALES_PLAYBOOK.md`: what an agent may say and do.
7. `docs/AGENT_INTEGRATION.md`, `docs/MCP_TOOL.md`, `docs/DESIGN_SYSTEM.md`, `docs/FLEET_WIRING.md`, `docs/ANSWER_HUB.md`: API, MCP, interface, wiring and answer hub contracts.
8. `docs/NORTH_STAR.md` and `docs/MONETIZATION_STRATEGY.md`: short views of the strategy; both name `CORPORATE_STRATEGY.md` as canonical.

## Do not trust

- `public/product-truth.json` `production_snapshot` and the readback notes in `docs/DATA_SOURCES_ROADMAP.md` section 1 as a current reading: dated 2026-08-11. Fetch `/fwi-api/current` and query `data_source_health`.
- `docs/TECHNICAL_SPEC.md` section 11 "Recent Major Changes": a partial list kept as history; `git log` is the record.
- `meta.nextUpdate` in `/fwi-api/current`: a legacy next-Sunday marker, not the next ingest time (`docs/AGENT_BRIEFING.md`).
- Any "21 tracked inputs" or "not yet deployed" wording about the `serpapi_supply_trends` retirement: it is deployed, and the figure is 20.
- The `as_of` date as evidence that everything was re-read: the commercial, fleet-wiring and design sections rest on their own earlier dates, and the five stale stamps the digest lists were not re-read.
- Earlier history of all of the above is in `docs/history/LOG.md`.
