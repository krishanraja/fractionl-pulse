import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://fractionl.ai',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

    // Fetch latest FWI context
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: latestScore }, { data: moversData }, { data: signals }] = await Promise.all([
      supabase.from('fwi_scores').select('*').order('date', { ascending: false }).limit(3),
      supabase.from('movers').select('*').eq('date', today).order('rank', { ascending: true }).limit(5),
      supabase.from('signals').select('signal_type, category, normalized_value, raw_value').eq('date', today).limit(20),
    ]);

    if (!latestScore || latestScore.length === 0) {
      return new Response(JSON.stringify({ error: 'No FWI data available yet' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const current = latestScore[0];
    const previous = latestScore[1];
    const trend = previous
      ? current.overall_score - previous.overall_score > 0 ? 'improving' : 'declining'
      : 'stable';

    const braveContext = await fetchBraveContext();

    const braveSection = braveContext
      ? `\n\nRecent market context (from web search):\n${braveContext}\n\nUse these recent articles to ground your insights in current events where relevant.`
      : '';

    const prompt = `You are an analyst for the Fractional Working Index (FWI), a market intelligence product for fractional executives (CMOs, CFOs, CTOs, CROs).

Current FWI data:
- Overall Score: ${current.overall_score}/100 (${current.notes || 'N/A'})
- Demand Score: ${current.demand_score}/100
- Supply Score: ${current.supply_score}/100
- Momentum Score: ${current.momentum_score}/100
- Trend vs previous reading: ${trend}

Top movers:
${(moversData || []).map(m => `- ${m.role}: ${m.change_pct > 0 ? '+' : ''}${m.change_pct}% (${m.note})`).join('\n')}${braveSection}

Generate 4 insights for fractional executives:
1. A brief market summary (2 sentences)
2. The biggest opportunity right now
3. A trend to watch
4. One tactical recommendation

Return as JSON array: [{"type": "summary|opportunity|trend|recommendation", "title": "short title", "body": "2-3 sentences", "confidence": 0.7-0.95}]

Be specific. No fluff. Write for experienced fractional CMOs/CFOs/CTOs.`;

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

    // Cache for 12 hours
    const validUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    await supabase.from('cached_insights').insert({
      generated_at: new Date().toISOString(),
      insights_json: insights,
      model_used: 'gpt-4o-mini',
      valid_until: validUntil,
      context: { fwi_score: current.overall_score, date: today, brave_context_used: braveContext.length > 0 },
    });

    return new Response(JSON.stringify({ ok: true, cached: false, insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
