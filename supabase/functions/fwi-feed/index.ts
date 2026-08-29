// fwi-feed: a subscribable RSS/Atom-style feed of the weekly FWI, so the weekly
// reading accumulates as a citable, syndicatable franchise instead of one mutable
// snapshot. No auth. Newsletters and agents can subscribe once and receive each
// week. GET ?format=rss (default) or ?format=json.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SITE = 'https://pulse.fractionl.ai';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

function label(s: number): string {
  if (s >= 75) return 'Surging'; if (s >= 60) return 'Growing'; if (s >= 45) return 'Stable'; if (s >= 30) return 'Cooling'; return 'Contracting';
}
function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function component(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : 'unavailable';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const format = new URL(req.url).searchParams.get('format') || 'rss';

  const { data: rows, error } = await supabase
    .from('fwi_scores')
    .select('date, overall_score, demand_score, supply_score, momentum_score')
    .order('date', { ascending: false })
    .limit(26);

  if (error || !rows || rows.length === 0) {
    return new Response('no data', { status: 404, headers: cors });
  }

  const items = rows
    .filter((r) => r.overall_score > 0 || r.demand_score > 0 || r.momentum_score > 0)
    .map((r) => {
      const score = Math.round(r.overall_score * 10) / 10;
      const lab = label(score);
      const title = `Fractional Working Index: ${score} (${lab}), week of ${r.date}`;
      const desc = `The fractional executive market reads ${score} of 100 (${lab}) for the week of ${r.date}. Demand ${component(r.demand_score)}, Supply ${component(r.supply_score)}, Culture ${component(r.momentum_score)}. A private composite published by Fractionl using 21 tracked inputs with mixed availability; search-derived inputs are supplied by DataForSEO.`;
      return { date: r.date, score, lab, title, desc };
    });

  if (format === 'json') {
    return new Response(JSON.stringify({ feed: 'Fractional Working Index', publisher: 'Fractionl', searchProvider: 'DataForSEO', items }, null, 2), {
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  const rssItems = items.map((it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${SITE}/?week=${it.date}</link>
      <guid isPermaLink="false">fwi-${it.date}</guid>
      <pubDate>${new Date(it.date + 'T12:00:00Z').toUTCString()}</pubDate>
      <description>${esc(it.desc)}</description>
    </item>`).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fractional Working Index (FWI) by Fractionl</title>
    <link>${SITE}</link>
    <description>The weekly market-health index for the fractional executive economy. A private 0-100 composite published by Fractionl using 21 tracked inputs across demand, supply, culture, and context.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems}
  </channel>
</rss>`;

  return new Response(rss, { headers: { ...cors, 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
});
