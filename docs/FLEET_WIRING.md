# Fleet Wiring (Pulse to Mindmaker OS)

This is the handoff contract for a separate Mindmaker OS session to verify that Fractionl Pulse is wired into the fleet correctly. It is written to be precise and truth-disciplined. Pulse is the free, citable, agent-readable Fractional Working Index (FWI). Its commercial hypothesis is a partner benchmark for specialist fractional-talent firms, not a consumer plan, paid generic API, adtech offer, or publisher product. Pulse and the separate Fractionl Circle product must remain distinguishable downstream by `app` plus `stripe_account`.

> **Domain correction (2026-08-05):** earlier revisions of this doc and of `/llms.txt` and `/product-truth.json` pointed at `fractionl.com` for Circle. That is wrong: `fractionl.com` is an unrelated business. Circle is at `circle.fractionl.ai`, and the Fractionl brand site is `fractionl.ai`. All machine-readable surfaces have been corrected.

- Repo: `https://github.com/krishanraja/fractionl-pulse`
- Live site: https://pulse.fractionl.ai
- Pulse Supabase project ref: `dtlcprcpvdomrehbejhw`
- Mindmaker OS warehouse Supabase project ref: `gojpffsrxybbpbdzzrvs`
- Last updated: 2026-08-11

---

## 1. Status summary

### LIVE now

- **Free public instrument and operational API keys.** The dashboard, REST API, and MCP tools are free. `fwi-api` accepts an optional `x-api-key` for per-key rate accounting; a signed-in user can self-serve a free key (1,000 requests/day) via `manage-api-key` (plaintext shown once, SHA-256 hash stored). This is an operational control, not the paid product. The Founding Benchmark Partner pilot is the current commercial validation offer. See `docs/CORPORATE_STRATEGY.md`.
- **No-auth public agent API (fixed 2026-05-30).** We added `supabase/config.toml` with `verify_jwt = false` for `fwi-api` and `export-brief`, then redeployed `fwi-api`. The exact documented bare curl now returns HTTP 200. Previously the gateway returned 401 `UNAUTHORIZED_NO_AUTH_HEADER`. The agent-native, query-in-two-minutes, no-auth claim is now true.
  - `GET /fwi-api/current` (no auth): latest score observation, components, weights, delta30d, top movers, source breakdown, and meta fields. `meta.nextUpdate` is a legacy next-Sunday marker. Returns `Cache-Control`, `X-FWI-Score`, and `X-FWI-Label` headers.
  - `GET /fwi-api/history?months=N` (no auth, N clamped 1 to 12): observed score rows across the requested period.
- **No-auth brief export (`export-brief`).** `GET /export-brief?format=markdown` (default, downloadable .md) or `?format=json`. Press and cite ready weekly brief, also covered by `verify_jwt = false`.
- **Machine-readable discovery surfaces** (live, HTTP 200): `/product-truth.json`, `/llms.txt`, `/.well-known/ai-plugin.json`.
- **Hosted MCP server (live).** `POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp`, stateless Streamable HTTP JSON-RPC 2.0, no auth. Tools: `get_fractional_working_index`, `get_fwi_weekly_brief`, `get_content_radar`, and `get_content_brief`. The server supports MCP `2026-07-28` and the legacy `2024-11-05` initialize flow.
- **Build-time prerender + Dataset JSON-LD (live).** `dist/index.html` ships the FWI available at build time in the title and social metadata, plus a canonical tag, schema.org Dataset and Organization JSON-LD, and a `<noscript>` content block. It refreshes on deployment. Migration 009 defines a `pulse-daily-redeploy` job, but production `pg_cron` readback on 11 August 2026 did not show that job, so documentation must not claim a daily redeploy is active.
- **RLS write hole closed (migration 006 applied + verified).** anon writes to `fwi_scores`/`movers`/`cached_insights`/`data_source_health`/`pipeline_runs` now denied (401); reads preserved; `pipeline_runs`/`api_keys` revoked from public roles.
- **Attribution capture (client) + emit-event proxy (deployed).** First-touch UTM + anonymous_id captured on first paint; `landed`/`signed_up`/`activated` wired; the `emit-event` edge proxy is deployed and no-ops until the OS sets the ingest secret.

### PENDING (not yet built or not yet wired end to end)

- **Partner benchmark ingestion and billing.** Data-processing terms, the partner data dictionary, suppression rules, cohort-quality checks, pilot invoicing, and annual-plan billing are not yet wired end to end. Do not reactivate the consumer Stripe checkout for this offer.
- **Attribution end to end.** The Pulse emit side is built and deployed; it stays a no-op until the OS stands up `ingest-attribution` and the `ATTRIBUTION_INGEST_SECRET` + `ATTRIBUTION_INGEST_URL` (Pulse project) and `VITE_ATTRIBUTION_EMIT_URL` (Pulse Vercel env) are set. See sections below.

---

## 2. Product-truth source

`/product-truth.json` is the runtime sell source for Pulse. It is the single machine-readable description of what Pulse is, what it costs, what is live versus pending, and what an agent can do with it right now.

- **Where it lives:** served at `https://pulse.fractionl.ai/product-truth.json` (static asset under the Pulse `public/` directory, deployed with the site). Companions: `https://pulse.fractionl.ai/llms.txt` and `https://pulse.fractionl.ai/.well-known/ai-plugin.json`.
- **Schema (top-level keys):**
  - `product`: product, index, publisher, URLs, and contact.
  - `strategy`: free audience, primary and secondary paying ICPs, exclusions, buyer pains, partner fields, commercial thesis, and moat metric.
  - `coverage`: roles, geography, weights, tracked inputs, cadence, history, and private-publisher status.
  - `offers`: free public instrument; application-only £1,500 pilot; conditional £6,000 annual membership; conditional enterprise plan from £15,000.
  - `validation`: 25 qualified conversations, ten data-sharing letters of intent, five paid pilots, and a path to 500 verified records by 31 October 2026.
  - `api`: no-auth public reads plus optional operational `x-api-key` controls. The API is not the paid product.
  - `live_product` and `not_live`: current routes, account and key behaviour, dormant legacy infrastructure, and unshipped benchmark capabilities.
  - `commercial_operations`: what an autonomous agent may prepare and which external actions require separate authority.
  - `competitive_truth`: Go Fractional already publishes free role, demand, and compensation benchmarks. Pulse must not claim first, only, or no competitor.
  - `discovery`: four MCP tools and the live hosted MCP server.
  - `do_not_say`: no adtech or publisher ICP, no consumer Pro or generic paid API, no unvalidated plan availability, and the existing methodology and coverage limits.
- **Rule for the OS fleet:** OS agents (Maya, Leo, outbound and content agents) must **fetch `/product-truth.json` at use time** rather than relying on a hardcoded snapshot. The same rule applies to the live FWI reading: fetch `/fwi-api/current`, do not hardcode the number. This keeps fleet copy and pricing in sync with Pulse without a redeploy of the OS.

---

## 3. Attribution contract (the core thing the OS must wire)

Pulse emits lifecycle events to the Mindmaker OS warehouse via a single ingest endpoint. This is the canonical contract.

- **Warehouse:** Mindmaker OS Supabase `gojpffsrxybbpbdzzrvs`.
- **Transport:** Pulse POSTs JSON to the OS ingest-attribution edge function, authenticated with an `x-attribution-secret` header.
- **Event vocabulary:** `landed`, `signed_up`, `activated`, `purchased`, `refunded`, `churned`. The active Pulse client emits the first three. The commercial checkout is dormant, so the last three are contract vocabulary, not an active Pulse purchase flow.
- **Constant on every event:** `app = "pulse"` and `stripe_account = "fractionl_ai"`.
- **Identity stitching:** a first-party `anonymous_id` is generated at first paint, persisted client-side, and carried through signup. The legacy contract can carry the identifier into Stripe metadata, but Pulse does not currently operate a consumer checkout.
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

## 5. Commercial wiring open items

Do not reactivate the retired consumer Pro checkout. The current commercial path requires a new partner-specific design:

- Signed pilot and data-sharing agreements before invoicing
- A partner account and entitlement model separate from public-user accounts
- Manual invoicing for the £1,500 validation pilot until the offer converts reliably
- Partner, pilot, and product metadata on every payment and lifecycle event
- Idempotent payment-event ingestion keyed by provider event id
- No annual membership checkout before its dataset release gate is met

The Fractionl AI Stripe account may be reused only after the partner product, tax treatment, invoice flow, and entitlement boundaries are approved. Billing contact: data@fractionl.ai.

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
   Confirm `/product-truth.json` parses as JSON and carries the `product`, `strategy`, `coverage`, `offers`, `validation`, `api`, `discovery`, `competitive_truth`, and `do_not_say` keys.

5. **Trigger endpoint is NOT public (expect non-200 without service-role bearer):**
   ```bash
   curl -i -X POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/trigger
   ```
   Confirm it is rejected without the service-role bearer.

6. **Event emission round-trip (once Pulse is emitting):** generate a `landed` then `signed_up` then `activated` sequence with a shared `anonymous_id`, POST to the OS ingest endpoint with the `x-attribution-secret` header, then read `funnel_by_campaign` and confirm the rows appear once (re-POST the same `dedupe_key` and confirm no duplicate).

7. **Stripe metadata round-trip (once checkout is live):** complete a test checkout, then confirm the Stripe Customer and Subscription carry `app=pulse`, `stripe_account=fractionl_ai`, `anonymous_id`, the `utm_*` set, and `fwi_score_at_purchase`, and that the webhook produced exactly one `purchased` event (idempotent on `event.id`) joinable back to the original `landed` event by `anonymous_id`.
