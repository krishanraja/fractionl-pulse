import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface SignalDetail {
  source: string;
  category: string;
  type: string;
  score: number;
  raw_value: number | null;
  metadata: Record<string, unknown> | null;
}

interface MoverRow {
  date: string;
  skill: string;
  signal_type: string;
  change_pct: number;
  note: string;
  rank: number;
}

// Canonical methodology weights. The blend uses effectiveWeights (below), which equals
// these on a normal day and only differs on the rare zero-supply day (redistributed away
// from supply). The EFFECTIVE set is what gets persisted to fwi_scores.weights so that any
// client recompute reconciles with the published overall_score; the canonical set is kept
// in metadata.display_weights for reference.
const WEIGHTS = {
  demand: 0.50,    // Adzuna + SerpAPI fractional jobs + SEC Form D financing context
  supply: 0.20,    // SerpAPI + Brave LinkedIn talent proxies, GoFractional, supply-intent trends
  culture: 0.30    // SerpAPI Trends + NewsAPI/Mediastack/Brave/Guardian + Reddit/HN + Wikipedia
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
  web_discourse: 'Online Discourse',
  prestige_media: 'Prestige Media',
  audio_culture: 'Podcast Mentions',
  community_discourse: 'Community Buzz',
  marketplace: 'Marketplace Listings',
  supply_intent: 'Supply Intent',
  self_employment: 'Self-Employment Rate',
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

    // Fetch the most recent prior week's signals for week-over-week deltas
    const { data: priorScores } = await supabase
      .from('fwi_scores')
      .select('date, overall_score, demand_score, supply_score, momentum_score')
      .lt('date', targetDate)
      .order('date', { ascending: false })
      .limit(1);
    const priorWeek = priorScores?.[0] || null;

    const priorSignalMap: Record<string, number> = {};
    if (priorWeek) {
      const { data: priorSigs } = await supabase
        .from('signals')
        .select('source, category, normalized_value')
        .eq('date', priorWeek.date);
      for (const s of (priorSigs || [])) {
        priorSignalMap[`${s.source}_${s.category}`] = s.normalized_value;
      }
    }

    // Group signals by type and calculate averages
    // 'context' signals (FRED, Census) are stored but excluded from composite scoring
    const signalsByType: Record<string, number[]> = { 
      demand: [], 
      supply: [], 
      momentum: [] 
    };

    const detailedSignals: Record<string, SignalDetail> = {};
    const contextSignals: Record<string, Record<string, unknown>> = {};

    for (const signal of signals) {
      const type = signal.signal_type;
      const value = signal.normalized_value || 0;
      
      if (type === 'context') {
        contextSignals[`${signal.source}_${signal.category}`] = {
          source: signal.source, category: signal.category,
          raw_value: signal.raw_value, metadata: signal.metadata
        };
        console.log(`[FWI] ${signal.source}/${signal.category} (context): ${signal.raw_value} [enrichment only]`);
        continue;
      }

      if (signalsByType[type]) {
        // Supply readings only count when something was actually measured. A source that
        // returns zero profiles/listings (raw_value 0) — e.g. an API that responded 200 but
        // empty, or a degraded day — carries no information and must not drag the
        // talent-availability average toward an artificial floor (this is what produced the
        // flat "10.00" supply stretch). Such empties are excluded so the day reads as
        // unmeasured (null) rather than a fake crash.
        if (type === 'supply' && (signal.raw_value == null || signal.raw_value <= 0)) {
          console.log(`[FWI] excluding empty supply signal ${signal.source}/${signal.category} (raw_value=${signal.raw_value})`);
        } else {
          signalsByType[type].push(value);
        }
      }

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

    // Calculate type averages. Returns null for an empty component instead of a magic
    // baseline — a missing reading must never be silently filled with 50 (or 0), because
    // that fabricates a data point the dashboard would render as real.
    const mean = (arr: number[]): number | null =>
      arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

    // Demand and culture are broad, redundant source stacks — effectively always present.
    // (ingest-signals already refuses to publish a day with < 2 successful sources.)
    const demandScore = mean(signalsByType.demand) ?? 0;
    const momentumScore = mean(signalsByType.momentum) ?? 0;

    // Supply is the fragile sub-index. With no valid supply signal the day is genuinely
    // unmeasured → supply_score is NULL (not 0, not 50). The weight is redistributed so the
    // overall score stays honest, and the chart shows a gap rather than a phantom crash.
    const supplyScore = mean(signalsByType.supply);
    const hasSupplyData = supplyScore != null;
    const finalSupplyScore: number | null = supplyScore;

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
       (finalSupplyScore ?? 0) * effectiveWeights.supply +
       momentumScore * effectiveWeights.culture) * 10
    ) / 10;

    console.log(`[FWI] Component scores - Demand: ${demandScore}, Supply: ${finalSupplyScore}, Momentum: ${momentumScore}`);
    console.log(`[FWI] Overall FWI: ${overallScore} (${getFWILabel(overallScore)})`);

    // Data completeness weights aligned with ingest-signals SOURCE_CONFIDENCE_WEIGHTS.
    // Kept in lockstep: retired google_trends/nyt/people_data_labs/supply_trends, added
    // brave_talent + the native free sources (bls/wikipedia_pageviews/openalex).
    const SOURCE_COMPLETENESS_WEIGHTS: Record<string, number> = {
      adzuna: 0.12, serpapi_jobs: 0.07, serpapi_trends: 0.05,
      sec_edgar: 0.09, newsapi: 0.04, brave_news: 0.03, brave_web: 0.03,
      mediastack: 0.03, guardian: 0.02, podchaser: 0.02,
      reddit: 0.02, hn: 0.01, serpapi_linkedin: 0.05, brave_talent: 0.05,
      gofractional: 0.04, serpapi_supply_trends: 0.03,
      fred: 0.01, census_acs: 0.01, bls: 0.04, wikipedia_pageviews: 0.06, openalex: 0.02,
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
        data_quality: {
          supply: hasSupplyData ? 'measured' : 'unmeasured',
          supply_signal_count: signalsByType.supply.length,
          demand_signal_count: signalsByType.demand.length,
          culture_signal_count: signalsByType.momentum.length,
        },
        display_weights: WEIGHTS,
        methodology: 'Job postings + SEC filings + search trends + news coverage',
        prior_week: priorWeek ? {
          date: priorWeek.date,
          overall: priorWeek.overall_score,
          demand: priorWeek.demand_score,
          supply: priorWeek.supply_score,
          culture: priorWeek.momentum_score,
        } : null,
      }
    }, { onConflict: 'date' });

    if (fwiError) throw fwiError;

    // Generate movers based on individual role performance vs market average
    const moversList: MoverRow[] = [];
    
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

    // Add non-role signals as movers using week-over-week deltas when available
    const candidateMovers = [
      detailedSignals['sec_edgar_vc_pipeline'],
      detailedSignals['serpapi_trends_search_interest'] || detailedSignals['google_trends_search_interest'],
      detailedSignals['newsapi_media_coverage'],
      detailedSignals['brave_web_web_discourse'],
      detailedSignals['guardian_prestige_media'],
      detailedSignals['nyt_prestige_media'],
      detailedSignals['podchaser_audio_culture'],
      detailedSignals['reddit_community_discourse'],
      detailedSignals['hn_community_discourse'],
      detailedSignals['gofractional_marketplace'],
    ].filter(Boolean);

    for (const signal of candidateMovers) {
      const priorKey = `${signal.source}_${signal.category}`;
      const priorScore = priorSignalMap[priorKey];
      const baseline = priorScore != null ? priorScore : 40;
      const changePct = baseline > 0
        ? Math.round(((signal.score - baseline) / baseline) * 100)
        : 0;
      const direction = changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat';

      const noteMap: Record<string, string> = {
        vc_pipeline: `${signal.raw_value} tech filings (90d) - ${signal.score > 55 ? 'strong' : signal.score > 45 ? 'moderate' : 'weak'} funding`,
        search_interest: `Search interest trending ${direction}${priorScore != null ? ` vs ${priorScore.toFixed(0)} last week` : ''}`,
        media_coverage: `${signal.raw_value} articles - ${signal.score > 35 ? 'strong' : 'low'} media coverage`,
        prestige_media: `${signal.raw_value} prestige articles (Guardian/NYT) - ${signal.score > 40 ? 'notable' : 'minimal'} elite coverage`,
        audio_culture: `${signal.raw_value} podcasts discussing fractional work`,
        community_discourse: `${signal.raw_value} community posts - ${signal.score > 40 ? 'active' : 'moderate'} discussion`,
        marketplace: `${signal.raw_value} marketplace listings on GoFractional`,
      };
      const note = noteMap[signal.category] || `${ROLE_NAMES[signal.category] || signal.category}: score ${signal.score}`;

      if (Math.abs(changePct) >= 10) {
        moversList.push({
          date: targetDate,
          skill: ROLE_NAMES[signal.category] || signal.category,
          signal_type: signal.type,
          change_pct: changePct,
          note, rank: 0
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
      methodology: '21 tracked inputs: Adzuna, SerpAPI Jobs and Trends, SEC Form D, NewsAPI, Guardian, Mediastack, Podchaser, Reddit, Hacker News, Brave Search, GoFractional, Wikipedia, BLS, Census ACS, FRED, and OpenAlex. Context inputs are excluded from the composite.',
      component_breakdown: {
        demand: {
          sources: signals.filter(s => s.signal_type === 'demand').map(s => `${s.source}/${s.category}`),
          average: demandScore
        },
        supply: {
          sources: signals.filter(s => s.signal_type === 'supply').map(s => `${s.source}/${s.category}`),
          average: finalSupplyScore,
          note: hasSupplyData ? null : 'No reliable supply reading — talent availability omitted (null) and its weight redistributed'
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
