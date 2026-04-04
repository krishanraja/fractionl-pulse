import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Updated weights based on verified defensible signal methodology
const WEIGHTS = {
  demand: 0.50,    // Adzuna fractional jobs + SEC Form D leading indicator
  supply: 0.20,    // People Data Labs + supply-side search interest
  culture: 0.30    // Google Trends + NewsAPI + Brave Search culture signals
};

const ROLE_NAMES: Record<string, string> = {
  cfo: 'Fractional CFO',
  cto: 'Fractional CTO', 
  cmo: 'Fractional CMO',
  coo: 'Fractional COO',
  cro: 'Fractional CRO',
  ceo: 'Interim CEO',
  vc_pipeline: 'VC Funding Pipeline',
  search_interest: 'Search Interest',
  media_coverage: 'Media Coverage',
  web_discourse: 'Web Discourse'
};

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
    // Fetch all signals for the target date
    const { data: signals, error: sigError } = await supabase
      .from('signals')
      .select('source, signal_type, category, normalized_value, raw_value, metadata')
      .eq('date', targetDate);

    if (sigError) throw sigError;
    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No signals found', 
        date: targetDate,
        suggestion: 'Run the ingest-signals function first' 
      }), {
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[FWI] Processing ${signals.length} signals for ${targetDate}`);

    // Group signals by type and calculate averages
    const signalsByType: Record<string, number[]> = { 
      demand: [], 
      supply: [], 
      momentum: [] 
    };

    const detailedSignals: Record<string, any> = {};

    for (const signal of signals) {
      const type = signal.signal_type;
      const value = signal.normalized_value || 0;
      
      if (signalsByType[type]) {
        signalsByType[type].push(value);
      }

      // Track individual signals for movers calculation
      detailedSignals[`${signal.source}_${signal.category}`] = {
        source: signal.source,
        category: signal.category,
        type: signal.signal_type,
        score: value,
        raw_value: signal.raw_value,
        metadata: signal.metadata
      };
      
      console.log(`[FWI] ${signal.source}/${signal.category} (${type}): ${value}`);
    }

    // Calculate type averages
    const avgScore = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 50;
    
    const demandScore = Math.round(avgScore(signalsByType.demand) * 10) / 10;
    const supplyScore = Math.round(avgScore(signalsByType.supply) * 10) / 10;
    const momentumScore = Math.round(avgScore(signalsByType.momentum) * 10) / 10;

    // If no supply signals exist, redistribute supply weight proportionally to demand and culture
    const hasSupplyData = signalsByType.supply.length > 0;
    const finalSupplyScore = hasSupplyData ? supplyScore : 0;

    let effectiveWeights = { ...WEIGHTS };
    if (!hasSupplyData) {
      const remainingWeight = WEIGHTS.demand + WEIGHTS.culture;
      effectiveWeights = {
        demand: WEIGHTS.demand / remainingWeight,
        supply: 0,
        culture: WEIGHTS.culture / remainingWeight,
      };
      console.log(`[FWI] No supply data — redistributing weight: demand=${effectiveWeights.demand.toFixed(2)}, culture=${effectiveWeights.culture.toFixed(2)}`);
    }

    // Calculate composite FWI score
    const overallScore = Math.round(
      (demandScore * effectiveWeights.demand +
       finalSupplyScore * effectiveWeights.supply +
       momentumScore * effectiveWeights.culture) * 10
    ) / 10;

    console.log(`[FWI] Component scores - Demand: ${demandScore}, Supply: ${finalSupplyScore}, Momentum: ${momentumScore}`);
    console.log(`[FWI] Overall FWI: ${overallScore} (${getFWILabel(overallScore)})`);

    // Data completeness: measures what fraction of data sources returned data (not prediction accuracy)
    const SOURCE_COMPLETENESS_WEIGHTS: Record<string, number> = {
      adzuna: 0.25, google_trends: 0.20, sec_edgar: 0.15, newsapi: 0.08, brave_news: 0.08, brave_web: 0.06, people_data_labs: 0.20, supply_trends: 0.10,
    };
    const uniqueSources = [...new Set(signals.map(s => s.source))];
    const totalWeight = Object.values(SOURCE_COMPLETENESS_WEIGHTS).reduce((a, b) => a + b, 0);
    const achievedWeight = uniqueSources.reduce((sum, src) => sum + (SOURCE_COMPLETENESS_WEIGHTS[src] || 0), 0);
    const confidence = Math.round((achievedWeight / totalWeight) * 100) / 100;

    // Upsert FWI score record
    const { error: fwiError } = await supabase.from('fwi_scores').upsert({
      date: targetDate,
      overall_score: overallScore,
      demand_score: demandScore,
      supply_score: finalSupplyScore,
      momentum_score: momentumScore,
      weights: effectiveWeights,
      confidence: confidence,
      notes: `${getFWILabel(overallScore)} - ${uniqueSources.length} sources${hasSupplyData ? '' : ' (supply excluded)'}`,
      metadata: {
        signals_used: signals.length,
        sources: Array.from(new Set(signals.map(s => s.source))),
        has_supply_data: hasSupplyData,
        methodology: 'Adzuna jobs + SEC Form D + Google Trends + NewsAPI + Brave Search'
      }
    }, { onConflict: 'date' });

    if (fwiError) throw fwiError;

    // Generate movers based on individual role performance vs market average
    const moversList: any[] = [];
    
    // Find fractional role signals (from Adzuna)
    const roleSignals = Object.entries(detailedSignals).filter(([key, sig]) => 
      sig.source === 'adzuna' && ['cfo', 'cmo', 'cto', 'coo', 'cro', 'ceo'].includes(sig.category)
    );

    if (roleSignals.length > 0) {
      const roleScores = roleSignals.map(([, sig]) => sig.score);
      const marketAvg = roleScores.reduce((a, b) => a + b, 0) / roleScores.length;
      
      console.log(`[FWI] Role market average: ${marketAvg.toFixed(1)}`);

      for (const [key, signal] of roleSignals) {
        const changePct = marketAvg > 0 ? 
          Math.round(((signal.score - marketAvg) / marketAvg) * 100) : 0;
        
        const mover = {
          date: targetDate,
          skill: ROLE_NAMES[signal.category] || signal.category,
          signal_type: 'demand',
          change_pct: changePct,
          note: signal.score > marketAvg ? 
            `${signal.raw_value} jobs - above market average` :
            `${signal.raw_value} jobs - below market average`,
          rank: 0 // will be set after sorting
        };
        
        moversList.push(mover);
      }
    }

    // Add non-role signals as movers if significant
    const nonRoleSignals = [
      detailedSignals['sec_edgar_vc_pipeline'],
      detailedSignals['google_trends_search_interest'],
      detailedSignals['newsapi_media_coverage'],
      detailedSignals['brave_news_media_coverage'],
      detailedSignals['brave_web_web_discourse']
    ].filter(Boolean);

    for (const signal of nonRoleSignals) {
      let note = '';
      let changePct = 0;

      if (signal.category === 'vc_pipeline') {
        changePct = signal.score > 50 ? Math.round((signal.score - 50) / 50 * 100) : Math.round((signal.score - 50) / 50 * 100);
        note = `${signal.raw_value} tech filings (90d) - ${signal.score > 55 ? 'strong' : signal.score > 45 ? 'moderate' : 'weak'} funding activity`;
      } else if (signal.category === 'search_interest') {
        changePct = signal.score > 40 ? Math.round((signal.score - 40) / 40 * 100) : Math.round((signal.score - 40) / 40 * 100);
        note = `Search interest trending ${signal.score > 45 ? 'up' : signal.score > 35 ? 'steady' : 'down'}`;
      } else if (signal.category === 'media_coverage') {
        changePct = signal.score > 30 ? Math.round((signal.score - 30) / 30 * 100) : Math.round((signal.score - 30) / 30 * 100);
        note = `${signal.raw_value} articles - ${signal.score > 35 ? 'high' : 'low'} media attention (${signal.source === 'brave_news' ? 'Brave' : 'NewsAPI'})`;
      } else if (signal.category === 'web_discourse') {
        changePct = signal.score > 30 ? Math.round((signal.score - 30) / 30 * 100) : Math.round((signal.score - 30) / 30 * 100);
        note = `Web discourse ${signal.score > 40 ? 'elevated' : signal.score > 25 ? 'moderate' : 'low'} across blogs and forums`;
      }

      if (Math.abs(changePct) >= 10) { // Only include significant movers
        moversList.push({
          date: targetDate,
          skill: ROLE_NAMES[signal.category] || signal.category,
          signal_type: signal.type,
          change_pct: changePct,
          note: note,
          rank: 0
        });
      }
    }

    // Sort movers by change percentage and assign ranks
    moversList.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
    moversList.forEach((mover, index) => {
      mover.rank = index + 1;
    });

    // Take top 5 movers
    const topMovers = moversList.slice(0, 5);

    // Delete existing movers for this date and insert new ones
    if (topMovers.length > 0) {
      await supabase.from('movers').delete().eq('date', targetDate);
      const { error: moversError } = await supabase
        .from('movers')
        .insert(topMovers);
      
      if (moversError) {
        console.error('[FWI] Failed to insert movers:', moversError);
      } else {
        console.log(`[FWI] Inserted ${topMovers.length} movers`);
      }
    }

    // Prepare response
    const result = {
      success: true,
      date: targetDate,
      overall_score: overallScore,
      demand_score: demandScore,
      supply_score: finalSupplyScore,
      momentum_score: momentumScore,
      label: getFWILabel(overallScore),
      confidence: confidence,
      signals_used: signals.length,
      sources_active: uniqueSources,
      movers_count: topMovers.length,
      weights: WEIGHTS,
      methodology: 'Defensive signal stack: Adzuna fractional jobs + SEC Form D filings + Google Trends + NewsAPI',
      component_breakdown: {
        demand: {
          sources: signals.filter(s => s.signal_type === 'demand').map(s => `${s.source}/${s.category}`),
          average: demandScore
        },
        supply: {
          sources: signals.filter(s => s.signal_type === 'supply').map(s => `${s.source}/${s.category}`),
          average: finalSupplyScore,
          note: finalSupplyScore === 50 ? 'Using baseline - direct supply data pending' : null
        },
        culture: {
          sources: signals.filter(s => s.signal_type === 'momentum').map(s => `${s.source}/${s.category}`),
          average: momentumScore
        }
      }
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[FWI] Calculation failed:', error.message);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      date: targetDate
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});