// emit-event: Pulse attribution proxy.
//
// The browser (src/lib/attribution.ts) POSTs lifecycle events here. This proxy
// holds the warehouse ingest secret server-side and forwards validated events to
// the central Mindmaker OS warehouse ingest function. The browser never sees the
// secret. See docs/FLEET_WIRING.md for the full contract.
//
// Until the OS provides ATTRIBUTION_INGEST_URL + ATTRIBUTION_INGEST_SECRET, this
// function returns 200 {status:"noop"} so the client emit is a safe no-op and
// nothing in the app breaks while the cross-system wiring is completed.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const APP = 'pulse';
const STRIPE_ACCOUNT = 'fractionl_ai';
const ALLOWED_EVENTS = new Set([
  'landed', 'signed_up', 'activated', 'purchased', 'refunded', 'churned',
]);

const INGEST_URL = Deno.env.get('ATTRIBUTION_INGEST_URL') || '';
const INGEST_SECRET = Deno.env.get('ATTRIBUTION_INGEST_SECRET') || '';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  // Minimal validation. The warehouse ingest is the authoritative validator and
  // dedupes on dedupe_key; this is a light first gate.
  const event = String(payload.event || '');
  if (!ALLOWED_EVENTS.has(event)) return json({ error: 'invalid_event' }, 400);
  if (!payload.anonymous_id) return json({ error: 'missing_anonymous_id' }, 400);
  if (!payload.dedupe_key) return json({ error: 'missing_dedupe_key' }, 400);

  // Force the keying so a forged body cannot mis-attribute to another app/account.
  const enriched = {
    ...payload,
    app: APP,
    stripe_account: STRIPE_ACCOUNT,
    received_at: new Date().toISOString(),
  };

  // Not yet wired by the OS: accept and no-op so the client never errors.
  if (!INGEST_URL || !INGEST_SECRET) {
    return json({ status: 'noop', reason: 'attribution ingest not configured' }, 200);
  }

  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-attribution-secret': INGEST_SECRET,
      },
      body: JSON.stringify(enriched),
    });
    if (!res.ok) {
      const text = await res.text();
      return json({ status: 'forward_failed', upstream_status: res.status, detail: text.slice(0, 500) }, 502);
    }
    return json({ status: 'forwarded' }, 200);
  } catch (err) {
    return json({ status: 'forward_error', detail: String(err).slice(0, 500) }, 502);
  }
});
