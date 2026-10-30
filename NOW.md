---
repo: krishanraja/fractionl-pulse
product: Pulse by Fractionl
as_of: 2026-10-30
head: e277a1b
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

## Where it is right now (as of 2026-10-30)

<!-- north-star-state {"week_of": "2026-10-26", "week_target": 0, "current": 0, "current_as_of": "2026-10-30", "current_source": "docs/citability-log.jsonl", "urgency": 2, "urgency_reason": "the streak cannot start before 2026-11-17 and three inputs have no misses left, so one missed day pushes the start; U2 inferred, the harness contract was not readable from the session that set it"} --> **North Star number: U2, on the ladder but with no slack.** Days in a row at 10/10 citability: 0 of 30 (target set by Krish on 2026-10-26: one month, then extend), recorded daily in `docs/citability-log.jsonl` by `npm run citability`. 2026-10-30 scored 9.5/10. The streak can start on 2026-11-17 at the earliest, when the last of three inputs clears the delivery bar (`sec_edgar` 7 November, `serpapi_linkedin` 6 November after a miss that moved it from 31 October, `newsapi` 17 November), so the earliest the 30 days can be met is 2026-12-16. Each of the three has no misses left until it clears. Stage 0 of the sprint (Friday 30 October) closed at 9.5, the bar Krish kept.

- **Lifecycle: live**, in the governance doc's vocabulary. Last direct production readback 2026-09-24 (20 health rows, 18 healthy); the 2026-10-26 seam day was read back (46, band 42 to 51, ten votes, completeness 0.97). `public/product-truth.json` `production_snapshot` and `docs/DATA_SOURCES_ROADMAP.md` section 1 are stamped 2026-08-11 and are stale; this file carries the current reading.
- **Live surfaces:** the public FWI with demand, supply and culture components, six US-scoped role pages, the weekly brief, Ask the Index, public REST endpoints, four hosted MCP tools, `/methodology`, `/changelog`, terms and privacy, discovery files, optional accounts and free operational API keys. The `/answers` hub is built in code (`docs/ANSWER_HUB.md`); whether it is live is unverified.
- **Schedule (readback 2026-09-21):** one collection per calendar day, Vercel primary ingest 06:00 UTC with a Supabase backstop at 08:00, trial collection 05:40 and 06:30, daily publication check; function deploys run from main (`docs/TECHNICAL_SPEC.md` section 2).
- **Watching:** the pinned issue "Pulse status (rewritten daily)" is the live status; incidents open their own issue and one bounded Claude investigation. No hidden Claude schedules exist for Pulse.
- **Inputs:** 9 never-moving inputs retired at the seam; repaired Wikipedia, Hacker News (wide) and Trends joined; further candidates run in the trial lane outside the index until they pass the gate (`docs/CITABILITY.md`). `sec_exec_transitions` and the JOLTS professional services anchor are collected at zero weight.
- **Validation offer, not revenue:** Founding Benchmark Partner, application only (`src/pages/Pricing.tsx`). Benchmark Membership and Enterprise are Conditional on partner-data gates that do not exist; partner ingestion, cohort dashboard and billing are Planned (`public/product-truth.json` `not_live`).
- **Legacy dormant:** consumer subscription, Stripe checkout and waitlist infrastructure remain in the tree and are not offers.

## What changed recently

- 2026-10-26 **The first method v2 reading went out and the readback found three faults the same morning** (`9a4c922`, `aa7d81c`). Reading 46 (42 to 51), publication check 9/9. Ingest had dropped `bls_incorporated` as an "empty supply" reading because its year-over-year change is negative (-3.73); the RSS feed said "46 (Stable)" with no band and 20 inputs; the audit called a monthly release frozen after three days. All fixed; the checks now fail without the band.
- 2026-10-26 **OpenAlex had failed since 2026-10-24 for a reason the collector hid** (`9bbf89a`, `e752bbf`). OpenAlex meters keyless requests per IP and Supabase's shared egress spends the budget (HTTP 429); the collector had reported "zero works across all phrases". It now sends a key, names the first error in its health row, and has a read-only `?diagnose=openalex` mode.
- 2026-10-26 **Citability is scored every day by a machine, and the North Star is a 30-day streak** (`a6cec2d`, `5663a76`). The score had been a hand count. The first run found three inputs under the 27-of-30 bar, not one, so 10/10 moved to 17 November at the earliest. Ruling (Krish, 2026-10-26): one month of consecutive 10/10 days for now, then extend.
- 2026-10-26 **Watching moved into the repository** (`31a1806`). Krish, 2026-10-26: "keep watch and report back without hidden Claude schedules". One pinned status issue, and at most 40 turns and 30 minutes of public-data investigation per incident, proposing fixes only as pull requests.
- 2026-10-23 **Nothing on the road to 10/10 depends on a scheduled session now.** Krish: "all of this needs to be antifragile, claude schedules suck." Seam clean-up, changelog link amounts and a daily publication check that opens and closes its own issue moved into the system. Two silent failures found on the way: a failed index calculation raised no alert, and the 14-healthy-source floor would have alerted daily after the seam.
- 2026-10-23 **The entry gate checks that an input measures the thing, and caught three** (`e0ef579`). All 7 Guardian "fractional" matches in 90 days were unrelated; Mediastack was about 1 in 21 on topic. Both repairs dropped, and Podchaser-as-flow fails the relevance check (about 3 of 50).
- 2026-10-23 **Six of nine retired inputs had a simple repair and went back to the trial lane** (`f4c2810`). Krish asked that nothing be retired as unfixable without testing a repair; page caps, a normalizer floor and a two-word keyword were the causes.
- 2026-10-23 **The trial lane went live** (`0977c83`): candidates are collected daily outside the index and gated before joining; function deploys became automatic from main once Krish added the access-token secret.
- 2026-10-23 **Method v2 was deployed behind a dated seam** (`354ad1c`, `dc9ea9c`). Nine never-moving inputs retire, one vote per source, supply rebuilt, chain-linked, whole numbers with a band. A dry run gave 45 (40 to 50) against the published 48; the pre-registered Indeed test failed with the opposite sign (r = -0.53, n = 18).
- 2026-10-23 **The citability checklist exists and the product scored 3.5 of 10.** Measured: 8 of 16 weighted inputs had not moved since 2026-06-01, so "10.7 effective independent inputs" was a script artefact; the corrected figure is 4.4 (`docs/CITABILITY.md`).
- 2026-10-23 **fractionl.ai stopped receiving mail**, so public contacts moved to a new address and the root MX record was removed; migration `020` applied.
- 2026-10-21 **Pulse got an answer hub** (`c8972f9`, PR #56): five seed posts, a validator that fails the build on a bad post, and a PNG `og:image` replacing an SVG that social platforms do not render. Production was not read back.

## What is next and what is waiting on Krish

- Next: 2026-11-17 at the earliest for 10/10 (`npm run citability` prints each input's clearing date), and the 2026-11-20 trial review (`npm run trial`; a trial that passes goes to Krish and joins only at a dated seam). Unverified since 2026-09-25 and to read against production: the first `job_openings_pbs` row, the health of `hn` and `gofractional`, and a refresh of `production_snapshot`.
- Decision for Krish: whether to adopt the peer-relative test as the data-quality §5 floor rule; both absolute bands are structurally unreachable (`docs/DATA_QUALITY_STRATEGY.md`, commit `12bad4f`).
- Decision for Krish: the Apify allowance behind the GoFractional collector (a rejected proxied run is retried once without a proxy, which does not address the allowance).
- Decision for Krish: the 31 October 2026 commercial validation gate in `docs/CORPORATE_STRATEGY.md` section 8; the repo holds no progress figures.
- Decision for Krish: `docs/FLEET_WIRING.md` and the governance ownership map still say "Mindmaker OS"; the OS was renamed Mindmake on 2026-08-29. Renaming is a naming call, not drift the steward resolves.
- North Star check (2026-10-23): holds.

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
