# Pulse Corporate Strategy

**Status:** Canonical commercial strategy as of 10 August 2026

**Owner:** Fractionl

**Product:** Pulse, home of the Fractional Working Index (FWI)
**Review trigger:** 25 qualified buyer interviews, 10 signed data-sharing letters of intent, or a material change to the index methodology

This document is the source of truth for corporate strategy, ideal customer profile, packaging, pricing, and product marketing. `public/product-truth.json` is the machine-readable expression of the same strategy. Technical behaviour remains documented in the API and methodology files.

## 1. Strategic decision

Pulse is the independent market instrument for fractional leadership.

It is not an adtech product, publisher tool, media intelligence product, job marketplace, career-coaching product, or generic staffing index. Advertising companies, publishers, journalists, and individual fractional executives may read or cite the public index. They are not the commercial ideal customer profile.

The business has three distinct roles:

| Role | Who | Exchange |
|---|---|---|
| Public user | Fractional executive, company considering a fractional hire, researcher, or AI agent | Reads the index, role pages, brief, REST API, and MCP tools for free |
| Paying customer | Specialist fractional-executive marketplace, placement firm, or multi-company talent collective | Pays for a private benchmark of its book against a verified market cohort |
| Data partner | The same qualified firms, plus selected portfolio talent teams | Contributes anonymised engagement records under a defined data agreement and receives the resulting benchmark |

The free index is the trust and distribution layer. The future paid benchmark is the commercial layer. The public API is distribution infrastructure, not the paid wedge.

## 2. The problem worth owning

> The fractional leadership market still runs on anecdotes.

Specialist firms can see their own pipeline, but they cannot reliably tell whether a change is caused by their sales execution, their client mix, or the market. They price and allocate supply using a small, biased sample. By the time requisitions or placements expose a role-level shift, the decision window has already narrowed.

Pulse should answer two levels of question:

1. **Public:** Is fractional leadership demand expanding or contracting, which roles are moving, and how complete is the evidence?
2. **Partner-only:** How does my firm's demand, fill speed, rate band, duration, and outcomes compare with an anonymised market cohort?

The first question is live. The second is the paid product hypothesis and requires partner data before it can be sold honestly.

## 3. Exact ideal customer profile

### Primary paying ICP

**Segment:** Specialist fractional-executive marketplaces, staffing and placement firms, and collectives in the United States or United Kingdom.

**Firmographic fit:**

- Places multiple C-suite functions, rather than a single professional niche
- Approximately 5 to 50 staff or £1 million to £30 million in annual revenue
- At least 50 fractional or interim leadership engagements per year
- Uses an ATS, CRM, marketplace, or structured engagement database
- Does not employ a full independent market-intelligence team
- Can contribute privacy-safe, anonymised first-party data

**Economic buyer:** Founder, CEO, managing director, or COO.

**Primary users:** Operations, research and insights, sales leadership, and product.
**High-intent trigger:** A role or geography expansion, weak pipeline, pricing review, annual planning cycle, board meeting, fundraising process, or client request for market evidence.

**Required data fields:** Role, geography, engagement model, opened date, filled date, rate or fee band, expected duration, actual duration where known, and an agreed outcome marker. No personal names or raw client identifiers should enter the benchmark dataset.

### Jobs they are hiring Pulse to do

- Separate a firm-specific sales problem from a market-wide demand change
- Set rate bands, retainers, and placement economics with evidence beyond the firm's own book
- See role or geography movement before it becomes obvious in completed placements
- Give clients, boards, and investors a credible market view with visible provenance and limits
- Decide which executive supply to recruit, activate, or leave on the bench
- Replace fragmented job searches, peer anecdotes, and generic staffing reports with one fractional-specific instrument

### Pain points and current workarounds

| Pain | Current workaround | Why it fails |
|---|---|---|
| The firm cannot tell whether a slow month is company-specific or market-wide | Own ATS and CRM dashboard | One firm's book is a small, biased sample |
| Pricing is negotiated from anecdotes | Recent placements, recruiter memory, public rate guides | Public guides rarely match role, geography, duration, or engagement model |
| Demand shifts arrive late | LinkedIn searches, job boards, informal partner calls | Signals are fragmented and hard to compare over time |
| Client pitches need external proof | Generic staffing reports and selected screenshots | Generic reports are not fractional-leadership specific |
| Supply is allocated by intuition | Recruiter judgement and current bench | It is difficult to distinguish durable role movement from noise |
| Internal data is commercially sensitive | Keep it private and accept poor benchmarks | No neutral, aggregated cohort can form |

### Qualification and disqualification

A primary-ICP firm qualifies only if it will participate in a privacy and data-quality review and contribute the minimum agreed fields. A prospect that wants only an API key, a logo on a report, or a one-off public-data export is a user or sponsor, not a benchmark customer.

Explicit non-ICPs:

- An individual fractional executive as the economic buyer
- A company making one fractional hire
- A generic staffing firm with no meaningful fractional-leadership practice
- Adtech companies, advertising buyers, publishers, and media outlets
- Journalists, investors, or AI agents as economic buyers
- Any organisation unwilling or unable to support cohort privacy

### Secondary ICP, only after coverage exists

Private-equity portfolio talent and operating teams managing recurring interim or fractional leadership demand across at least ten portfolio companies are a plausible second customer. Heidrick's 2026 data indicates that interim leadership represents 51% of private-equity project mix. Pulse should not sell this tier until its first-party dataset supports relevant cohorts and portfolio-grade service levels.

## 4. User and buyer insight

The user's assumption is supported: fractional executives benefit from the market read, but the benchmark itself is unlikely to earn a recurring individual subscription.

The evidence is behavioural. Go Fractional publishes detailed demand and compensation benchmarks free. Where individuals do pay, the offer is closer to revenue creation: FindaFractional charges for qualified introductions and a success fee. The commercial distinction is simple:

- **Information that helps an executive think:** free audience and distribution
- **Qualified opportunity that can create revenue:** possible individual willingness to pay, but outside Pulse's job
- **Benchmark that changes repeated commercial decisions across many placements:** organisational willingness-to-pay hypothesis for Pulse

Therefore Pulse should keep the public instrument, public API, MCP tools, role pages, and weekly brief free. It should not create a consumer Pro plan or charge agents for generic access to the same public score.

## 5. Positioning and product marketing

### Category

Market intelligence and benchmarking for fractional leadership.

### Positioning statement

For specialist fractional-talent firms that need to price, forecast, and allocate executive supply across a changing market, Pulse is the independent market instrument that benchmarks their book against verified market movement. Unlike a job board, generic staffing report, or free rate guide, Pulse combines a transparent public index with privacy-safe engagement data from several independent partners.

### Public one-liner

> Pulse is the independent market instrument for fractional leadership. See whether demand is expanding, which C-suite roles are moving, and how strong the evidence is.

### Partner promise

> Benchmark your book against the market before your pipeline tells you too late.

### Message hierarchy

1. Live market state and role movement
2. Data completeness, provenance, and honest limits
3. Clear distinction between public signals and verified partner records
4. The decision a buyer can make differently
5. Invitation to apply as a Benchmark Partner

### Calls to action

- Fractional executive or curious company: **Read the market**
- Qualified firm: **Apply to become a Benchmark Partner**
- Agent or developer: **Use the public API or MCP tools**

### Claims discipline

Never claim that Pulse is the first, only, official, institutional, government, real-time, peer-reviewed, academically validated, or proven-predictive fractional index. Go Fractional already publishes current role, demand, and compensation benchmarks. The Form D signal may be differentiated, but its predictive value has not been validated. Say what the index measures, expose completeness, and name material limits.

## 6. Product and data moat

The current moat is not the number of crawlable sources. A competitor can reproduce public-source collection. The defensible asset is a longitudinal, privacy-safe, cross-partner record of real engagements.

**Moat metric:** Verified partner-contributed engagements in the trailing 12 months that pass schema, provenance, privacy, and quality checks and belong to a publishable cohort.

Additional publication rule: no partner benchmark cell should be shown unless it contains the minimum record count and data from at least three independent organisations. The exact privacy threshold must be set with counsel and reflected in the data-processing agreement before ingestion launches.

### Minimum paid-product dataset

- Ten active data partners
- At least 500 verified trailing-12-month engagements for the standard benchmark
- At least three independent partners in every displayed cohort
- Documented suppression and aggregation rules
- A partner-facing data dictionary and quality report

Until these conditions exist, paid plans are validation offers, not generally available products.

## 7. Pricing and packaging

All paid prices below are **strategic hypotheses**, not validated transaction facts. They are anchored to current staffing intelligence memberships and the much larger economics of placements, then must be tested in paid pilots.

| Offer | Price hypothesis | Availability | What it includes |
|---|---:|---|---|
| Public instrument | £0, forever | Live | Score, components, history, role pages, brief, REST API, MCP tools, and transparent methodology |
| Founding Benchmark Partner | £1,500 for 90 days | Application-only validation offer, maximum ten firms | Data/schema review, private cohort prototype, benchmark review, and pilot fee credited to an annual plan |
| Benchmark Membership | £6,000 per year | Only after ten active partners and 500 verified engagements | Five seats, cohort dashboard, quarterly briefing, CSV/API export of proprietary benchmark outputs |
| Enterprise and portfolio license | From £15,000 per year | Only after 1,500 verified engagements and cohort coverage | Custom cohorts, embed rights, service level, and up to 25 seats |

The public REST API and MCP tools remain free under fair-use controls. Higher service levels, proprietary cohort outputs, and custom delivery can be part of a paid plan. Generic request metering should not be positioned as the business model.

### Pricing evidence and limits

- Staffing Industry Metrics lists benchmarking membership at £1,800 or US$1,800 per year. This proves an existing staffing intelligence budget, not willingness to pay Pulse's proposed price.
- TechServe Alliance lists annual dues from US$1,495 to US$14,495 by revenue tier, with market insights among member benefits. This supports the broad range for an organisational information product.
- Bolster lists executive-talent services from a US$2,500 on-demand fee plus markup to US$30,000 and higher search fees. This proves repeated executive hiring carries material economics, not that benchmark software alone commands those prices.

No annual subscription price should be called validated until buyers pay it without a bespoke service burden that makes the software uneconomic.

## 8. Go-to-market

### Motion

Founder-led, account-based validation. No broad paid acquisition until the partner offer converts and produces a publishable dataset.

### Account list

Build a named list of 50 US and UK firms that meet the firmographic and data criteria. Prioritise multi-role fractional specialists with visible placements, active client content, and a structured marketplace or ATS.

### First conversation

Lead with the operating problem, not the index:

1. How do you distinguish a firm-specific pipeline change from market movement?
2. Which decisions currently rely on your own placement sample?
3. What external benchmark do clients or the board ask for?
4. Which anonymised engagement fields could you contribute?
5. What would a benchmark need to change for you to pay £1,500 for a 90-day pilot?

### Validation target

By 31 October 2026:

- 25 qualified discovery conversations
- 10 signed data-sharing letters of intent
- 5 paid Founding Benchmark Partner pilots at £1,500
- A credible path to 500 verified trailing-12-month records

Kill or reposition the paid membership if fewer than five of 25 qualified firms pay for the pilot, or if ten partners cannot collectively produce 500 usable records. Keep the free FWI if it continues to earn repeat use, citations, qualified inbound, or partner conversations.

## 9. Operating metrics

### Public product

- Weekly returning readers who view a role page or evidence detail
- API and MCP consumers that return in a later week
- Citations and qualified partner applications
- Current data completeness and source-health trend

### Commercial validation

- Qualified buyer conversations
- Signed data-sharing letters of intent
- Paid pilots and pilot-to-annual conversion
- Days from first conversation to usable data
- Verified engagements and independent partners per publishable cohort

### Guardrails

- No revenue counted from unsigned or unpaid pilots
- No cohort displayed below privacy and independence thresholds
- No decision claim without supporting data
- No paid-plan launch based only on public-source records

## 10. Evidence matrix

Research retrieved 10 August 2026. Vendor studies are useful directional evidence and are labelled accordingly.

| Claim | Evidence | Limits | Confidence | Decision effect |
|---|---|---|---|---|
| Interim C-suite demand is material and growing | [Heidrick & Struggles, 2026 High-End Independent Talent Report](https://www.heidrick.com/-/media/heidrickcom/files/attachments/2026-high-end-independent-talent-report.pdf?rev=11494cb97e73494f80b759b5fb4d72d7): interim C-suite demand up 151% since 2021 and 14% year over year; CFOs are 51% of leadership requests | Proprietary platform data from one provider | High for Heidrick's book, medium for the whole market | Maintain C-suite role focus and prioritise firms with repeated placements |
| Buyers use independents to fill gaps and accelerate work | [Heidrick & Struggles, 2026 Talent Lens Survey](https://www.heidrick.com/-/media/heidrickcom/publications-and-reports/odt/2026-talent-lens-survey.pdf?hash=5B343ED30EE3DE8D128ECA415F085F0C&rev=cfa1d488e8c44135b798cd000332a705): clients use independents for skill gaps, objective insight, initiative acceleration, leadership bandwidth, and capacity | Survey of 3,810 full-time independents, not buyers directly | Medium-high | Product marketing should focus on repeated commercial decisions, not trend curiosity |
| The addressable independent workforce is large | [MBO Partners, 2025 State of Independence](https://www.mbopartners.com/state-of-independence): 72.9 million US independents and 5.6 million earning over US$100,000 | Broad independent workforce, not fractional executives | Medium | Use as market context only, not TAM proof |
| Free role-level demand and compensation benchmarks already exist | [Go Fractional, 2026 State of Fractional Work](https://www.gofractional.com/insights), [methodology](https://www.gofractional.com/insights/methodology), and [rate benchmarks](https://www.gofractional.com/insights/rates) publish platform demand and rate data across a broad role set | Vendor-owned dataset and survey; the vendor's live count and methodology page do not currently agree | High for competitive existence | Do not claim first or only; do not charge individuals for a generic benchmark |
| Fractional executives pay for qualified opportunities | [FindaFractional pricing](https://www.findafractional.co.uk/platform-pricing): £40 monthly or £400 annual plus introduction and success fees | One UK marketplace's offer, not observed conversion data | Medium | Keep Pulse free for executives; revenue opportunity access is a different job |
| Staffing firms have an existing benchmark budget | [Staffing Industry Metrics packages](https://www.staffingindustrymetrics.com/packages.html): £1,800 or US$1,800 annual membership | A bundle with multiple features; listed price does not prove sales volume | Medium-high | Use as a lower organisational pricing anchor |
| Staffing associations charge material annual dues | [TechServe Alliance membership dues](https://techservealliance.org/updated-membership-dues/): US$1,495 to US$14,495 by company revenue | Membership includes more than insights | Medium | £6,000 annual membership is plausible enough to test, not validated |
| Executive placement decisions carry large economics | [Bolster pricing](https://www.bolster.com/pricing): US$2,500 upfront plus markup for on-demand talent and much higher board/search fees | Different service and business model | Medium | Benchmark can be framed against placement economics, not priced as a placement fee |
| PE has repeat interim-leadership need | [Heidrick & Struggles, 2026 High-End Independent Talent Report](https://www.heidrick.com/-/media/heidrickcom/files/attachments/2026-high-end-independent-talent-report.pdf?rev=11494cb97e73494f80b759b5fb4d72d7): interim leadership is 51% of PE project mix | One provider's project mix | Medium-high | PE portfolio teams are a secondary ICP after dataset maturity |
| Typical fractional engagements can support recurring firm economics | [Fractional Jobs hiring cost guide](https://www.fractionaljobs.io/help/how-much-does-fractional-talent-cost-to-hire): most leaders US$5,000 to US$10,000 per month, with role rate bands | Vendor estimate based on 100+ hires, not an independent study | Low-medium | Directional context only; do not use as a pricing proof |

## 11. 10X rubric verdict

The workbook's commercial rule is decisive: **measure money, not markup**. A polished public index is not a 10X business unless a named buyer pays to make a repeated decision differently. Evidence grades also matter: primary transactions and partner records are Grade A; named third-party evidence is Grade B; inference is Grade C; and assumptions are Grade D. Grade C or D claims cannot score above five.

The paid benchmark does **not yet pass the workbook's six hard gates**:

| Hard gate | Current verdict | Evidence required to pass |
|---|---|---|
| G1: Money moves | Fail today | Five qualified firms pay £1,500 for the same defined 90-day pilot |
| G2: Named buyer | Pass as a testable hypothesis | Economic buyer is the founder, CEO, managing director, or COO of a qualifying specialist fractional-talent firm |
| G3: Existing budget line | Provisional | Paid pilot purchase orders charged to market intelligence, research, operations, or membership budgets; listed third-party prices alone are not proof |
| G4: Collection barrier | Fail today | Privacy-safe engagement records from several independent firms, governed by data agreements and cohort suppression rules |
| G5: Winnable without capital | Pass for validation | Founder-led outreach, a narrow schema, and manual pilot delivery can test demand before platform investment |
| G6: Core data is not already free | Fail for the current public-source index | Proprietary partner-contributed engagement, rate, duration, fill-speed, and outcome data becomes the paid core |

Failing any hard gate prevents a 10X verdict. Therefore the present FWI should remain the free authority and acquisition layer; it should not be presented as a validated standalone subscription business. The only credible paying product is the private, multi-partner benchmark, and that remains a hypothesis until buyers transact and the collection barrier exists.

**Next commercial proof:** recruit ten named qualifying firms, secure ten data-sharing letters of intent, and close at least five standardised £1,500 pilots. Do not launch the £6,000 membership unless ten partners produce at least 500 verified engagements. Do not launch the £15,000 enterprise tier unless the dataset exceeds 1,500 verified engagements and supports privacy-safe cohorts. Individual fractional executives, publishers, and adtech companies remain readers or amplifiers, not the paying ICP.

## 12. Assumptions that would change the strategy

| Assumption | Evidence that would flip it | Consequence |
|---|---|---|
| Individuals will not pay for the FWI alone | At least 50 executives buy a benchmark-only subscription at a sustainable acquisition cost and retain for six months | Test a separate individual plan without gating the public index |
| Specialist firms will exchange data for benchmarks | Fewer than ten qualified firms sign a data-sharing letter after 25 conversations | Abandon the cross-partner benchmark or redesign the data exchange |
| £1,500 is an acceptable pilot price | Fewer than five qualified firms pay after seeing the proposed outputs | Change scope, price, or buyer before building ingestion |
| PE is a later, not first, ICP | Three or more portfolio talent teams fund pilots and provide usable multi-company data before specialist firms do | Move the PE cohort ahead in the roadmap |
| Public distribution helps enterprise sales | Partner applications and conversations do not correlate with public use over two quarters | Treat the index as a separate public-good product and find another acquisition channel |
