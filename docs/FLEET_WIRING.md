# Fleet Wiring (Pulse to Mindmaker OS)

This is the handoff contract for a separate Mindmaker OS session to verify that Fractionl Pulse is wired into the fleet correctly. It is written to be precise and truth-disciplined. Pulse is the free, citable, agent-readable Fractional Working Index (FWI) and the lead funnel for the paid sibling product Circle (fractionl.com). Both share the Fractionl AI Stripe account, so they must be separable downstream by `app` plus `stripe_account`.

- Repo: `C:\Users\krish\MindmakerOS-Apps\fractionl-pulse`
- Live site: https://pulse.fractionl.ai
- Pulse Supabase project ref: `dtlcprcpvdomrehbejhw`
- Mindmaker OS warehouse Supabase project ref: `gojpffsrxybbpbdzzrvs`
- Last updated: 2026-05-30

---

## 1. Status summary

### LIVE now

- **No-auth public agent API (fixed 2026-05-30).** We added `supabase/config.toml` with `verify_jwt = false` for `fwi-api` and `export-brief`, then redeployed `fwi-api`. The exact documented bare curl now returns HTTP 200. Previously the gateway returned 401 `UNAUTHORIZED_NO_AUTH_HEADER`. The agent-native, query-in-two-minutes, no-auth claim is now true.
  - `GET /fwi-api/current` (no auth): latest weekly composite, components, weights, delta30d, top movers, full source breakdown, and meta (dataCompleteness, nextUpdate). Returns `Cache-Control`, `X-FWI-Score`, and `X-FWI-Label` headers.
  - `GET /fwi-api/history?months=N` (no auth, N clamped 1 to 12): weekly data points.
- **No-auth brief export (`export-brief`).** `GET /export-brief?format=markdown` (default, downloadable .md) or `?format=json`. Press and cite ready weekly brief, also covered by `verify_jwt = false`.
- **Machine-readable discovery surfaces** (live, HTTP 200): `/product-truth.json`, `/llms.txt`, `/.well-known/ai-plugin.json`.
- **Hosted MCP server (live, verified).** `POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp`, Streamable HTTP JSON-RPC 2.0, no auth. Tools: `get_fractional_working_index`, `get_fwi_weekly_brief`. `initialize`, `tools/list`, and `tools/call` verified.
- **Build-time prerender + Dataset JSON-LD (live).** `dist/index.html` now ships the live FWI in the title and OG, a canonical tag, schema.org Dataset + Organization JSON-LD, and a `<noscript>` content block. Re-runs each deploy. Closed the blank-first-paint gap.
- **RLS write hole closed (migration 006 applied + verified).** anon writes to `fwi_scores`/`movers`/`cached_insights`/`data_source_health`/`pipeline_runs` now denied (401); reads preserved; `pipeline_runs`/`api_keys` revoked from public roles.
- **Attribution capture (client) + emit-event proxy (deployed).** First-touch UTM + anonymous_id captured on first paint; `landed`/`signed_up`/`activated` wired; the `emit-event` edge proxy is deployed and no-ops until the OS sets the ingest secret.

### PENDING (not yet built or not yet wired end to end)

- **Stripe self-serve checkout.** Not yet built. Conversions route to the waitlist with manual onboarding, and founding pricing locks the rate. Needs the Pro product/price, `PULSE_STRIPE_WEBHOOK_SECRET`, the checkout + webhook functions, an entitlements layer, and Pro-feature gating. When checkout ships, the offer flips to "Pro checkout LIVE".
- **Attribution end to end.** The Pulse emit side is built and deployed; it stays a no-op until the OS stands up `ingest-attribution` and the `ATTRIBUTION_INGEST_SECRET` + `ATTRIBUTION_INGEST_URL` (Pulse project) and `VITE_ATTRIBUTION_EMIT_URL` (Pulse Vercel env) are set. See sections below.

---

## 2. Product-truth source

`/product-truth.json` is the runtime sell source for Pulse. It is the single machine-readable description of what Pulse is, what it costs, what is live versus pending, and what an agent can do with it right now.

- **Where it lives:** served at `https://pulse.fractionl.ai/product-truth.json` (static asset under the Pulse `public/` directory, deployed with the site). Companions: `https://pulse.fractionl.ai/llms.txt` and `https://pulse.fractionl.ai/.well-known/ai-plugin.json`.
- **Schema (top-level keys):**
  - `product`: name, one-line description, publisher (Fractionl, a private composite), live URL.
  - `what_it_is`: the FWI as a weekly 0 to 100 composite market-health score for the fractional executive market (6 C-suite roles only: fractional CFO, CMO, CTO, COO, CRO, interim CEO), blended from 21 sources across three pillars (Demand 50%, Supply 20%, Culture 30%; supply weight redistributes when supply has no data).
  - `api`: base URL, the no-auth endpoints, the example bare curl, and the no-auth status flag.
  - `pricing`: Free, Pro ($99/mo or $79/mo billed annually), Enterprise SaaS (caps at $5,000/mo), white-label partnership (a separate program), data feed license, citation license, affiliate.
  - `offer_now`: waitlist plus founding-customer pricing; Stripe self-serve checkout not yet live.
  - `named_method`: the Form D Lead.
  - `agent_surfaces`: no-auth REST API (working), Markdown brief export (working), two MCP tools, hosted MCP server (live).
  - `truth_discipline`: the do-not-say list (no years of history, no peer-review or backtesting claims, no specific predictive-accuracy percentage, no "real-time market intelligence", no role beyond the 6 C-suite roles, not official or institutional, supply went live after the People Data Labs integration).
  - `current_reading`: instruction to fetch live from `/fwi-api/current` rather than trust a snapshot (the live reading near publication is about FWI 42.4, label Cooling, as of 2026-05-25, but this must be fetched live).
- **Rule for the OS fleet:** OS agents (Maya, Leo, outbound and content agents) must **fetch `/product-truth.json` at use time** rather than relying on a hardcoded snapshot. The same rule applies to the live FWI reading: fetch `/fwi-api/current`, do not hardcode the number. This keeps fleet copy and pricing in sync with Pulse without a redeploy of the OS.

---

## 3. Attribution contract (the core thing the OS must wire)

Pulse emits lifecycle events to the Mindmaker OS warehouse via a single ingest endpoint. This is the canonical contract.

- **Warehouse:** Mindmaker OS Supabase `gojpffsrxybbpbdzzrvs`.
- **Transport:** Pulse POSTs JSON to the OS ingest-attribution edge function, authenticated with an `x-attribution-secret` header.
- **Events:** `landed`, `signed_up`, `activated`, `purchased`, `refunded`, `churned`.
- **Constant on every event:** `app = "pulse"` and `stripe_account = "fractionl_ai"`.
- **Identity stitching:** a first-party anonymous_id is generated at first paint, persisted client-side, carried through signup (attached to `user_id` once known), and stamped into Stripe metadata at checkout so the purchase event can be joined back to the landing event.
- **Activation definition (real value, not a vanity ping):** the user saw the score, exported a brief, or made an authenticated API call.

### Event field list

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (uuid) | Pulse-generated event id. |
| `occurred_at` | string (ISO 8601) | When the event happened, not when it was received. |
| `app` | string | Always `pulse`. |
| `event` | string | One of: landed, signed_up, activated, purchased, refunded, churned. |
| `anonymous_id` | string | First-party id from first paint, stitched through signup to Stripe. |
| `user_id` | string or null | Pulse user id once known. |
| `email` | string or null | Set at signup or from Stripe. |
| `utm_source` | string or null | Captured from landing URL. |
| `utm_medium` | string or null | |
| `utm_campaign` | string or null | |
| `utm_content` | string or null | |
| `utm_term` | string or null | |
| `campaign_id` | string or null | Internal campaign id if present. |
| `agent` | string or null | The OS agent that drove the touch (for example Maya, Leo) if known. |
| `referrer` | string or null | Document referrer at landing. |
| `landing_path` | string or null | First path on the Pulse site. |
| `stripe_account` | string | Always `fractionl_ai`. |
| `stripe_customer_id` | string or null | Set on purchase, refund, churn. |
| `stripe_subscription_id` | string or null | Set on purchase, refund, churn. |
| `amount_cents` | integer or null | Monetary amount where applicable. |
| `currency` | string or null | For example `usd`. |
| `metadata` | object | Free-form, includes `fwi_score_at_purchase` and any extra context. |
| `dedupe_key` | string | Idempotency key; the OS upserts on this. |

### Ownership boundary (do not blur this)

- The **OS repo owns** the ingest-attribution function **and** the attribution schema. Pulse **never migrates** the warehouse schema.
- Pulse holds **only** `ATTRIBUTION_INGEST_SECRET`. Pulse **never** holds the OS service-role key.

---

## 4. What the OS session must provide and stand up

1. **Ingest-attribution edge function** on `gojpffsrxybbpbdzzrvs`, guarded by the `x-attribution-secret` header, performing an **idempotent upsert on `dedupe_key`** (re-delivery of the same event is a no-op).
2. **Attribution schema plus read views.** The events table, plus at minimum:
   - `funnel_by_campaign`: landed to signed_up to activated to purchased counts, sliced by campaign and utm.
   - `revenue_by_campaign`: revenue rolled up by campaign, **spanning both Stripe accounts** (Pulse and Circle share the Fractionl AI account; other fleet apps may use other accounts), separable by `app` plus `stripe_account`.
3. **The `ATTRIBUTION_INGEST_SECRET` value to hand to Pulse**, so Pulse can set it as a secret and begin emitting.
4. **Pulse-to-Circle lineage read-back.** Because Pulse and Circle share the Fractionl AI Stripe account, the OS must confirm it can read `referred_from = pulse` lineage and separate the two products by `app` plus `stripe_account`. Pulse is the funnel; Circle is the paid sibling; the warehouse must show Pulse-sourced revenue landing in Circle.

---

## 5. Stripe wiring open items

- **`PULSE_STRIPE_WEBHOOK_SECRET` is not yet set.** It must be created and stored as a Pulse secret before checkout goes live.
- **Pulse product plus price must be created** on the Fractionl AI account: Pro at $99/mo and $79/yr (the annual rate is billed annually).
- **Checkout session plus webhook must stamp attribution metadata** onto the Stripe Customer and Subscription: `app`, `stripe_account`, `anonymous_id`, the `utm_*` set, and `fwi_score_at_purchase`. This is what lets the `purchased` event join back to the original `landed` event.
- **The webhook must be idempotent on `event.id`** (Stripe re-delivers; a repeated event id must not double-count).
- Stripe account: Fractionl AI (shared with Circle). Billing contact: data@fractionl.ai.

---

## 6. Verification checklist (the OS session can run this)

1. **API is genuinely no-auth (expect HTTP 200, no Authorization header):**
   ```bash
   curl -i https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current
   ```
   Confirm 200, a JSON body with `score.overall` and `score.label`, and the `X-FWI-Score` / `X-FWI-Label` / `Cache-Control` headers.

2. **History endpoint (no auth, N clamped 1 to 12):**
   ```bash
   curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/history?months=6"
   ```

3. **Brief export (no auth, both formats):**
   ```bash
   curl https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief
   curl "https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief?format=json"
   ```

4. **Machine-readable surfaces resolve:**
   ```bash
   curl https://pulse.fractionl.ai/product-truth.json
   curl https://pulse.fractionl.ai/llms.txt
   curl https://pulse.fractionl.ai/.well-known/ai-plugin.json
   ```
   Confirm `/product-truth.json` parses as JSON and carries the pricing, offer_now, named_method, and truth_discipline keys.

5. **Trigger endpoint is NOT public (expect non-200 without service-role bearer):**
   ```bash
   curl -i -X POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/trigger
   ```
   Confirm it is rejected without the service-role bearer.

6. **Event emission round-trip (once Pulse is emitting):** generate a `landed` then `signed_up` then `activated` sequence with a shared `anonymous_id`, POST to the OS ingest endpoint with the `x-attribution-secret` header, then read `funnel_by_campaign` and confirm the rows appear once (re-POST the same `dedupe_key` and confirm no duplicate).

7. **Stripe metadata round-trip (once checkout is live):** complete a test checkout, then confirm the Stripe Customer and Subscription carry `app=pulse`, `stripe_account=fractionl_ai`, `anonymous_id`, the `utm_*` set, and `fwi_score_at_purchase`, and that the webhook produced exactly one `purchased` event (idempotent on `event.id`) joinable back to the original `landed` event by `anonymous_id`.
