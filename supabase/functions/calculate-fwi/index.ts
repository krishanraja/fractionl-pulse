import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://fractionl.ai',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Weights: Demand 50%, Supply 30%, Momentum 20%
const WEIGHTS = { demand: 0.5, supply: 0.3, momentum: 0.2 };

const getFWILabel = (score: number) => {
  if (score >= 75) return 'Surging';
  if (score >= 60) return 'Growing';
  if (score >= 45) return 'Stable';
  if (score >= 30) return 'Cooling';
  return 'Contracting';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const targetDate = new URL(req.url).searchParams.get('date') || new Date().toISOString().slice(0, 10);

  try {
    // Fetch today's signals
    const { data: signals, error: sigError } = await supabase
      .from('signals')
      .select('signal_type, category, normalized_value')
      .eq('date', targetDate)
      .is('error', null);

    if (sigError) throw sigError;

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ error: 'No signals found for date', date: targetDate }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Aggregate by signal type
    const byType: Record<string, number[]> = { demand: [], supply: [], momentum: [] };
    for (const sig of signals) {
      if (sig.category !== 'overall' && byType[sig.signal_type]) {
        byType[sig.signal_type].push(sig.normalized_value || 0);
      }
    }

    // Average each type
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 50;
    const demandScore = avg(byType.demand);
    const supplyScore = avg(byType.supply);
    const momentumScore = avg(byType.momentum);

    // Composite FWI score
    const overallScore =
      demandScore * WEIGHTS.demand +
      supplyScore * WEIGHTS.supply +
      momentumScore * WEIGHTS.momentum;

    // Calculate top movers
    const roleCounts: Record<string, { category: string; demand: number; supply: number }> = {};
    for (const sig of signals.filter(s => s.category !== 'overall')) {
      if (!roleCounts[sig.category]) roleCounts[sig.category] = { category: sig.category, demand: 0, supply: 0 };
      if (sig.signal_type === 'demand') roleCounts[sig.category].demand = sig.normalized_value || 0;
      if (sig.signal_type === 'supply') roleCounts[sig.category].supply = sig.normalized_value || 0;
    }

    // Fetch yesterday's FWI for delta calculation
    const yesterday = new Date(new Date(targetDate).getTime() - 86400000).toISOString().slice(0, 10);
    const { data: yesterdayScore } = await supabase
      .from('fwi_scores')
      .select('overall_score, demand_score, supply_score, momentum_score')
      .eq('date', yesterday)
      .maybeSingle();

    // Upsert FWI score
    const { error: upsertError } = await supabase
      .from('fwi_scores')
      .upsert({
        date: targetDate,
        overall_score: Math.round(overallScore * 10) / 10,
        demand_score: Math.round(demandScore * 10) / 10,
        supply_score: Math.round(supplyScore * 10) / 10,
        momentum_score: Math.round(momentumScore * 10) / 10,
        weights: WEIGHTS,
        confidence: signals.length >= 5 ? 1.0 : 0.7,
        notes: getFWILabel(overallScore),
      }, { onConflict: 'date' });

    if (upsertError) throw upsertError;

    // Build movers list
    const moversList = Object.values(roleCounts)
      .map(r => ({
        date: targetDate,
        role: `Fractional ${r.category.toUpperCase()}`,
        signal_type: 'demand',
        change_pct: yesterdayScore
          ? Math.round(((r.demand - yesterdayScore.demand_score) / Math.max(yesterdayScore.demand_score, 1)) * 100)
          : r.demand - 50,
        note: r.demand > 60 ? 'Above average demand' : r.demand < 40 ? 'Below average demand' : 'Normal demand',
      }))
      .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
      .slice(0, 5)
      .map((m, i) => ({ ...m, rank: i + 1 }));

    if (moversList.length > 0) {
      await supabase.from('movers').upsert(moversList, { onConflict: 'date,role,signal_type' });
    }

    return new Response(JSON.stringify({
      ok: true,
      date: targetDate,
      overall_score: Math.round(overallScore * 10) / 10,
      demand_score: Math.round(demandScore * 10) / 10,
      supply_score: Math.round(supplyScore * 10) / 10,
      momentum_score: Math.round(momentumScore * 10) / 10,
      label: getFWILabel(overallScore),
      signals_used: signals.length,
      movers: moversList.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
