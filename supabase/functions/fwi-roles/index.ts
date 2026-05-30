// fwi-roles: per-role demand indices for the 6 fractional C-suite roles.
// Each role's demand index is the mean of its normalized demand signals (Adzuna
// job postings + SerpAPI Google Jobs cross-check) for the latest week, on the
// same 0-100 scale as the FWI demand pillar. Honest framing: this is the DEMAND
// reading for the role, set in the context of the overall weekly FWI. No auth.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

const ROLES: Record<string, string> = { cfo: 'Fractional CFO', cmo: 'Fractional CMO', cto: 'Fractional CTO', coo: 'Fractional COO', cro: 'Fractional CRO', ceo: 'Interim CEO' };
function band(s: number) { if (s >= 75) return 'Surging'; if (s >= 60) return 'Growing'; if (s >= 45) return 'Stable'; if (s >= 30) return 'Cooling'; return 'Contracting'; }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const { data: latest } = await supabase.from('fwi_scores').select('date, overall_score').order('date', { ascending: false }).limit(1).maybeSingle();
  const overall = latest?.overall_score != null ? Math.round(latest.overall_score * 10) / 10 : null;

  // Latest date that actually has per-role demand signals.
  const { data: dRows } = await supabase
    .from('signals')
    .select('date, category, normalized_value')
    .eq('signal_type', 'demand')
    .in('category', Object.keys(ROLES))
    .order('date', { ascending: false })
    .limit(120);

  const asOf = dRows && dRows.length ? dRows[0].date : latest?.date ?? null;
  const forDate = (dRows || []).filter((r) => r.date === asOf);

  const roles = Object.keys(ROLES).map((key) => {
    const vals = forDate.filter((r) => r.category === key).map((r) => Number(r.normalized_value)).filter((n) => !isNaN(n));
    const demand = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
    return { role: key, label: ROLES[key], slug: `fractional-${key}`, demand, band: demand != null ? band(demand) : null };
  });

  return new Response(JSON.stringify({
    asOf,
    overall: { score: overall, band: overall != null ? band(overall) : null },
    note: 'Per-role demand index (0-100) from Adzuna + SerpAPI Google Jobs for the week, in the context of the overall weekly FWI. The Form D Lead is a 1 to 3 month leading indicator of demand.',
    roles,
  }, null, 2), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } });
});
