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

const SITE = 'https://pulse.fractionl.ai';
const OWNER = { name: 'Krish Raja', organisation: 'Fractionl', corrections: 'hello@krishraja.com' };

// Readable names for every input, so a reader sees which inputs made a reading.
const SOURCE_NAMES: Record<string, string> = {
  adzuna: 'Adzuna US job postings naming six fractional roles',
  serpapi_jobs: 'Google Jobs results for six fractional roles (DataForSEO)',
  sec_edgar: 'SEC Form D technology filings, 90 days (financing context)',
  bls: 'BLS JOLTS openings and labour statistics (held out)', fred: 'FRED initial jobless claims (held out)',
  census_acs: 'Census ACS self-employment (held out)', openalex: 'OpenAlex research mentions (held out)',
  sec_exec_transitions: 'SEC 8-K interim CFO and CEO appointments (held out)',
  serpapi_linkedin: 'Google result count for LinkedIn profiles naming four fractional roles (DataForSEO), 14-day median',
  census_bfs_pbs: 'Census business applications, professional services (NAICS 54), seasonally adjusted',
  bls_incorporated: 'BLS incorporated self-employed, year-over-year change',
  newsapi: 'NewsAPI article count, 28 days',
  hn: 'Hacker News stories mentioning "fractional", 30 days',
  wikipedia_pageviews: 'Wikipedia pageviews, six articles',
  serpapi_trends: 'Google Trends search interest (DataForSEO)',
  brave_news: 'Brave News results', brave_web: 'Brave web results', reddit: 'Reddit results via Brave',
  brave_talent: 'LinkedIn profile results via Brave', guardian: 'The Guardian articles', mediastack: 'Mediastack articles',
  podchaser: 'Podchaser podcasts', gofractional: 'GoFractional published network size',
};

// Before the seam these arrived with the reading but were held out of the score.
const V1_NOT_SCORED = ['bls', 'fred', 'census_acs', 'openalex', 'sec_exec_transitions', 'census_bfs_pbs', 'bls_incorporated'];

type Vote = { source: string; pillar: string; value: number; as_of: string; carried: boolean };
interface MethodRecord { id: string; effective: string; link_offset: number; link_window: { first: string; last: string; n: number } }

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

  // Fetch the closest observation on or before the 30-day cutoff. The API field
  // is named delta30d, so comparing with the immediately previous daily row is
  // a semantic contract violation even when the arithmetic is correct.
  const cutoff = new Date(`${latest.date}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const { data: previous30d } = await supabase
    .from('fwi_scores')
    .select('date, overall_score, demand_score, supply_score, momentum_score')
    .lte('date', cutoffDate)
    .order('date', { ascending: false })
    .limit(1)
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
  const delta30d = previous30d
    ? Math.round((latest.overall_score - previous30d.overall_score) * 10) / 10
    : 0;

  const weights = latest.weights || { demand: 0.5, supply: 0.2, culture: 0.3 };

  // Method v2 readings (from the 2026-10-26 seam) carry their method record,
  // band and votes; earlier readings are served exactly as published.
  const md = (latest.metadata || {}) as { method?: MethodRecord; band?: { low: number; high: number }; votes?: Vote[]; sources?: string[] };
  const v2 = md.method?.id?.startsWith('fwi-v2') ?? false;
  const band = v2 && md.band ? { low: md.band.low, high: md.band.high, kind: 'interquartile range of 500 seeded draws resampling each pillar\'s source votes; not a confidence interval on the market' } : null;
  const votes: Vote[] = v2 ? (md.votes || []) : [];
  const named = (pillar: string) => votes.filter((v) => v.pillar === pillar).map((v) => SOURCE_NAMES[v.source] || v.source);
  const display = band ? `${latest.overall_score} (${band.low} to ${band.high})` : String(latest.overall_score);
  const fmtDate = new Date(`${latest.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  const response = {
    meta: {
      index: 'Fractional Working Index (FWI)',
      description: 'Composite score measuring the health and momentum of the fractional executive market across demand, supply, and culture signals.',
      publisher: 'Fractionl',
      owner: OWNER,
      version: v2 ? '2.0' : '1.0',
      method: v2 ? md.method : null,
      methodologyUrl: `${SITE}/methodology`,
      changelogUrl: `${SITE}/changelog`,
      validation: { status: 'not validated', detail: 'No held-out measure tested so far supports the index; results with their n are on the methodology page.', url: `${SITE}/methodology#validation` },
      citation: `Fractional Working Index (FWI), Pulse by Fractionl: ${display} on ${fmtDate}. ${SITE}`,
      asOf: latest.date,
      methodology: v2
        ? `FWI = (Demand × ${weights.demand}) + (Supply × ${weights.supply}) + (Culture × ${weights.culture}) + ${md.method!.link_offset} (link fixed at the ${md.method!.effective} seam), rounded to a whole number`
        : `FWI = (Demand × ${weights.demand}) + (Supply × ${weights.supply}) + (Culture × ${weights.culture})`,
      scale: '0-100: <30 Contracting · 30-44 Cooling · 45-59 Stable · 60-74 Growing · 75+ Surging',
      dataSource: latest.confidence >= 0.75 ? 'live' : 'partial',
      dataCompleteness: latest.confidence,
      dataCompletenessNote: 'Weighted tracked-input coverage for this reading. Inputs are not all statistically independent, and the value does not measure prediction accuracy.',
      nextUpdate: nextWeeklyUpdate(),
    },
    score: {
      overall: latest.overall_score,
      band,
      display,
      label: labelData.label,
      emoji: labelData.emoji,
      delta30d,
      delta30dComparedWith: previous30d?.date ?? null,
      components: {
        demand: {
          score: latest.demand_score,
          weight: weights.demand,
          sources: v2 ? named('demand') : ['Adzuna fractional job postings', 'DataForSEO Google Jobs cross-check', 'SEC Form D VC filings (90-day)'],
        },
        supply: {
          score: latest.supply_score,
          weight: weights.supply,
          sources: weights.supply === 0
            ? []
            : v2 ? named('supply') : ['DataForSEO LinkedIn supply proxy', 'Brave LinkedIn talent proxy', 'GoFractional marketplace listings'],
          status: weights.supply === 0 ? 'excluded' : 'live',
          note: weights.supply === 0
            ? 'No supply data available this week, weight redistributed to demand and culture'
            : null,
        },
        culture: {
          score: latest.momentum_score,
          weight: weights.culture,
          sources: v2 ? named('culture') : ['Search interest trends (DataForSEO)', 'NewsAPI + Mediastack + Brave News media coverage', 'Guardian prestige media', 'Podchaser podcast mentions', 'Reddit + HN community discourse', 'Brave Web discourse monitoring', 'Wikipedia article interest'],
        },
      },
    },
    // The inputs that actually made this reading. For v2, each vote with its
    // value, the day it was observed, and whether it was carried forward.
    contributors: v2
      ? votes.map((v) => ({ source: v.source, name: SOURCE_NAMES[v.source] || v.source, pillar: v.pillar, value: v.value, asOf: v.as_of, carried: v.carried }))
      : (md.sources || []).map((src) => ({ source: src, name: SOURCE_NAMES[src] || src, scored: !V1_NOT_SCORED.includes(src) })),
    topMovers: (movers || []).map(m => ({
      role: m.skill,
      signalType: m.signal_type,
      changePct: m.change_pct,
      insight: m.note,
    })),
    signals: {
      demand: {
        description: 'Job posting volume for fractional C-suite roles + VC funding pipeline via SEC filings',
        roles: ['Fractional CFO', 'Fractional CMO', 'Fractional CTO', 'Fractional COO', 'Fractional CRO', 'Interim CEO'],
        sources: ['Adzuna job API', 'DataForSEO Google Jobs', 'SEC EDGAR Form D filings'],
        leadingIndicator: 'SEC Form D filings provide financing context. Their relationship to future fractional demand has not been validated.',
      },
      supply: {
        description: 'Availability and growth of fractional executive talent pool from multiple sources',
        sources: v2 ? named('supply') : [
          'DataForSEO LinkedIn profile index (site:linkedin.com/in proxy)',
          'Brave LinkedIn talent proxy (provider-independent backstop)',
          'GoFractional marketplace listings (via Apify scraper)',
        ],
      },
      culture: {
        description: v2 ? 'Market attention: news, Hacker News and Wikipedia' : 'Market awareness and momentum signals from 10+ sources',
        sources: v2 ? named('culture') : [
          'Search interest trends (DataForSEO)',
          'NewsAPI article volume (28-day)',
          'Mediastack news cross-check',
          'The Guardian prestige media (90-day)',
          'Podchaser podcast mentions',
          'Reddit community discourse',
          'Hacker News tech discourse (Algolia API)',
          'Brave News coverage',
          'Brave Web discourse volume',
          'Wikipedia article pageviews',
        ],
      },
      context: {
        description: 'Macro economic context signals (not used in composite score)',
        sources: [
          'BLS JOLTS job openings, unemployment and wages',
          'FRED macro series (JOLTS, unemployment, jobless claims)',
          'Census ACS self-employment data',
          'OpenAlex academic and thought-leadership coverage',
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
      ...(band ? { 'X-FWI-Band': `${band.low}-${band.high}` } : {}),
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
    .select('date, overall_score, demand_score, supply_score, momentum_score, confidence, notes, metadata')
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
      seams: `${SITE}/changelog`,
      note: 'Readings before 2026-10-26 are method v1, one decimal, no band; from 2026-10-26 method v2, whole numbers with a band, chain-linked. No reading is restated.',
    },
    history: (scores || []).map(s => ({
      date: s.date,
      overall: s.overall_score,
      demand: s.demand_score,
      supply: s.supply_score,
      culture: s.momentum_score,
      label: FWI_LABELS[getFWILabel(s.overall_score)]?.label,
      confidence: s.confidence,
      band: s.metadata?.band ? { low: s.metadata.band.low, high: s.metadata.band.high } : null,
      method: s.metadata?.method?.id ?? 'fwi-v1',
      dataQuality: s.metadata?.data_quality ?? null,
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

// Metered API tiers. Anonymous callers (no x-api-key) keep the free, unauthenticated
// public read unchanged and unmetered, so the dashboard and existing agents never
// break. A supplied key is validated and metered per day against api_keys; this is
// the monetizable wedge (free keys 1k/day, paid tiers higher, enterprise unlimited).
const TIER_LIMITS: Record<string, number | null> = { free: 1000, pro: 10000, enterprise: null };

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface MeterResult { ok: boolean; status?: number; error?: string; headers?: Record<string, string>; }

async function meter(req: Request): Promise<MeterResult> {
  const key = req.headers.get('x-api-key');
  if (!key) return { ok: true }; // anonymous free public tier, unmetered
  const hash = await sha256Hex(key);
  const { data: row } = await supabase
    .from('api_keys')
    .select('id, tier, requests_used, requests_limit, last_used_at, is_active')
    .eq('key_hash', hash)
    .maybeSingle();
  if (!row || !row.is_active) return { ok: false, status: 401, error: 'invalid_or_revoked_api_key' };
  const limit = row.requests_limit ?? TIER_LIMITS[row.tier as string] ?? 1000;
  const unlimited = limit == null || row.tier === 'enterprise';
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = row.last_used_at ? new Date(row.last_used_at).toISOString().slice(0, 10) : null;
  let used = lastDay && lastDay < today ? 0 : (row.requests_used ?? 0); // daily reset
  if (!unlimited && used >= (limit as number)) {
    return { ok: false, status: 429, error: 'rate_limit_exceeded', headers: { 'X-RateLimit-Limit': String(limit), 'X-RateLimit-Remaining': '0' } };
  }
  used += 1;
  await supabase.from('api_keys').update({ requests_used: used, last_used_at: new Date().toISOString() }).eq('id', row.id);
  return {
    ok: true,
    headers: unlimited
      ? { 'X-RateLimit-Limit': 'unlimited' }
      : { 'X-RateLimit-Limit': String(limit), 'X-RateLimit-Remaining': String(Math.max(0, (limit as number) - used)) },
  };
}

function withHeaders(resp: Response, extra?: Record<string, string>): Response {
  if (!extra) return resp;
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    if (path === 'current' || path === 'fwi-api' || path === 'history') {
      const m = await meter(req);
      if (!m.ok) {
        return new Response(JSON.stringify({ error: m.error }), {
          status: m.status, headers: { ...corsHeaders, ...(m.headers || {}), 'Content-Type': 'application/json' },
        });
      }
      const resp = path === 'history'
        ? await handleHistory(parseInt(url.searchParams.get('months') || '3'))
        : await handleCurrentFWI();
      return withHeaders(resp, m.headers);
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
