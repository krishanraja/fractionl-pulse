import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
      .select('signal_type, category, normalized_value, raw_value')
      .eq('date', targetDate);

    if (sigError) throw sigError;

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ error: 'No signals found for date', date: targetDate }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Aggregate by signal type (exclude 'overall' rollup from average)
    const byType: Record<string, number[]> = { demand: [], supply: [], momentum: [] };
    const roleScores: Record<string, { demand: number; supply: number; momentum: number }> = {};

    for (const sig of signals) {
      if (sig.category === 'overall') continue;
      const type = sig.signal_type as string;
      if (byType[type]) byType[type].push(sig.normalized_value || 0);

      if (!roleScores[sig.category]) roleScores[sig.category] = { demand: 0, supply: 0, momentum: 0 };
      roleScores[sig.category][type as 'demand' | 'supply' | 'momentum'] = sig.normalized_value || 0;
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 50;
    const demandScore = Math.round(avg(byType.demand) * 10) / 10;
    const supplyScore = Math.round(avg(byType.supply) * 10) / 10;
    const momentumScore = Math.round(avg(byType.momentum) * 10) / 10;

    const overallScore = Math.round(
      (demandScore * WEIGHTS.demand + supplyScore * WEIGHTS.supply + momentumScore * WEIGHTS.momentum) * 10
    ) / 10;

    // Fetch previous FWI to calculate real deltas
    const yesterday = new Date(new Date(targetDate).getTime() - 86400000).toISOString().slice(0, 10);
    const { data: prevScore } = await supabase
      .from('fwi_scores')
      .select('overall_score, demand_score, supply_score, momentum_score')
      .eq('date', yesterday)
      .maybeSingle();

    // Upsert FWI score
    const { error: upsertError } = await supabase
      .from('fwi_scores')
      .upsert({
        date: targetDate,
        overall_score: overallScore,
        demand_score: demandScore,
        supply_score: supplyScore,
        momentum_score: momentumScore,
        weights: WEIGHTS,
        confidence: signals.length >= 5 ? 1.0 : 0.7,
        notes: getFWILabel(overallScore),
      }, { onConflict: 'date' });

    if (upsertError) throw upsertError;

    // Build movers — compare each role's demand score against the market average
    const marketAvgDemand = demandScore || 50;
    const moversList = Object.entries(roleScores)
      .filter(([_, scores]) => scores.demand > 0) // only roles with real data
      .map(([category, scores]) => {
        // How much above/below market average is this role's demand?
        const changePct = marketAvgDemand > 0
          ? Math.round(((scores.demand - marketAvgDemand) / marketAvgDemand) * 100)
          : 0;
        
        const roleLabel = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return {
          date: targetDate,
          role: `Fractional ${roleLabel}`,
          signal_type: 'demand',
          change_pct: changePct,
          note: scores.demand > marketAvgDemand
            ? 'Above market average demand'
            : scores.demand > 0
              ? 'Below market average demand'
              : 'Limited data',
        };
      })
      .sort((a, b) => b.change_pct - a.change_pct)
      .slice(0, 5)
      .map((m, i) => ({ ...m, rank: i + 1 }));

    if (moversList.length > 0) {
      await supabase
        .from('movers')
        .upsert(moversList, { onConflict: 'date,role,signal_type' });
    }

    return new Response(JSON.stringify({
      ok: true,
      date: targetDate,
      overall_score: overallScore,
      demand_score: demandScore,
      supply_score: supplyScore,
      momentum_score: momentumScore,
      label: getFWILabel(overallScore),
      signals_used: signals.length,
      movers: moversList,
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
