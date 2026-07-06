# North Star

Signed off 2026-07-06 (previously undocumented; this was Finding #1 of the product audit).

## The one outcome

> A solo fractional executive opens Pulse and, in one glance, knows whether this month's slow inbound is the market or them, and whether the market is heading toward a moment to raise rates or hold, with enough confidence to act.

Everything Pulse ships is graded against that sentence. A change that does not make that read faster, more personal, or more trustworthy is not a priority.

## The moat metric (the number that proves it)

> Weekly-returning Pro operators for whom the index changed a real decision: retained Pro accounts that open the dashboard on 3 or more of every 4 index-settle weeks.

This is a retention-and-utility metric, not a vanity or top-of-funnel metric. It can only move if the product is (a) personal enough to be about *me*, and (b) trustworthy enough to *act on*. MRR and active Pro subscribers remain the business scoreboard, but they are downstream of this.

## Why this, and not "MRR"

MRR is the business scoreboard; it does not tell you whether the product delivers its user outcome. A global market chart can gain a subscriber and lose them a month later without ever answering "is a slow month me or the market?". The moat metric forces the product to be personal (keyed to the user's fractional role and its live movers) and decision-grade (a clear read to act on), which is exactly what a global index alone cannot be.

## What this implies for the roadmap (from the audit)

- The product must know the user's lane. Signup now captures the fractional role; the readiness gauge and the "Ask the index" verdict read for that lane, not just the market.
- Monetization model (decided 2026-07-06, the audit's "sharper alternative"): the **human dashboard is free in full**, and Pulse charges for the **metered agent/enterprise API** plus data licensing. Rationale: the same read was already free and unauthenticated via the public API, so a human paywall protected nothing and `api_keys` had zero issued keys. The API is where willingness-to-pay and defensibility actually sit, and it is not cannibalized by the open human view. A human tier can be reintroduced by flipping `useProGate` if that ever changes.
- Trust surfaces must never contradict themselves (one synthesized read, honest deltas, no impossible source counts).
