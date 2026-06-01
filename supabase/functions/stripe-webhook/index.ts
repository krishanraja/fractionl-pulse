// stripe-webhook: records Pulse Pro subscriptions and emits revenue lifecycle
// events. Lives on the Fractionl AI account that is SHARED with Circle, so it
// filters strictly to events whose metadata.app === 'pulse' and ignores the
// rest. Signature-verified (Web Crypto HMAC), idempotent on event.id.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const STRIPE_KEY = Deno.env.get('PULSE_STRIPE_SECRET_KEY') || '';
const WEBHOOK_SECRET = Deno.env.get('PULSE_STRIPE_WEBHOOK_SECRET') || '';
const EMIT_URL = `${SUPABASE_URL}/functions/v1/emit-event`;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const enc = new TextEncoder();

async function verifySignature(rawBody: string, sigHeader: string | null): Promise<boolean> {
  if (!sigHeader || !WEBHOOK_SECRET) return false;
  const parts = sigHeader.split(',');
  const t = parts.find((p) => p.startsWith('t='))?.slice(2);
  const sigs = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || sigs.length === 0) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.includes(expected);
}

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
  return res.ok ? res.json() : null;
}

async function emit(event: string, dedupeKey: string, extra: Record<string, unknown>) {
  try {
    await fetch(EMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'pulse', stripe_account: 'fractionl_ai', event,
        occurred_at: new Date().toISOString(), dedupe_key: dedupeKey, ...extra,
      }),
    });
  } catch { /* emit-event no-ops until OS wires it */ }
}

function isPulse(obj: any): boolean {
  return obj?.metadata?.app === 'pulse';
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const rawBody = await req.text();
  const ok = await verifySignature(rawBody, req.headers.get('stripe-signature'));
  if (!ok) return new Response('invalid signature', { status: 400 });

  let evt: any;
  try { evt = JSON.parse(rawBody); } catch { return new Response('bad json', { status: 400 }); }

  // Idempotency: claim the event id; if already present, skip.
  const claim = await supabase.from('processed_stripe_events').insert({ event_id: evt.id });
  if (claim.error) {
    // unique violation = already processed
    return new Response(JSON.stringify({ status: 'duplicate' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const type = evt.type as string;
  const obj = evt.data?.object || {};

  try {
    if (type === 'checkout.session.completed') {
      if (!isPulse(obj)) return new Response('ignored (not pulse)', { status: 200 });
      const userId = obj.client_reference_id || obj.metadata?.supabase_user_id || null;
      const subId = obj.subscription;
      const customerId = obj.customer;
      let priceId = null, periodEnd = null, status = 'active';
      if (subId) {
        const sub = await stripeGet(`subscriptions/${subId}`);
        priceId = sub?.items?.data?.[0]?.price?.id || null;
        periodEnd = sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        status = sub?.status || 'active';
        // Stamp attribution onto the subscription + customer for permanence.
        const meta = obj.metadata || {};
        const md = Object.entries(meta).map(([k, v]) => `metadata[${k}]=${encodeURIComponent(String(v))}`).join('&');
        if (md) {
          await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, { method: 'POST', headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: md });
          if (customerId) await fetch(`https://api.stripe.com/v1/customers/${customerId}`, { method: 'POST', headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: md });
        }
      }
      if (userId) {
        await supabase.from('subscriptions').upsert({
          user_id: userId, stripe_customer_id: customerId, stripe_subscription_id: subId,
          price_id: priceId, tier: 'pro', status, current_period_end: periodEnd,
          metadata: obj.metadata || {}, updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' });
      }
      await emit('purchased', `pulse:purchased:${subId}:${obj.id}`, {
        user_id: userId, anonymous_id: obj.metadata?.anonymous_id, stripe_customer_id: customerId,
        stripe_subscription_id: subId, amount_cents: obj.amount_total, currency: obj.currency || 'usd',
        utm_source: obj.metadata?.utm_source, utm_medium: obj.metadata?.utm_medium, utm_campaign: obj.metadata?.utm_campaign,
        utm_content: obj.metadata?.utm_content, utm_term: obj.metadata?.utm_term,
        metadata: { price_id: priceId, fwi_score_at_purchase: obj.metadata?.fwi_score_at_purchase },
      });
    } else if (type === 'customer.subscription.updated') {
      if (!isPulse(obj)) return new Response('ignored', { status: 200 });
      await supabase.from('subscriptions').update({
        status: obj.status,
        current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
        price_id: obj.items?.data?.[0]?.price?.id || null,
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', obj.id);
    } else if (type === 'customer.subscription.deleted') {
      if (!isPulse(obj)) return new Response('ignored', { status: 200 });
      await supabase.from('subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('stripe_subscription_id', obj.id);
      await emit('churned', `pulse:churned:${obj.id}`, { stripe_subscription_id: obj.id, anonymous_id: obj.metadata?.anonymous_id });
    } else if (type === 'invoice.payment_succeeded') {
      // Renewal. Resolve the subscription to confirm it is Pulse before emitting.
      const subId = obj.subscription;
      if (subId) {
        const sub = await stripeGet(`subscriptions/${subId}`);
        if (sub && isPulse(sub)) {
          await emit('purchased', `pulse:purchased:${subId}:${obj.id}`, {
            stripe_subscription_id: subId, stripe_customer_id: obj.customer,
            amount_cents: obj.amount_paid, currency: obj.currency || 'usd',
            anonymous_id: sub.metadata?.anonymous_id, metadata: { renewal: true },
          });
        }
      }
    } else if (type === 'charge.refunded') {
      // Refunds carry charge metadata, not our subscription metadata, so resolve
      // the Pulse attribution from the customer we stamped at checkout.
      const customerId = obj.customer;
      const customer = customerId ? await stripeGet(`customers/${customerId}`) : null;
      if (!customer || !isPulse(customer)) return new Response('ignored (not pulse)', { status: 200 });
      // Best-effort subscription id from the refunded charge's invoice.
      let refundSubId = null;
      if (obj.invoice) {
        const inv = await stripeGet(`invoices/${obj.invoice}`);
        refundSubId = inv?.subscription || null;
      }
      const cmeta = customer.metadata || {};
      await emit('refunded', `pulse:refunded:${obj.id}`, {
        anonymous_id: cmeta.anonymous_id,
        stripe_customer_id: customerId, stripe_subscription_id: refundSubId,
        amount_cents: obj.amount_refunded, currency: obj.currency || 'usd',
        utm_source: cmeta.utm_source, utm_medium: cmeta.utm_medium, utm_campaign: cmeta.utm_campaign,
        utm_content: cmeta.utm_content, utm_term: cmeta.utm_term,
        metadata: { fwi_score_at_purchase: cmeta.fwi_score_at_purchase, charge_id: obj.id },
      });
    }
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    // Roll back the idempotency claim so Stripe can retry.
    await supabase.from('processed_stripe_events').delete().eq('event_id', evt.id);
    return new Response(JSON.stringify({ status: 'error', detail: String(err).slice(0, 300) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
