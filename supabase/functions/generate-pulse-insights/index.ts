import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://fractionl.ai',
  'https://pulse.fractionl.ai',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface SignalMetadata {
  top_articles?: Array<{ title?: string }>;
  subreddits?: string[];
  median_hourly_rate?: number;
  series_name?: string;
  date?: string;
  self_employment_pct?: number;
}

interface SignalRow {
  source?: string;
  signal_type?: string;
  category?: string;
  normalized_value?: number;
  raw_value?: number;
  metadata?: SignalMetadata | null;
}

async function fetchBraveContext(): Promise<string> {
  if (!BRAVE_API_KEY) return '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const items: { title: string; url: string; description: string; age: string }[] = [];

    // Fetch recent news about fractional executives
    const newsUrl = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent('"fractional executive" OR "fractional CFO"')}&count=5&freshness=pw`;
    const newsRes = await fetch(newsUrl, {
      headers: { 'X-Subscription-Token': BRAVE_API_KEY },
      signal: controller.signal,
    });

    if (newsRes.ok) {
      const newsData = await newsRes.json();
      for (const r of (newsData.results || []).slice(0, 5)) {
        items.push({
          title: r.title || '',
          url: r.url || '',
          description: (r.description || '').slice(0, 150),
          age: r.age || '',
        });
      }
    }

    // Brief pause for rate limiting
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Fetch broader web context
    const webUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent('fractional executive market trends')}&count=5&freshness=pm`;
    const webRes = await fetch(webUrl, {
      headers: { 'X-Subscription-Token': BRAVE_API_KEY },
      signal: controller.signal,
    });

    if (webRes.ok) {
      const webData = await webRes.json();
      for (const r of (webData.web?.results || []).slice(0, 3)) {
        items.push({
          title: r.title || '',
          url: r.url || '',
          description: (r.description || '').slice(0, 150),
          age: r.age || '',
        });
      }
    }

    clearTimeout(timeout);

    if (items.length === 0) return '';

    return items
      .map(i => {
        const source = i.url ? new URL(i.url).hostname : 'unknown';
        const age = i.age ? `, ${i.age}` : '';
        return `- "${i.title}" (${source}${age}): ${i.description}`;
      })
      .join('\n');

  } catch (error) {
    console.log('[Brave Context] Skipped:', error.message);
    return '';
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response('Forbidden origin', { status: 403, headers: { Vary: 'Origin' } });
  }
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Check if insights generated recently (cache for 12h)
    const { data: cached } = await supabase
      .from('cached_insights')
      .select('insights_json, valid_until')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached && cached.valid_until && new Date(cached.valid_until) > new Date()) {
      return new Response(JSON.stringify({ ok: true, cached: true, insights: cached.insights_json }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the latest settled observation first, then anchor every related
    // query to that date. Using the wall-clock date silently returned no movers
    // whenever ingestion had not yet completed for the current UTC day.
    const { data: latestScore } = await supabase
      .from('fwi_scores')
      .select('*')
      .order('date', { ascending: false })
      .limit(1);

    if (!latestScore || latestScore.length === 0) {
      return new Response(JSON.stringify({ error: 'No FWI data available yet' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const current = latestScore[0];
    const currentDate = current.date;
    const cutoff = new Date(`${currentDate}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    const [{ data: previousRows }, { data: moversData }, { data: signals }] = await Promise.all([
      supabase.from('fwi_scores').select('*').lte('date', cutoffDate).order('date', { ascending: false }).limit(1),
      supabase.from('movers').select('*').eq('date', currentDate).order('rank', { ascending: true }).limit(5),
      supabase.from('signals').select('source, signal_type, category, normalized_value, raw_value, metadata').eq('date', currentDate).limit(80),
    ]);
    const previous = previousRows?.[0];
    const signalRows = (signals || []) as SignalRow[];
    const delta30d = previous
      ? Math.round((current.overall_score - previous.overall_score) * 10) / 10
      : null;
    const trend = delta30d == null
      ? 'not available'
      : delta30d > 0 ? 'higher over 30 days' : delta30d < 0 ? 'lower over 30 days'
      : 'stable';

    const braveContext = await fetchBraveContext();

    const braveSection = braveContext
      ? `\n\nRecent market context (from web search):\n${braveContext}\n\nUse these recent articles to ground your insights in current events where relevant.`
      : '';

    // Build per-source signal breakdown for the LLM
    const signalLines: string[] = [];
    if (signalRows.length > 0) {
      const byType: Record<string, SignalRow[]> = {};
      for (const s of signalRows) {
        const t = s.signal_type || 'other';
        if (!byType[t]) byType[t] = [];
        byType[t].push(s);
      }
      for (const [type, sigs] of Object.entries(byType)) {
        signalLines.push(`\n${type.toUpperCase()} signals:`);
        for (const s of sigs) {
          const meta = s.metadata || {};
          const extras: string[] = [];
          if (meta.top_articles?.length) extras.push(`Headlines: ${meta.top_articles.slice(0, 2).map((article) => article.title).join('; ')}`);
          if (meta.subreddits?.length) extras.push(`Subreddits: ${meta.subreddits.slice(0, 3).join(', ')}`);
          if (meta.median_hourly_rate) extras.push(`Median rate: $${meta.median_hourly_rate}/hr`);
          if (meta.series_name) extras.push(`${meta.series_name}: ${s.raw_value} (${meta.date})`);
          if (meta.self_employment_pct) extras.push(`Self-employment: ${meta.self_employment_pct}%`);
          signalLines.push(`- ${s.source || s.category} (${s.category}): raw=${s.raw_value}, score=${s.normalized_value}/100${extras.length ? ' | ' + extras.join(' | ') : ''}`);
        }
      }
    }

    const prompt = `You are an analyst for the Fractional Working Index (FWI), a market intelligence product for fractional executives (CMOs, CFOs, CTOs, CROs).

Current FWI data:
- Overall Score: ${current.overall_score}/100 (${current.notes || 'N/A'})
- Demand Score: ${current.demand_score}/100
- Supply Score: ${current.supply_score}/100
- Momentum Score: ${current.momentum_score}/100
- 30-day direction: ${trend}${delta30d == null ? '' : ` (${delta30d > 0 ? '+' : ''}${delta30d} points vs ${previous.date})`}

Cross-sectional movers vs the current market average (these are NOT week-over-week changes):
${(moversData || []).map(m => `- ${m.skill || m.role}: ${m.change_pct > 0 ? '+' : ''}${m.change_pct}% vs market average (${m.note})`).join('\n')}

Detailed signal breakdown:${signalLines.join('\n')}${braveSection}

Generate 4 insights for fractional executives:
1. A brief market summary (2 sentences) grounded in the signal data above
2. The biggest opportunity right now, citing specific data points
3. A trend to watch, referencing at least two signal sources
4. One tactical recommendation for a fractional executive making decisions this week

Return as a JSON object with an insights array:
{"insights": [{"type": "summary|opportunity|trend|recommendation", "title": "short title", "body": "2-3 sentences", "confidence": 0.7-0.95, "relatedSignals": ["2-4 exact source names, metric labels, or the index date used"]}]}

Truth rules:
- Never turn a mover "vs market average" into an increase, decline, surge, drop, or time trend.
- Never call a 30-44 component stable; it is Cooling. 45-59 is Stable, 60-74 Growing, 75+ Surging.
- Do not use an uncited percentage or market claim. If a fact is not in the supplied context, omit it.
- Distinguish measured fact, interpretation, and recommendation. Do not claim causation from media/community attention to pricing or demand.
- The index is US primary and cannot establish local conditions elsewhere.

Be specific. Reference actual numbers and source names. No fluff. Write for experienced fractional CMOs/CFOs/CTOs.`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!openaiRes.ok) throw new Error(`OpenAI error: ${await openaiRes.text()}`);
    const openaiData = await openaiRes.json();
    const rawContent = openaiData.choices[0].message.content;

    let insights;
    try {
      const parsed = JSON.parse(rawContent);
      insights = Array.isArray(parsed) ? parsed : parsed.insights || parsed.data || [];
    } catch {
      insights = [];
    }

    // Never cache an empty result: a parse miss must not poison the 12h cache.
    if (!Array.isArray(insights) || insights.length === 0) {
      return new Response(JSON.stringify({ ok: false, cached: false, insights: [], error: 'no_insights_parsed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cache for 12 hours. Check the write so a failure surfaces instead of being swallowed.
    const validUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { error: cacheError } = await supabase.from('cached_insights').insert({
      generated_at: new Date().toISOString(),
      insights_json: insights,
      model_used: 'gpt-4o-mini',
      valid_until: validUntil,
      context: { fwi_score: current.overall_score, date: currentDate, brave_context_used: braveContext.length > 0,
        signal_count: signalRows.length, signal_sources: [...new Set(signalRows.map((signal) => signal.source).filter(Boolean))] },
    });
    if (cacheError) console.error('cached_insights insert failed:', cacheError.message);

    return new Response(JSON.stringify({ ok: true, cached: false, persisted: !cacheError, insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
