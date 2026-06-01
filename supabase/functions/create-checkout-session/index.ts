// create-checkout-session: an authenticated user starts a Pulse Pro checkout.
// Every session is born attributed: app, stripe_account, anonymous_id, and UTM
// are stamped onto the session, the subscription, and (via the webhook) the
// customer, so revenue is separable from Circle on the shared account.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const STRIPE_KEY = Deno.env.get('PULSE_STRIPE_SECRET_KEY') || '';
const PRICE_MONTHLY = Deno.env.get('PULSE_PRICE_MONTHLY') || '';
const PRICE_ANNUAL = Deno.env.get('PULSE_PRICE_ANNUAL') || '';
const SITE = 'https://pulse.fractionl.ai';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function stripe(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || 'stripe_error');
  return j;
}

async function fetchFwiScore(): Promise<string> {
  // Best-effort live read of the current FWI from the public read endpoint, so
  // fwi_score_at_purchase is the real index value at the moment of intent rather
  // than a number the client supplied. Checkout must never fail because this did.
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/fwi-api/current`);
    if (!res.ok) return '';
    const j = await res.json();
    const overall = j?.score?.overall;
    return overall === undefined || overall === null ? '' : String(overall);
  } catch {
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!STRIPE_KEY || !PRICE_MONTHLY) return json({ error: 'billing_not_configured' }, 503);

  // Identify the user from their bearer token.
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return json({ error: 'unauthorized' }, 401);

  let plan = 'monthly';
  let attribution: Record<string, string> = {};
  try {
    const body = await req.json();
    plan = body.plan === 'annual' ? 'annual' : 'monthly';
    attribution = body.attribution || {};
  } catch { /* defaults */ }

  const price = plan === 'annual' ? PRICE_ANNUAL : PRICE_MONTHLY;
  if (!price) return json({ error: 'price_unavailable' }, 503);

  // Read the FWI live at session creation (client value is only a fallback).
  const fwiScore = (await fetchFwiScore()) || String(attribution.fwi_score || '');

  // Attribution stamped on every Stripe object so the purchase joins back to the
  // original landed event by anonymous_id, and Pulse stays separable from Circle.
  const meta: Record<string, string> = {
    app: 'pulse',
    stripe_account: 'fractionl_ai',
    supabase_user_id: user.id,
    anonymous_id: String(attribution.anonymous_id || ''),
    utm_source: String(attribution.utm_source || ''),
    utm_medium: String(attribution.utm_medium || ''),
    utm_campaign: String(attribution.utm_campaign || ''),
    utm_content: String(attribution.utm_content || ''),
    utm_term: String(attribution.utm_term || ''),
    fwi_score_at_purchase: fwiScore,
  };
  // For the Customer, drop empty values so a repeat checkout never clobbers a
  // good first-touch value with a blank.
  const customerMeta: Record<string, string> = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== ''),
  );

  try {
    // Find or create the Stripe customer for this user, stamping attribution
    // onto the customer in both the create and the reuse path.
    let customerId = '';
    const search = await fetch(`https://api.stripe.com/v1/customers/search?query=${encodeURIComponent(`metadata['supabase_user_id']:'${user.id}'`)}`, {
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    });
    const found = await search.json();
    if (found?.data?.length) customerId = found.data[0].id;
    if (!customerId) {
      const createParams: Record<string, string> = { email: user.email || '' };
      for (const [k, v] of Object.entries(customerMeta)) createParams[`metadata[${k}]`] = v;
      const cust = await stripe('customers', createParams);
      customerId = cust.id;
    } else {
      const updateParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(customerMeta)) updateParams[`metadata[${k}]`] = v;
      if (Object.keys(updateParams).length) await stripe(`customers/${customerId}`, updateParams);
    }

    const params: Record<string, string> = {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: `${SITE}/?checkout=success`,
      cancel_url: `${SITE}/?checkout=cancel`,
      allow_promotion_codes: 'true',
    };
    for (const [k, v] of Object.entries(meta)) {
      params[`metadata[${k}]`] = v;
      params[`subscription_data[metadata][${k}]`] = v;
    }

    const session = await stripe('checkout/sessions', params);
    return json({ url: session.url, id: session.id });
  } catch (err) {
    return json({ error: String(err).slice(0, 300) }, 500);
  }
});
