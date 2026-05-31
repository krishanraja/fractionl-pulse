// content-api: public, no-auth agent/JSON API for the Content Radar. Mirrors fwi-api.
//   GET /content-api/radar            -> current week's rising topics + questions + angles (brief_json)
//   GET /content-api/topics?weeks=4   -> topic history (velocity over weeks)
//   GET /content-api/brief?format=markdown|json -> the weekly brief
// Reads only the curated, public-read content_* outputs (never the raw content_signals).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const jsonHeaders = { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' };

async function latestBrief() {
  const { data } = await supabase.from('content_briefs').select('*').order('week_start', { ascending: false }).limit(1).maybeSingle();
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = new URL(req.url);
  // path after the function name, e.g. /content-api/radar -> 'radar'
  const parts = url.pathname.split('/').filter(Boolean);
  const route = parts[parts.indexOf('content-api') + 1] || 'radar';

  try {
    if (route === 'radar') {
      const brief = await latestBrief();
      if (!brief) {
        return new Response(JSON.stringify({ error: 'No radar yet', hint: 'The weekly content harvest has not run. Check back after the first Monday run.' }), { status: 404, headers: jsonHeaders });
      }
      const body = {
        meta: {
          product: 'Fractional Content Radar',
          publisher: 'Fractionl',
          description: 'Weekly rising topics, breakout questions, and ready-to-write content angles for the fractional executive audience. Derived from a multi-source signal blend (search-trends rising queries, People-Also-Ask, news, Reddit, Hacker News, podcasts, job postings). Truth-discipline: this surfaces relative weekly movement, not absolute search volume; first meaningful velocity from week 2.',
          week_start: brief.week_start,
          confidence: brief.confidence,
          generated_at: brief.generated_at,
        },
        ...brief.brief_json,
      };
      return new Response(JSON.stringify(body), { headers: jsonHeaders });
    }

    if (route === 'topics') {
      const weeks = Math.max(1, Math.min(26, Number(url.searchParams.get('weeks')) || 4));
      const since = new Date(Date.now() - weeks * 7 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from('content_topics')
        .select('week_start, label, slug, taxonomy, radar_score, velocity, novelty, is_breakout, role, summary')
        .eq('is_seed', false).gte('week_start', since)
        .order('week_start', { ascending: false }).order('radar_score', { ascending: false });
      return new Response(JSON.stringify({ weeks, topics: data || [] }), { headers: jsonHeaders });
    }

    if (route === 'brief') {
      const brief = await latestBrief();
      if (!brief) return new Response('No brief yet', { status: 404, headers: cors });
      const format = url.searchParams.get('format') || 'markdown';
      if (format === 'json') return new Response(JSON.stringify({ week_start: brief.week_start, ...brief.brief_json }), { headers: jsonHeaders });
      return new Response(brief.brief_md, { headers: { ...cors, 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown route', routes: ['/content-api/radar', '/content-api/topics?weeks=4', '/content-api/brief?format=markdown|json'] }), { status: 404, headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: jsonHeaders });
  }
});
