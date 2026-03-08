import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://fractionl.ai',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FRACTIONAL_ROLES = [
  { query: 'fractional CMO', category: 'cmo' },
  { query: 'fractional CFO', category: 'cfo' },
  { query: 'fractional CTO', category: 'cto' },
  { query: 'fractional COO', category: 'coo' },
  { query: 'fractional CRO', category: 'cro' },
  { query: 'fractional VP Marketing', category: 'vp_marketing' },
  { query: 'fractional VP Sales', category: 'vp_sales' },
  { query: 'interim CEO', category: 'ceo' },
];

const ADZUNA_APP_ID = Deno.env.get('ADZUNA_APP_ID') || '';
const ADZUNA_APP_KEY = Deno.env.get('ADZUNA_APP_KEY') || '';
const NEWS_API_KEY = Deno.env.get('NEWS_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Normalize a raw count to 0-100 using a rolling baseline
const normalize = (value: number, baseline: number): number => {
  if (baseline === 0) return 50;
  return Math.min(Math.round((value / baseline) * 50), 100);
};

async function ingestDemand(date: string) {
  const results = [];
  let baselineTotal = 0;
  const counts: Record<string, number> = {};

  for (const role of FRACTIONAL_ROLES) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&what_phrase=${encodeURIComponent(role.query)}&results_per_page=1`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const count = data.count || 0;
      counts[role.category] = count;
      baselineTotal += count;
    } catch (e) {
      console.error(`Adzuna error for ${role.query}:`, e);
    }
  }

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  for (const [category, count] of Object.entries(counts)) {
    results.push({
      date,
      source: 'adzuna',
      signal_type: 'demand',
      category,
      raw_value: count,
      normalized_value: normalize(count, totalCount / FRACTIONAL_ROLES.length),
      raw_data: { count, total_market: totalCount },
    });
  }

  // Overall demand signal
  results.push({
    date,
    source: 'adzuna',
    signal_type: 'demand',
    category: 'overall',
    raw_value: totalCount,
    normalized_value: Math.min(Math.round((totalCount / 100) * 10), 100),
    raw_data: { counts, total: totalCount },
  });

  return results;
}

async function ingestMomentum(date: string) {
  const results = [];

  try {
    const query = 'fractional CMO OR fractional CFO OR fractional CTO OR "fractional executive"';
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${date}&sortBy=publishedAt&pageSize=100&apiKey=${NEWS_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const articleCount = data.totalResults || 0;
      results.push({
        date,
        source: 'newsapi',
        signal_type: 'momentum',
        category: 'overall',
        raw_value: articleCount,
        normalized_value: Math.min(Math.round(articleCount * 2), 100),
        raw_data: { article_count: articleCount, query },
      });
    }
  } catch (e) {
    console.error('NewsAPI error:', e);
  }

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const today = new Date().toISOString().slice(0, 10);

  // Log pipeline run start
  const { data: runData } = await supabase
    .from('pipeline_runs')
    .insert({ source: 'ingest-signals', started_at: new Date().toISOString(), status: 'running' })
    .select()
    .single();

  try {
    const [demandSignals, momentumSignals] = await Promise.all([
      ingestDemand(today),
      ingestMomentum(today),
    ]);

    const allSignals = [...demandSignals, ...momentumSignals];

    if (allSignals.length > 0) {
      // Upsert — if we already ran today, update
      const { error } = await supabase
        .from('signals')
        .upsert(allSignals, { onConflict: 'date,source,signal_type,category' });

      if (error) throw error;
    }

    // Update source health
    await supabase.from('data_source_health').upsert([
      { source: 'adzuna', last_checked: new Date().toISOString(), last_success: new Date().toISOString(), status: 'healthy', error_count: 0 },
      { source: 'newsapi', last_checked: new Date().toISOString(), last_success: new Date().toISOString(), status: 'healthy', error_count: 0 },
    ], { onConflict: 'source' });

    // Update pipeline run
    if (runData?.id) {
      await supabase.from('pipeline_runs').update({
        completed_at: new Date().toISOString(),
        records_inserted: allSignals.length,
        status: 'success',
      }).eq('id', runData.id);
    }

    return new Response(JSON.stringify({ ok: true, signals_inserted: allSignals.length, date: today }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    if (runData?.id) {
      await supabase.from('pipeline_runs').update({
        completed_at: new Date().toISOString(),
        status: 'error',
        error: String(error),
      }).eq('id', runData.id);
    }

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
