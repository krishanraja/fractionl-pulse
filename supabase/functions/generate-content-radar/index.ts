import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Generate-content-radar: clusters this week's content_signals into rising TOPICS,
// synthesizes breakout QUESTIONS, generates fractional-audience ANGLES, scores by
// velocity + novelty, and writes the weekly content_briefs row. One LLM call (clustering
// + question synthesis + angles); the brief markdown is composed deterministically from
// the scored, grounded output. Never writes an empty/partial week (cache-discipline).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const MODEL = Deno.env.get('CONTENT_RADAR_MODEL') || 'gpt-4o-mini';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Sources whose docs feed the radar, used for the confidence denominator.
const EXPECTED_SOURCES = ['serpapi_related', 'serpapi_paa', 'google_autocomplete', 'newsapi', 'mediastack', 'guardian', 'brave_news', 'brave_web', 'reddit', 'hn', 'podchaser', 'ats_boards', 'youtube', 'marketplace'];

function isoMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
function norm(s: string): string { return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }
function slugify(s: string): string { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'topic'; }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const today = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const weekStart = url.searchParams.get('week_start') || isoMonday(today);
  const force = url.searchParams.get('force') === '1';

  try {
    // Freshness: if a fresh brief exists for the week, return it (unless forced).
    const { data: existing } = await supabase.from('content_briefs').select('brief_json, valid_until').eq('week_start', weekStart).maybeSingle();
    if (!force && existing && existing.valid_until && new Date(existing.valid_until) > new Date()) {
      return new Response(JSON.stringify({ ok: true, cached: true, week_start: weekStart, brief: existing.brief_json }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load this week's harvested docs.
    const { data: docs } = await supabase.from('content_signals')
      .select('id, source, doc_type, text, url, role, rising_label, rising_value, engagement')
      .eq('week_start', weekStart).limit(1200);

    if (!docs || docs.length < 8) {
      return new Response(JSON.stringify({ ok: false, week_start: weekStart, error: 'insufficient_docs', docs: docs?.length || 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Seed taxonomy + last week's topic slugs (for continuity + velocity).
    const { data: seeds } = await supabase.from('content_topics').select('label, slug, taxonomy').eq('is_seed', true);
    const prevWeek = isoMonday(new Date(new Date(weekStart + 'T00:00:00Z').getTime() - 7 * 86400000).toISOString().slice(0, 10));
    const { data: prevTopics } = await supabase.from('content_topics').select('slug, label, doc_count, total_engagement').eq('week_start', prevWeek).eq('is_seed', false);
    const prevBySlug: Record<string, any> = {};
    for (const p of (prevTopics || [])) prevBySlug[p.slug] = p;

    // Build a compact LLM input. Prioritize rising/breakout + high-engagement docs, cap ~450.
    const ranked = [...docs].sort((a, b) => {
      const ra = (a.rising_label ? 100 : 0) + (a.rising_value || 0) + (a.engagement || 0);
      const rb = (b.rising_label ? 100 : 0) + (b.rising_value || 0) + (b.engagement || 0);
      return rb - ra;
    }).slice(0, 450);
    const docLines = ranked.map((d, i) => `${i}|${d.source}|${d.doc_type}|${(d.role || '-')}|${d.rising_label || '-'}|${(d.text || '').slice(0, 140)}`).join('\n');
    const seedList = (seeds || []).map(s => `${s.slug} (${s.label})`).join(', ');
    const prevList = Object.keys(prevBySlug).map(s => `${s} (${prevBySlug[s].label})`).join(', ') || 'none yet';

    const prompt = `You are the content-intelligence analyst for Fractionl Pulse, serving fractional executives (CFO, CMO, CTO, COO, CRO, interim CEO).
Below are ${ranked.length} text signals harvested this week (index|source|doc_type|role|rising_label|text). rising_label like "Breakout" or "+250%" means Google flagged that query as rising.

SIGNALS:
${docLines}

Cluster these into 6-12 coherent CONTENT TOPICS for fractional-exec content planning. Prefer reusing these existing topic slugs when a topic matches (keeps week-over-week tracking stable):
SEED TAXONOMY: ${seedList}
LAST WEEK'S TOPICS: ${prevList}

For EACH topic return: a short human label; a stable kebab-case slug (reuse a seed/last-week slug if it fits, else coin one); a taxonomy bucket from [pricing, ai, equity, fundraising, revops, hiring, tooling, regulation, other]; a 1-2 sentence summary of what is rising/changing; the dominant role (cfo/cmo/cto/coo/cro/ceo/general); the integer indices of its member signals; and 1-3 content angles, each {angle (a ready-to-write headline/hook for a fractional exec), format (linkedin|newsletter|podcast|blog), rationale (why now, grounded in the signals)}.

Also return: breakout QUESTIONS (canonical, deduped, the literal questions the audience is asking, from question-type and rising signals), each {question, topic_slug, is_new (true if it feels newly emerging)}; and a SATURATED list of 2-5 over-covered angles to avoid this week.

Return ONLY JSON: {"topics":[{"label","slug","taxonomy","summary","role","doc_indices":[int],"angles":[{"angle","format","rationale"}]}],"questions":[{"question","topic_slug","is_new"}],"saturated":[string]}
Be specific and grounded in the signals. No fluff.`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.4, max_tokens: 4096 }),
      signal: AbortSignal.timeout(60000),
    });
    if (!aiRes.ok) throw new Error(`OpenAI: ${await aiRes.text()}`);
    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '';
    const truncated = aiData.choices?.[0]?.finish_reason === 'length';
    let parsed: any = {};
    try { parsed = JSON.parse(rawContent); } catch (e) { console.error('[ContentRadar] JSON parse failed', truncated ? '(response truncated at max_tokens)' : '', (e as Error).message); parsed = {}; }
    const llmTopics: any[] = Array.isArray(parsed.topics) ? parsed.topics : [];
    const llmQuestions: any[] = Array.isArray(parsed.questions) ? parsed.questions : [];
    const saturated: string[] = Array.isArray(parsed.saturated) ? parsed.saturated.slice(0, 6) : [];

    // Never write an empty week.
    if (llmTopics.length === 0) {
      return new Response(JSON.stringify({ ok: false, week_start: weekStart, error: 'no_topics_parsed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Score each topic from its member docs.
    type Scored = { label: string; slug: string; taxonomy: string; summary: string; role: string; angles: any[]; docCount: number; engagement: number; sources: string[]; isBreakout: boolean; examples: any[]; rawScore: number; velocity: number; novelty: number; };
    const scored: Scored[] = [];
    for (const tp of llmTopics) {
      const idxs: number[] = [...new Set<number>((Array.isArray(tp.doc_indices) ? tp.doc_indices : []).filter((n: any) => Number.isInteger(n) && n >= 0 && n < ranked.length))];
      const members = idxs.map(i => ranked[i]);
      const docCount = Math.max(members.length, 1);
      const engagement = members.reduce((s, m) => s + (m.engagement || 0), 0);
      const sources = [...new Set(members.map(m => m.source))];
      const isBreakout = members.some(m => /breakout/i.test(m.rising_label || '') || (m.rising_value || 0) >= 300);
      const examples = members.slice(0, 4).map(m => ({ text: m.text, url: m.url, source: m.source }));
      const slug = slugify(tp.slug || tp.label);
      const thisScore = docCount + Math.log10(1 + engagement);
      const prev = prevBySlug[slug];
      const prevScore = prev ? (prev.doc_count || 0) + Math.log10(1 + (prev.total_engagement || 0)) : 0;
      // No prior-week row for this slug means there is no real week-over-week delta yet
      // (velocity only becomes meaningful from week 2); report 0 rather than the raw score.
      const velocity = prev ? thisScore - prevScore : 0;
      scored.push({ label: tp.label || slug, slug, taxonomy: tp.taxonomy || 'other', summary: tp.summary || '', role: tp.role || 'general', angles: Array.isArray(tp.angles) ? tp.angles.slice(0, 3) : [], docCount, engagement, sources, isBreakout, examples, rawScore: thisScore, velocity, novelty: 0 });
    }

    // Novelty: how long this slug has existed (non-seed history).
    const slugs = scored.map(s => s.slug);
    const { data: history } = await supabase.from('content_topics').select('slug, week_start').in('slug', slugs).eq('is_seed', false).lt('week_start', weekStart);
    const firstSeen: Record<string, string> = {};
    for (const h of (history || [])) if (!firstSeen[h.slug] || h.week_start < firstSeen[h.slug]) firstSeen[h.slug] = h.week_start;
    for (const s of scored) {
      if (!firstSeen[s.slug]) { s.novelty = 1; }
      else { const weeks = Math.max(1, Math.round((new Date(weekStart).getTime() - new Date(firstSeen[s.slug]).getTime()) / (7 * 86400000))); s.novelty = 1 / (1 + weeks); }
    }

    // Normalize velocity + engagement across topics → radar_score.
    const vels = scored.map(s => s.velocity); const minV = Math.min(...vels), maxV = Math.max(...vels);
    const engs = scored.map(s => Math.log10(1 + s.engagement)); const maxE = Math.max(...engs, 0.0001);
    for (const s of scored) {
      const nVel = maxV > minV ? (s.velocity - minV) / (maxV - minV) : 0.5;
      const nEng = Math.log10(1 + s.engagement) / maxE;
      let score = Math.round(100 * (0.55 * nVel + 0.30 * s.novelty + 0.15 * nEng));
      if (s.isBreakout) score = Math.max(score, 75);
      (s as any).radar_score = Math.max(0, Math.min(100, score));
    }
    scored.sort((a, b) => (b as any).radar_score - (a as any).radar_score);

    // Dedup by slug (the unique key) so a repeated slug from the LLM cannot crash the upsert
    // (ON CONFLICT cannot affect the same row twice). Keep the highest-scored instance.
    const bySlug = new Map<string, Scored>();
    for (const s of scored) if (!bySlug.has(s.slug)) bySlug.set(s.slug, s);
    const topics = [...bySlug.values()];

    // Build all rows BEFORE any delete, then write with error checks so a failure surfaces
    // (throws -> the prior good week is preserved by the brief never-overwrite discipline).
    const topicRows = topics.map(s => ({
      week_start: weekStart, label: s.label, slug: s.slug, taxonomy: s.taxonomy, summary: s.summary, role: s.role,
      doc_count: s.docCount, total_engagement: s.engagement, velocity: Math.round(s.velocity * 100) / 100, novelty: Math.round(s.novelty * 100) / 100,
      radar_score: (s as any).radar_score, is_breakout: s.isBreakout, is_seed: false, angles: s.angles, sources: s.sources, example_docs: s.examples,
    }));
    const qRows = llmQuestions.filter(q => q && q.question).slice(0, 40).map(q => ({
      week_start: weekStart, question: String(q.question).slice(0, 280), topic_slug: q.topic_slug || null, is_new: q.is_new !== false, source_count: 1,
    }));

    await supabase.from('content_topics').delete().eq('week_start', weekStart).eq('is_seed', false);
    if (topicRows.length) { const { error } = await supabase.from('content_topics').upsert(topicRows, { onConflict: 'week_start,slug' }); if (error) throw error; }
    await supabase.from('content_questions').delete().eq('week_start', weekStart);
    if (qRows.length) { const { error } = await supabase.from('content_questions').insert(qRows); if (error) throw error; }

    // Confidence = share of expected sources that produced docs this week.
    const activeSources = new Set(docs.map(d => d.source));
    const confidence = Math.round((EXPECTED_SOURCES.filter(s => activeSources.has(s)).length / EXPECTED_SOURCES.length) * 100) / 100;

    // Compose the brief deterministically (grounded; angles already came from the LLM).
    const topN = topics.slice(0, 5);
    const briefJson = {
      week_start: weekStart,
      rising_topics: topN.map(s => ({ label: s.label, slug: s.slug, radar_score: (s as any).radar_score, velocity: Math.round(s.velocity * 100) / 100, is_breakout: s.isBreakout, summary: s.summary, role: s.role, why: s.examples.map(e => e.text).slice(0, 3), sources: s.sources })),
      breakout_questions: qRows.filter(q => q.is_new).slice(0, 6).map(q => q.question),
      priority_angles: topN.flatMap(s => (s.angles || []).map((a: any) => ({ topic: s.label, ...a }))).slice(0, 5),
      saturated,
      stats: { docs: docs.length, topics: scored.length, questions: qRows.length, confidence },
    };
    const md = [
      `# Fractional Content Radar: week of ${weekStart}`,
      ``,
      `_${docs.length} signals across ${activeSources.size} sources. Confidence ${Math.round(confidence * 100)}%._`,
      ``,
      `## Rising topics`,
      ...topN.map((s, i) => `${i + 1}. **${s.label}**: radar ${(s as any).radar_score}/100${s.isBreakout ? ' 🚀 breakout' : ''} (velocity ${s.velocity > 0 ? '+' : ''}${Math.round(s.velocity * 10) / 10})\n   ${s.summary || ''}${s.examples[0] ? `\n   _why: ${s.examples.slice(0, 2).map(e => e.text).join(' · ')}_` : ''}`),
      ``,
      `## Breakout questions`,
      ...(briefJson.breakout_questions.length ? briefJson.breakout_questions.map(q => `- ${q}`) : ['- (none newly emerging this week)']),
      ``,
      `## Priority angles`,
      ...(briefJson.priority_angles.length ? briefJson.priority_angles.map((a: any) => `- **${a.angle}** _(${a.format})_: ${a.rationale}  \n  topic: ${a.topic}`) : ['- (no angles generated)']),
      ``,
      `## Skip (saturated)`,
      ...(saturated.length ? saturated.map(s => `- ${s}`) : ['- (nothing flagged)']),
    ].join('\n');

    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: briefErr } = await supabase.from('content_briefs').upsert({
      week_start: weekStart, brief_md: md, brief_json: briefJson, model: MODEL,
      topic_count: scored.length, question_count: qRows.length, doc_count: docs.length, confidence,
      generated_at: new Date().toISOString(), valid_until: validUntil,
    }, { onConflict: 'week_start' });
    if (briefErr) throw briefErr;

    return new Response(JSON.stringify({ ok: true, cached: false, week_start: weekStart, topics: scored.length, questions: qRows.length, confidence, brief: briefJson }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[ContentRadar] Failed:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message, week_start: weekStart }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
