import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const FWI_LABELS: Record<string, { label: string; emoji: string }> = {
  surging:     { label: 'Surging',     emoji: '🚀' },
  growing:     { label: 'Growing',     emoji: '📈' },
  stable:      { label: 'Stable',      emoji: '➡️' },
  cooling:     { label: 'Cooling',     emoji: '📉' },
  contracting: { label: 'Contracting', emoji: '⚠️' },
};

function getFWILabel(score: number): string {
  if (score >= 75) return 'surging';
  if (score >= 60) return 'growing';
  if (score >= 45) return 'stable';
  if (score >= 30) return 'cooling';
  return 'contracting';
}

function nextWeeklyUpdate(): string {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + (7 - now.getDay())); // next Sunday
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

// GET /fwi-api/current - no auth required
async function handleCurrentFWI(): Promise<Response> {
  const { data: latest, error } = await supabase
    .from('fwi_scores')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!latest) {
    return new Response(JSON.stringify({
      error: 'No FWI data available yet',
      hint: 'The data pipeline has not run yet. Check back after the first weekly collection.',
      next_collection: nextWeeklyUpdate()
    }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Fetch previous score for delta
  const { data: previous } = await supabase
    .from('fwi_scores')
    .select('overall_score, demand_score, supply_score, momentum_score')
    .order('date', { ascending: false })
    .range(1, 1)
    .maybeSingle();

  // Fetch top movers
  const { data: movers } = await supabase
    .from('movers')
    .select('skill, signal_type, change_pct, note')
    .eq('date', latest.date)
    .order('rank', { ascending: true })
    .limit(5);

  const labelKey = getFWILabel(latest.overall_score);
  const labelData = FWI_LABELS[labelKey];
  const delta30d = previous
    ? Math.round((latest.overall_score - previous.overall_score) * 10) / 10
    : 0;

  const weights = latest.weights || { demand: 0.5, supply: 0.2, culture: 0.3 };

  const response = {
    meta: {
      index: 'Fractional Working Index (FWI)',
      description: 'Composite score measuring the health and momentum of the fractional executive market across demand, supply, and culture signals.',
      publisher: 'Fractionl',
      version: '1.0',
      asOf: latest.date,
      methodology: `FWI = (Demand × ${weights.demand}) + (Supply × ${weights.supply}) + (Culture × ${weights.culture})`,
      scale: '0-100: <30 Contracting · 30-44 Cooling · 45-59 Stable · 60-74 Growing · 75+ Surging',
      dataSource: latest.confidence >= 0.75 ? 'live' : 'partial',
      dataCompleteness: latest.confidence,
      dataCompletenessNote: 'Measures what fraction of data sources returned data this week. Does not measure prediction accuracy.',
      nextUpdate: nextWeeklyUpdate(),
    },
    score: {
      overall: latest.overall_score,
      label: labelData.label,
      emoji: labelData.emoji,
      delta30d,
      components: {
        demand: {
          score: latest.demand_score,
          weight: weights.demand,
          sources: ['Adzuna fractional job postings', 'SEC Form D VC filings (90-day)'],
        },
        supply: {
          score: latest.supply_score,
          weight: weights.supply,
          sources: weights.supply === 0
            ? []
            : ['People Data Labs professional profile counts', 'Google Trends supply-side search intent'],
          status: weights.supply === 0 ? 'excluded' : 'live',
          note: weights.supply === 0
            ? 'No supply data available this week — weight redistributed to demand and culture'
            : null,
        },
        culture: {
          score: latest.momentum_score,
          weight: weights.culture,
          sources: ['Google Trends search interest', 'NewsAPI media coverage (28-day)'],
        },
      },
    },
    topMovers: (movers || []).map(m => ({
      role: m.skill,
      signalType: m.signal_type,
      changePct: m.change_pct,
      insight: m.note,
    })),
    signals: {
      demand: {
        description: 'Job posting volume for fractional C-suite roles on Adzuna + VC funding pipeline via SEC Form D filings',
        roles: ['Fractional CFO', 'Fractional CMO', 'Fractional CTO', 'Fractional COO', 'Fractional CRO', 'Interim CEO'],
        leadingIndicator: 'SEC Form D filings predict fractional demand 1-3 months ahead',
      },
      supply: {
        description: 'Availability and growth of fractional executive talent pool',
        sources: [
          'People Data Labs: US professional profile counts with "fractional" job titles',
          'Google Trends: Supply-side search intent (e.g. "become fractional executive")',
        ],
        upcoming: 'Contra and Toptal marketplace integration (roadmap)',
      },
      culture: {
        description: 'Market awareness and momentum signals',
        sources: [
          'Google Trends: 90-day rolling search interest for fractional C-suite terms, geo=US',
          'NewsAPI: Article volume for exact phrase mentions over 28 days',
        ],
      },
    },
  };

  return new Response(JSON.stringify(response), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-FWI-Score': String(latest.overall_score),
      'X-FWI-Label': labelData.label,
    },
  });
}

// GET /fwi-api/history?months=3 - no auth required
async function handleHistory(months: number): Promise<Response> {
  const clampedMonths = Math.min(12, Math.max(1, months));
  const since = new Date();
  since.setMonth(since.getMonth() - clampedMonths);

  const { data: scores, error } = await supabase
    .from('fwi_scores')
    .select('date, overall_score, demand_score, supply_score, momentum_score, confidence, notes')
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: true });

  if (error) throw error;

  return new Response(JSON.stringify({
    meta: {
      index: 'Fractional Working Index (FWI)',
      period: `${clampedMonths} months`,
      from: since.toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
      dataPoints: scores?.length || 0,
    },
    history: (scores || []).map(s => ({
      date: s.date,
      overall: s.overall_score,
      demand: s.demand_score,
      supply: s.supply_score,
      culture: s.momentum_score,
      label: FWI_LABELS[getFWILabel(s.overall_score)]?.label,
      confidence: s.confidence,
    })),
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// POST /fwi-api/trigger - service-role only, triggers fresh data collection
async function handleTrigger(authHeader: string | null): Promise<Response> {
  const token = authHeader?.replace('Bearer ', '');
  if (token !== SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ingestResponse = await fetch(`${SUPABASE_URL}/functions/v1/ingest-signals`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
  });

  const result = ingestResponse.ok ? await ingestResponse.json() : { error: 'Ingest failed' };

  return new Response(JSON.stringify({
    triggered: true,
    ingest: result,
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    if (path === 'current' || path === 'fwi-api') {
      return await handleCurrentFWI();
    }

    if (path === 'history') {
      const months = parseInt(url.searchParams.get('months') || '3');
      return await handleHistory(months);
    }

    if (path === 'trigger' && req.method === 'POST') {
      return await handleTrigger(req.headers.get('Authorization'));
    }

    return new Response(JSON.stringify({
      error: 'Not found',
      endpoints: {
        'GET /fwi-api/current': 'Current FWI score, components, and top movers',
        'GET /fwi-api/history?months=3': 'Historical FWI scores (1-12 months)',
        'POST /fwi-api/trigger': 'Trigger fresh data collection (service role only)',
      }
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[fwi-api] Error:', error.message);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});