# Autonomous Marketing and Sales Playbook

**Product:** Pulse by Fractionl

**Purpose:** Train autonomous agents to market and sell Pulse without inventing product maturity, buyers, proof, or availability

**Last reconciled:** 11 August 2026

## Mission

Create qualified conversations with specialist fractional-talent firms that can contribute useful engagement data and may pay for a standardised 90-day benchmark pilot.

The public FWI is the trust and distribution layer. The commercial test is a private, privacy-safe comparison of a firm's own engagement book with a multi-partner cohort. Do not sell a larger quota for the public score.

## Operating boundary

Agents may autonomously:

- retrieve current public product truth and live index data;
- research organisations from public business sources;
- score and segment prospects;
- draft account briefs, outreach, content, call preparation, and proposals;
- recommend the next CRM stage with supporting evidence;
- flag claim, privacy, data-fit, or product-readiness risks.

Agents must not, without explicit action authority:

- send email or social messages;
- publish content;
- enrol contacts in a sequence;
- buy data, media, software, or enrichment;
- change pricing, availability, qualification rules, or suppression thresholds;
- promise a cohort, outcome, delivery date, or custom feature;
- upload personal or customer data;
- sign an agreement, issue an invoice, or mark revenue as won.

## Required retrieval order

Before each commercial task:

1. Fetch `https://pulse.fractionl.ai/product-truth.json`.
2. Fetch the current FWI only if the task needs a market reading.
3. Read the relevant account's current public evidence.
4. Read [`SALES_PLAYBOOK.md`](SALES_PLAYBOOK.md) for buyer conversations.
5. Use the evidence matrix in [`CORPORATE_STRATEGY.md`](CORPORATE_STRATEGY.md) for market claims.

Never hardcode the current score, source-health state, price status, or conditional-plan availability into a reusable prompt.

## The buyer

### Primary ICP

A specialist fractional-executive marketplace, placement firm, staffing firm, or multi-company talent collective in the United States or United Kingdom that meets every hard qualification:

- at least 50 fractional or interim leadership engagements in the last 12 months;
- several C-suite functions, not one narrow profession;
- structured engagement data in an ATS, CRM, marketplace, or database;
- a founder, CEO, managing director, or COO who owns the repeated decision;
- a named data owner and a plausible privacy-safe export path;
- willingness to pay for a standardised validation pilot.

Firm size, approximately 5 to 50 staff or £1 million to £30 million revenue, is a targeting heuristic, not a hard gate. Engagement volume, repeated decision value, data fitness, and willingness to pay matter more.

### Do not target as the payer

- individual fractional executives;
- companies making one fractional hire;
- generic staffing firms without a meaningful fractional practice;
- adtech, advertising buyers, publishers, media outlets, or journalists;
- AI-agent builders seeking public data;
- organisations that cannot support privacy-safe aggregation.

These audiences may use, cite, or distribute the free public instrument.

## Buying moment

Prioritise accounts showing one or more of these observable triggers:

- expansion into a new role or geography;
- a pricing, fee, or retainer review;
- weak or uneven pipeline across roles;
- annual planning, a board review, or fundraising;
- a client asking for external market evidence;
- a product or data hire related to benchmarking, insights, or marketplace operations;
- public claims about proprietary market data that appear to rely on one firm's sample.

## Pain and bad workaround

| Painful moment | Current workaround | Commercial consequence |
|---|---|---|
| A slow month appears | Inspect the firm's own CRM | Cannot separate sales execution from market movement |
| Rates or fees need review | Use recruiter memory and recent deals | Small samples produce unstable price decisions |
| A role or geography may be expanding | Search job boards and ask peers | Fragmented signals arrive late and cannot be compared consistently |
| A client or board asks for evidence | Reuse generic staffing reports | Evidence lacks fractional specificity and visible limits |
| Executive supply needs allocation | Use current bench and judgement | Firm may recruit into noise or miss a durable role shift |
| Market data feels commercially sensitive | Keep everything private | No neutral multi-firm cohort can form |

## Positioning

### Category

Market intelligence and benchmarking for fractional leadership.

### Public product

Pulse is the independent market instrument for fractional leadership. It shows whether the market is expanding, which covered C-suite roles are moving, and how complete the evidence is.

### Buyer argument

You can see your own book. Pulse tests whether comparing it with a privacy-safe multi-firm cohort changes repeated decisions about demand, fill speed, rates, duration, outcomes, and executive supply.

### One flag

The fractional leadership market still runs on anecdotes.

Do not lead with AI, the number of sources, or the composite formula. Lead with the repeated decision the buyer cannot make from one firm's book.

## Message pillars and proof

| Pillar | What to say | Proof allowed | What not to imply |
|---|---|---|---|
| Independent context | Pulse separates a firm's own performance from broader measured movement | Free public FWI, role-demand pages, source health, methodology | Official status, causal certainty, or prediction accuracy |
| Fractional specificity | The instrument focuses on six fractional or interim C-suite demand lanes | Published role coverage and source list | Coverage of every role, geography, or engagement type |
| Evidence discipline | Pulse exposes data coverage, source state, and limitations | Public sources and methods, completeness, API metadata | Every tracked input is healthy or statistically independent |
| Proprietary future value | Partner records could support a cross-firm cohort no public scraper can reproduce | Pilot schema and multi-partner release gates | That the cohort already exists or will always be publishable |
| Reciprocal data exchange | Qualified partners contribute agreed fields and receive an aggregated view | Data dictionary, privacy review, independence rule | Access to raw records from another partner |

## Evidence classes

Use these labels in internal agent outputs:

- **Observed live fact:** fetched from Pulse production or the prospect's current public surface.
- **Sourced market fact:** supported by a current primary source listed in the strategy evidence matrix.
- **Supported inference:** conclusion drawn from observed facts, labelled as inference.
- **Commercial hypothesis:** proposed ICP, price, conversion, or buyer value that still needs transactions.
- **Unknown:** missing evidence that changes qualification or the offer.

No external copy may convert a hypothesis or inference into a fact.

## Account research protocol

Build a prospect card with:

```json
{
  "company": "",
  "url": "",
  "geography": [],
  "fractional_focus_evidence": [],
  "c_suite_roles": [],
  "estimated_annual_engagements": { "value": null, "evidence": "", "confidence": "low" },
  "structured_data_evidence": [],
  "economic_buyer": { "name": "", "title": "", "source": "" },
  "data_owner": { "name": "", "title": "", "source": "" },
  "buying_triggers": [],
  "likely_repeated_decision": "",
  "current_workaround": "",
  "privacy_risk": "",
  "qualification": "qualified | provisional | disqualified",
  "missing_proof": [],
  "recommended_next_action": ""
}
```

Do not infer engagement volume from staff count alone. If the 50-engagement gate cannot be established publicly, mark the account provisional and make it the first discovery question.

## Prospect score

Score only after the research card exists.

| Axis | Points | Pass condition |
|---|---:|---|
| Fractional leadership specialism | 20 | Clear fractional or interim executive focus |
| Engagement volume | 20 | 50 or more annual engagements, or credible evidence that this is likely |
| Multi-role coverage | 10 | Several covered C-suite functions |
| Structured data | 15 | ATS, CRM, platform, or reported data capability |
| Repeated decision pain | 15 | Pricing, pipeline, allocation, expansion, or client-evidence decision |
| Buyer access | 10 | Named economic buyer or credible direct route |
| Data and privacy fit | 10 | Plausible anonymised export and willingness to review it |

- **80 to 100:** Tier 1, prepare founder-led outreach.
- **65 to 79:** Tier 2, research the missing gate before outreach.
- **Below 65:** Do not enter a paid-partner sequence.

A hard disqualifier overrides the score.

## Marketing motions

### 1. Product-led authority

Publish the current FWI, role views, sources, methods, API, and MCP tools for free. Turn operational exhaust into useful content: what moved, what changed in data coverage, what the index can support, and what it cannot.

Success signal: qualified partner conversations or citations that can be traced to a public Pulse surface. Traffic alone is not the commercial result.

### 2. Named-account education

Create account-specific briefs that compare a prospect's visible market claims and public role focus with the current FWI. Use only current, sourced facts. The brief should expose one decision gap, not pretend to analyse the firm's private book.

Success signal: a meeting with the economic buyer and data owner.

### 3. Evidence-led category content

Create content around the mechanism: one firm's book is not the market. Use live Pulse readings as bounded examples, not personal rate advice or forecasts.

Success signal: replies from qualifying firms, data-partnership interest, or repeated use of the public instrument.

Do not run broad paid acquisition until the standard pilot converts and the partner data exchange works.

## Outreach sequence

Every message needs one observable account fact, one decision gap, and one low-friction ask. The following are patterns, not permission to send.

### Message 1: situation mirror

Subject: `{{company}}'s pipeline vs the market`

> {{observed account fact}}. When demand changes across {{relevant roles}}, how does the team separate a {{company}} pipeline issue from the wider fractional market?
>
> Pulse publishes the public market read for free. We are selecting a small group of specialist firms to test a private, anonymised comparison across demand, fill speed, rate bands, duration, and outcomes.
>
> Worth a 25-minute data-fit check with whoever owns the book and the underlying engagement data?

### Follow-up 1: current workaround

> The useful test is not whether another dashboard looks interesting. It is whether an independent cohort would change one repeated decision your team already makes from its own sample.
>
> If that decision does not exist, the free index is enough. If it does, I can send the pilot schema before a call.

### Follow-up 2: evidence and close

> Closing the loop. The 90-day pilot is a £1,500 validation offer, subject to data and privacy review. It does not promise a publishable cohort before the independence and record-count thresholds pass.
>
> Should I send the field list, or leave this with the public index?

Stop after the approved sequence. Do not manufacture urgency, change channel, or continue indefinitely because there was no reply.

## Qualification and discovery

The agent's job is to establish five facts:

1. What repeated decision is currently made from the firm's own sample?
2. How many relevant engagements did the firm open and fill in the last 12 months?
3. Where do the required fields live, and who owns them?
4. What privacy, contractual, or client-consent constraints apply?
5. What output would make the 90-day pilot worth £1,500?

Advance only when the repeated decision, buyer, data owner, data path, and willingness to pay are all present. General interest is not qualification.

## Offer and proposal rules

The Founding Benchmark Partner offer is a validation pilot, not a finished subscription.

- Price hypothesis: £1,500 for 90 days.
- Capacity: maximum ten organisations.
- Entry: application, data-fit, and privacy review.
- Output: data dictionary, quality assessment, a private cohort prototype where coverage permits, one benchmark review, and a written evidence boundary.
- Credit: pilot fee credited to the first annual plan if that plan launches.
- Exclusions: raw partner records, guaranteed predictions, personal rate advice, unsafe cohorts, unlimited consulting, or a guaranteed annual product.

An agent may prepare a proposal only from an approved scope. It must carry the output, exclusions, price status, decision owner, data responsibilities, privacy gate, and success criterion.

## Objection routing

| Objection | Response mechanism |
|---|---|
| “Go Fractional already has benchmarks.” | Agree. Pulse should not charge for the same public job and rate data. The pilot tests a neutral comparison between the firm's own records and a multi-partner cohort. |
| “Why share data?” | No single firm's book can become the market. The exchange must be reciprocal, aggregated, and suppressed when independence or privacy fails. |
| “Why pay before the dataset is mature?” | The pilot pays for the schema, quality, and decision-usefulness test against the firm's own records. It is not prepayment for a finished annual product. |
| “Can we buy the API?” | The current REST API and MCP tools are free. Paid value requires proprietary cohort outputs and service, not more requests to the same score. |
| “Can you guarantee the cohort?” | No. The pilot explicitly tests whether safe, independent coverage exists. If it does not, Pulse must suppress the output. |

## CRM proof

| Stage | Required evidence |
|---|---|
| Target | Public evidence of ICP fit and an owner |
| Contact-ready | Prospect card, score, one account fact, and one decision hypothesis |
| Contacted | Exact approved message, channel, recipient, and timestamp |
| Qualified | 50+ engagements, repeated decision, economic buyer, and data owner |
| Data-fit | Required fields, export path, and privacy review path |
| Pilot proposed | Approved output, exclusions, price, success measure, and suppression rule |
| Pilot won | Signed agreement and cleared payment |
| Annual candidate | Decision-useful pilot plus the product-level dataset release gate |

Never infer a stage from email sentiment. Record the evidence that earned it.

## Learning loop

Track:

- qualified conversation to data-fit rate;
- data-fit to paid-pilot rate;
- paid amount and manual delivery cost;
- time to first usable record;
- verified records per partner;
- cohorts suppressed and why;
- pilot decision changed or not changed;
- pilot-to-annual conversion after the release gate.

The commercial flip rule remains: reposition or stop the paid benchmark if fewer than five of 25 qualified firms pay, or if ten partners cannot collectively produce 500 usable records.

## Final agent check

Before an external-facing artifact leaves draft state, verify:

- the company passes the ICP or is explicitly exploratory;
- every account fact has a current source;
- the current FWI was fetched if cited;
- no current score or market movement became a personal instruction;
- no conditional plan became “live”;
- the £1,500 price remains labelled a hypothesis and application-only validation offer;
- no cohort, outcome, delivery date, or privacy threshold was invented;
- the CTA asks for one next decision;
- the exact recipient, channel, payload, and send authority are recorded.

The commercial job is not to maximise message volume. It is to discover whether a real buyer will pay for a defensible data exchange.
