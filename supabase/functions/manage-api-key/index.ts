// manage-api-key: self-serve API key issuance for the metered agent API.
//
// The human dashboard is free; Pulse monetizes the API. A signed-in user can mint
// a key here (free tier, 1k req/day), list their keys with usage, and revoke one.
// The plaintext key is shown exactly once at creation; only its SHA-256 hash is
// stored. Paid tiers (higher limits) are set out of band (billing), not self-serve.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const FREE_DAILY_LIMIT = 1000;
const MAX_KEYS_PER_USER = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'pk_live_' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Identify the caller from their user JWT (verify_jwt is off; we validate here).
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return json({ error: 'unauthorized' }, 401);

  try {
    if (req.method === 'GET') {
      const { data } = await admin
        .from('api_keys')
        .select('id, label, tier, requests_used, requests_limit, created_at, last_used_at, is_active')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return json({ keys: data ?? [] });
    }

    if (req.method === 'POST') {
      const { count } = await admin
        .from('api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);
      if ((count ?? 0) >= MAX_KEYS_PER_USER) return json({ error: 'key_limit_reached' }, 400);
      let label = 'API key';
      try { const b = await req.json(); if (b?.label) label = String(b.label).slice(0, 60); } catch { /* default */ }
      const key = newKey();
      const key_hash = await sha256Hex(key);
      const { error: insErr } = await admin.from('api_keys').insert({
        user_id: user.id, key_hash, label, tier: 'free', requests_limit: FREE_DAILY_LIMIT, requests_used: 0, is_active: true,
      });
      if (insErr) return json({ error: insErr.message }, 500);
      // Plaintext key returned once and never stored.
      return json({ key, label, tier: 'free', daily_limit: FREE_DAILY_LIMIT });
    }

    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id');
      if (!id) return json({ error: 'missing_id' }, 400);
      // Scope the revoke to the caller's own key.
      const { error: upErr } = await admin.from('api_keys').update({ is_active: false }).eq('id', id).eq('user_id', user.id);
      if (upErr) return json({ error: upErr.message }, 500);
      return json({ revoked: true });
    }

    return json({ error: 'method_not_allowed' }, 405);
  } catch (err) {
    return json({ error: String(err).slice(0, 200) }, 500);
  }
});
