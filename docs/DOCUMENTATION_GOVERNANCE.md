# Pulse Documentation Governance

**Status:** Active documentation contract

**Last reconciled:** 11 August 2026 against `main`, the production Supabase project, and the public product

This file defines how humans and autonomous agents decide which Pulse statement is current. It exists to prevent a polished but stale document from outranking the product that actually runs.

## Truth hierarchy

Use the highest available source for the type of fact being requested.

| Priority | Source | Owns |
|---:|---|---|
| 1 | Production readback | Current score, date, source health, deployed functions, schedules, endpoint responses, and availability |
| 2 | Runtime code and applied database state | Calculation behavior, routes, schemas, security boundaries, rate controls, and component behavior |
| 3 | [`CORPORATE_STRATEGY.md`](CORPORATE_STRATEGY.md) | ICP, category, positioning, offer strategy, commercial gates, and decision rules |
| 4 | [`public/product-truth.json`](../public/product-truth.json) | Machine-readable mirror of the approved product and commercial truth for agents |
| 5 | Task-specific guides | How to operate, integrate, market, sell, test, or maintain Pulse |

`product-truth.json` is the machine contract, not an independent strategy owner. When it conflicts with `CORPORATE_STRATEGY.md`, fix the JSON before an agent uses it. When either conflicts with production behavior, label the difference and do not pretend the planned behavior has shipped.

## Status vocabulary

Every commercial or product capability must use one of these labels.

| Label | Meaning |
|---|---|
| **Live** | A user can use it in production now and a readback proves it |
| **Validation offer** | A bounded offer can be proposed to qualified buyers, but willingness to pay and delivery economics remain unproven |
| **Conditional** | Defined but unavailable until its stated release gate passes |
| **Legacy dormant** | Code or data remains for compatibility, but the current product does not sell or route users through it |
| **Planned** | Not shipped and must never be described as available |

Avoid “coming soon” unless an owner and release gate exist. Never turn a migration, component, environment flag, or deployed function into a live-product claim without a user path and runtime proof.

## Autonomous-agent boot sequence

An agent acting for Pulse must do this before writing public copy, researching prospects, quoting a price, or preparing a sales conversation:

1. Fetch `/product-truth.json` from the production domain.
2. Fetch `/fwi-api/current` when using the current index level, label, date, component, completeness, or mover.
3. Read [`AUTONOMOUS_GTM_PLAYBOOK.md`](AUTONOMOUS_GTM_PLAYBOOK.md) for marketing or sales work.
4. Read [`SALES_PLAYBOOK.md`](SALES_PLAYBOOK.md) before qualification, discovery, objection handling, or a proposal.
5. Treat conditional offers and all paid prices as hypotheses.
6. Check every external claim against the evidence matrix in [`CORPORATE_STRATEGY.md`](CORPORATE_STRATEGY.md) or a newer primary source.
7. Keep research, drafting, sending, publishing, spending, changing price, and changing CRM state as separate actions. A draft does not authorise an external action.

If production truth cannot be fetched, the agent may prepare internal work from the checked-in contract but must mark volatile facts as unverified and must not publish or send them.

## Document ownership map

| Document | Primary audience | Scope |
|---|---|---|
| [`README.md`](../README.md) | Builders and new collaborators | Product summary, current scope, setup, architecture, and document map |
| [`NORTH_STAR.md`](NORTH_STAR.md) | Product and company operators | User outcome, buyer outcome, moat metric, and near-term gate |
| [`CORPORATE_STRATEGY.md`](CORPORATE_STRATEGY.md) | Founder, strategy, and commercial agents | Canonical commercial strategy and evidence |
| [`MONETIZATION_STRATEGY.md`](MONETIZATION_STRATEGY.md) | Pricing and finance | Packaging hypotheses, release gates, and revenue rules |
| [`AUTONOMOUS_GTM_PLAYBOOK.md`](AUTONOMOUS_GTM_PLAYBOOK.md) | Marketing and sales agents | Retrieval order, segmentation, messaging, motions, outputs, and approval boundaries |
| [`SALES_PLAYBOOK.md`](SALES_PLAYBOOK.md) | Founder-led sales and sales agents | Prospecting, discovery, qualification, demo, objections, proposal, and CRM proof |
| [`AGENT_BRIEFING.md`](AGENT_BRIEFING.md) | Any LLM using Pulse | Compact product and claim briefing |
| [`AGENT_INTEGRATION.md`](AGENT_INTEGRATION.md) | Developers and agent builders | REST contracts and integration behavior |
| [`MCP_TOOL.md`](MCP_TOOL.md) | MCP implementers | Hosted server and tool contract |
| [`TECHNICAL_SPEC.md`](TECHNICAL_SPEC.md) | Engineers and operators | Architecture, schema, functions, cadence, and runtime constraints |
| [`DATA_SOURCES_ROADMAP.md`](DATA_SOURCES_ROADMAP.md) | Data and product operators | Tracked input inventory, current health model, cost, incidents, and roadmap |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Product designers and frontend agents | Pulse-specific information architecture, tokens, interaction, and acceptance contract |
| [`WEEKLY_PIPELINE_AUDIT.md`](WEEKLY_PIPELINE_AUDIT.md) | Reliability operators | Read-only weekly audit and escalation procedure |
| [`FLEET_WIRING.md`](FLEET_WIRING.md) | Mindmaker OS operators | Cross-system attribution contract and pending wiring |

## Known runtime distinctions

- The FWI is recalculated after a successful daily ingestion. Weekly language refers to the brief, the seven-day role window, and the recommended interpretive cadence. Do not describe the stored score table as weekly-only.
- The public API and MCP server are free. Optional API keys add operational rate accounting and do not unlock paid data.
- The public role pages measure demand from job-posting sources. They do not publish role-level executive availability or market interest.
- Pulse contains legacy consumer subscription and Stripe infrastructure. The current public UI has no consumer paywall, the Pro gate never locks content, and partner pilots use a separate application and manual commercial path.
- The checked-in migrations are the reproducibility record. The production schema is authoritative for current nullability and row shape. Any drift must be documented and repaired with a migration before the next schema change.
- The Supabase project contains older non-Pulse functions from a prior application. Pulse documentation covers only functions represented in this repository.

## Reconciliation checklist

Run this whenever product behavior, methodology, packaging, pricing, or a public route changes:

1. Compare `main` with `origin/main` and preserve unrelated work.
2. Read back production routes and the production database state.
3. Update `CORPORATE_STRATEGY.md` if the commercial decision changed.
4. Update `product-truth.json`, `llms.txt`, and `ai-plugin.json` in the same commit.
5. Update the relevant technical, design, sales, and runbook documents.
6. Run JSON parsing, internal-link checks, claim-drift scans, lint, build, and the release smoke suite.
7. Push one coherent commit to `main` and verify the deployed revision.

Do not update a date merely to make a document look current. Update it only after the named sources were actually reconciled.
