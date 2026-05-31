// content-feed: subscribable RSS/JSON feed of the weekly Content Radar brief, so the
// weekly brief syndicates into any reader or the n8n fleet. No auth. Mirrors fwi-feed.
// GET ?format=rss (default) or ?format=json.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SITE = 'https://pulse.fractionl.ai';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
function esc(s: string): string { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const format = new URL(req.url).searchParams.get('format') || 'rss';

  const { data: rows } = await supabase.from('content_briefs')
    .select('week_start, brief_json, generated_at').order('week_start', { ascending: false }).limit(26);

  if (!rows || rows.length === 0) return new Response('no data', { status: 404, headers: cors });

  const items = rows.map((r) => {
    const bj = (r.brief_json || {}) as any;
    const top = (bj.rising_topics || [])[0];
    const title = top ? `Content Radar: "${top.label}" leads, week of ${r.week_start}` : `Content Radar, week of ${r.week_start}`;
    const topicList = (bj.rising_topics || []).slice(0, 5).map((t: any) => `${t.label} (${t.radar_score}/100)`).join('; ');
    const angles = (bj.priority_angles || []).slice(0, 3).map((a: any) => a.angle).join(' | ');
    const desc = `Rising topics for fractional execs, week of ${r.week_start}: ${topicList || 'n/a'}. Priority angles: ${angles || 'n/a'}.`;
    return { week_start: r.week_start, title, desc };
  });

  if (format === 'json') {
    return new Response(JSON.stringify({ feed: 'Fractional Content Radar', publisher: 'Fractionl', items }, null, 2), {
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  const rssItems = items.map((it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${SITE}/?radar=${it.week_start}</link>
      <guid isPermaLink="false">radar-${it.week_start}</guid>
      <pubDate>${new Date(it.week_start + 'T12:00:00Z').toUTCString()}</pubDate>
      <description>${esc(it.desc)}</description>
    </item>`).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fractional Content Radar by Fractionl</title>
    <link>${SITE}</link>
    <description>Weekly rising topics, breakout questions, and ready-to-write content angles for fractional executives.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems}
  </channel>
</rss>`;
  return new Response(rss, { headers: { ...cors, 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
});
