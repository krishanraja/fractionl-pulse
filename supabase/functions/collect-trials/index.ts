// collect-trials: the trial lane (docs/CITABILITY.md, "Rebuild plan").
//
// Collects candidate inputs and stores them as signal_type 'candidate'. Nothing
// that computes or publishes the index reads that type, so a trial can never
// move a published number. Promotion needs the six-check entry gate
// (`npm run trial`) and a ruling by Krish.
//
//   POST /collect-trials                     today's readings (pg_cron, 06:30 UTC)
//   POST /collect-trials?backfill_days=60    rebuild the last N days from each
//                                            trial's own dated archive; rows are
//                                            marked metadata.backfilled = true
//   &only=trial_hn_wide,trial_wikipedia      limit to some trials
//
// Runs from the pipeline's address on purpose: Wikimedia rate-limits shared
// addresses (it refused the sprint container on 2026-10-23).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dataForSeoGet, parseGoogleJobs } from '../_shared/dataforseo.ts';
import { addDays } from '../_shared/fwi-method.ts';
import {
  BRAVE_ROLE_TERMS, FRACTIONAL_WORK, GUARDIAN_TRIAL_QUERY, HN_TRIAL_PHRASES, PODCHASER_TERMS, SCALE_FULL, TRIAL_SOURCES, WIKI_TRIAL_PAGES,
  logScale, trailingZScore,
} from '../_shared/trials.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
const DATAFORSEO = { login: Deno.env.get('DATAFORSEO_LOGIN') || '', password: Deno.env.get('DATAFORSEO_PASSWORD') || '' };
const PODCHASER_ID = Deno.env.get('PODCHASER_CLIENT_ID') || '';
const PODCHASER_SECRET = Deno.env.get('PODCHASER_CLIENT_SECRET') || '';
const UA = 'pulse-fwi/2.0 (+https://pulse.fractionl.ai/methodology; hello@krishraja.com)';

interface Row { date: string; source: string; signal_type: 'candidate'; category: string; raw_value: number; normalized_value: number; metadata: Record<string, unknown> }
const row = (date: string, source: string, category: string, raw: number, norm: number, metadata: Record<string, unknown>): Row =>
  ({ date, source, signal_type: 'candidate', category, raw_value: raw, normalized_value: norm, metadata });

async function getJson(url: string, init: RequestInit = {}, tries = 3): Promise<unknown> {
  let last = '';
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
    if (r.ok) return await r.json();
    last = `HTTP ${r.status}`;
    await new Promise((res) => setTimeout(res, 2500 * (i + 1)));
  }
  throw new Error(`${url.split('?')[0]} -> ${last}`);
}
const ymd = (d: string) => d.replaceAll('-', '');

// ---- trial_google_jobs: the depth-100 tasks prepare-dataforseo-jobs submits
async function googleJobs(date: string): Promise<Row[]> {
  const { data } = await supabase.from('pipeline_runs').select('metadata')
    .eq('source', 'prepare-dataforseo-jobs').contains('metadata', { target_date: date })
    .order('started_at', { ascending: false }).limit(1).maybeSingle();
  const tasks = ((data?.metadata as { trial_tasks?: Array<{ id?: string; category: string; phrase: string }> } | null)?.trial_tasks) || [];
  if (!tasks.length) throw new Error(`no depth-100 trial tasks prepared for ${date}`);
  const rows: Row[] = [];
  for (const t of tasks) {
    if (!t.id) continue;
    const res = await dataForSeoGet<Record<string, unknown>>(`/serp/google/jobs/task_get/advanced/${encodeURIComponent(t.id)}`, DATAFORSEO);
    const count = parseGoogleJobs(res[0]).length;
    rows.push(row(date, 'trial_google_jobs', t.category, count, logScale(count, SCALE_FULL.trial_google_jobs), { task_id: t.id, phrase: t.phrase, depth: 100, at_cap: count >= 100 }));
  }
  return rows;
}

// Every stored total: the retired podchaser input until the seam, then this trial's own.
// ---- trial_podchaser_relevant: new podcasts actually about fractional work
async function relevantPodcasts(): Promise<Array<{ title: string; start: string }>> {
  const tok = (await getJson('https://api.podchaser.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `mutation { requestAccessToken(input:{grant_type: CLIENT_CREDENTIALS, client_id:"${PODCHASER_ID}", client_secret:"${PODCHASER_SECRET}"}) { access_token } }` }) }, 1) as { data?: { requestAccessToken?: { access_token?: string } } }).data?.requestAccessToken?.access_token;
  if (!tok) throw new Error('Podchaser token refused');
  const seen = new Map<string, string>();
  for (const term of PODCHASER_TERMS) {
    const j = await getJson('https://api.podchaser.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ query: `{ podcasts(searchTerm: ${JSON.stringify(term)}, first: 100, sort: { sortBy: DATE_OF_FIRST_EPISODE, direction: DESCENDING }) { data { title description startDate } } }` }) }, 2) as
      { data?: { podcasts?: { data?: Array<{ title: string; description?: string; startDate?: string }> } } };
    for (const p of j.data?.podcasts?.data || []) {
      if (p.startDate && FRACTIONAL_WORK.test(`${p.title} ${p.description || ''}`)) seen.set(p.title, p.startDate.slice(0, 10));
    }
  }
  return [...seen].map(([title, start]) => ({ title, start }));
}

// ---- trial_wikipedia: mean daily views over the 7 days ending each date
async function wikiDaily(from: string, to: string): Promise<{ byDate: Record<string, number>; pages: string[]; missing: string[] }> {
  const byDate: Record<string, number> = {}; const pages: string[] = []; const missing: string[] = [];
  for (const page of WIKI_TRIAL_PAGES) {
    const r = await fetch(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${page}/daily/${ymd(addDays(from, -7))}/${ymd(to)}`, { headers: { 'User-Agent': UA } });
    if (r.status === 404) { missing.push(page); continue; }
    if (!r.ok) throw new Error(`Wikimedia ${page} -> HTTP ${r.status}`);
    pages.push(page);
    for (const it of ((await r.json()) as { items?: Array<{ timestamp: string; views: number }> }).items || []) {
      const d = `${it.timestamp.slice(0, 4)}-${it.timestamp.slice(4, 6)}-${it.timestamp.slice(6, 8)}`;
      byDate[d] = (byDate[d] || 0) + it.views;
    }
  }
  if (!pages.length) throw new Error(`none of the trial pages exist: ${missing.join(', ')}`);
  return { byDate, pages, missing };
}

const windowSum = (byDate: Record<string, number>, date: string, days: number) => {
  let s = 0, n = 0;
  for (let i = 0; i < days; i++) { const v = byDate[addDays(date, -i)]; if (v !== undefined) { s += v; n++; } }
  return n === days ? s : null;
};

// ---- trial_hn_wide: stories + comments over the 30 days ending each date
async function hnCount(date: string): Promise<number> {
  const end = Math.floor(Date.parse(date + 'T23:59:59Z') / 1000), start = end - 30 * 86400;
  let total = 0;
  for (const phrase of HN_TRIAL_PHRASES) {
    const j = await getJson(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(`"${phrase}"`)}&advancedSyntax=true&tags=(story,comment)&hitsPerPage=0&numericFilters=created_at_i>${start},created_at_i<=${end}`, {}, 2) as { nbHits?: number };
    total += Number(j.nbHits || 0);
  }
  return total;
}

// ---- Repairs of inputs retired at the 2026-10-26 seam -----------------------

// trial_trends: the Google Trends raw value scored against its trailing 28 days.
// Raw comes from serpapi_trends until the seam and trial_trends_raw after it.
async function trendsRows(dates: string[], backfilled: boolean): Promise<Row[]> {
  const raw: Record<string, number> = {};
  for (const src of ['serpapi_trends', 'trial_trends_raw']) {
    const { data } = await supabase.from('signals').select('date, raw_value').eq('source', src).gte('date', addDays(dates[0], -40));
    for (const r of data || []) if (Number.isFinite(Number(r.raw_value)) && Number(r.raw_value) > 0) raw[r.date] = Number(r.raw_value);
  }
  return dates.flatMap((d) => {
    if (raw[d] === undefined) return [];
    const trailing = Array.from({ length: 28 }, (_, i) => raw[addDays(d, -(i + 1))]).filter((x) => x !== undefined);
    const score = trailingZScore(raw[d], trailing);
    return score == null ? [] : [row(d, 'trial_trends', 'search_interest_z', raw[d], score, { trailing_days: trailing.length, backfilled })];
  });
}

const BRAVE = Deno.env.get('BRAVE_API_KEY') || '';
async function braveCount(path: string, q: string, freshness: string, pageSize: number): Promise<{ count: number; capped: boolean; hosts: string[] }> {
  let count = 0;
  const hosts: string[] = [];
  for (let offset = 0; offset < 5; offset++) {
    await new Promise((r) => setTimeout(r, 1200));
    const j = await getJson(`https://api.search.brave.com/res/v1/${path}?q=${encodeURIComponent(q)}&count=${pageSize}&offset=${offset}&freshness=${freshness}${path === 'web/search' ? '&result_filter=web' : ''}`,
      { headers: { 'X-Subscription-Token': BRAVE, Accept: 'application/json' } }, 2) as { results?: unknown[]; web?: { results?: unknown[] }; query?: { more_results_available?: boolean } };
    const items = (j.results ?? j.web?.results ?? []) as Array<{ url?: string }>;
    const got = items.length;
    count += got;
    for (const it of items) { try { hosts.push(new URL(it.url || '').hostname.replace(/^www\./, '')); } catch { /* no url */ } }
    if (got < pageSize || j.query?.more_results_available === false) return { count, capped: false, hosts };
  }
  return { count, capped: true, hosts };
}

// ?diagnose=repairs: test whether a retired input has a simple repair
// (Krish, 2026-10-23: "make sure you are not treating data sources as
// unfixable and instead just retiring them when there was a pretty simple fix").
// Runs candidate queries with the pipeline's own keys and returns counts and
// provider error text only. Stores nothing; about a dozen Brave calls.
async function diagnoseRepairs(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const safe = async (label: string, fn: () => Promise<unknown>) => { try { out[label] = await fn(); } catch (e) { out[label] = `error: ${(e as Error).message}`; } };
  const end = new Date().toISOString().slice(0, 10), start = addDays(end, -90);
  const G = Deno.env.get('GUARDIAN_API_KEY') || '';
  const guardian = async (q: string, extra = '') => {
    const r = await fetch(`https://content.guardianapis.com/search?q=${encodeURIComponent(q)}&from-date=${start}&to-date=${end}&page-size=1${extra}&api-key=${G}`, { headers: { 'User-Agent': UA } });
    const j = await r.json() as { response?: { status?: string; total?: number; message?: string }; message?: string };
    return { http: r.status, status: j.response?.status, total: j.response?.total, message: j.response?.message ?? j.message };
  };
  await safe('guardian_current', () => guardian('"fractional executive" OR "fractional CFO"'));
  await safe('guardian_fractional_word', () => guardian('fractional AND (executive OR CFO OR director OR leadership)'));
  await safe('guardian_interim', () => guardian('"interim chief executive" OR "interim CEO" OR "interim finance director"'));
  await safe('guardian_portfolio_career', () => guardian('"portfolio career" OR "fractional"'));
  const M = Deno.env.get('MEDIASTACK_API_KEY') || '';
  const mediastack = async (kw: string, extra = '') => {
    const r = await fetch(`http://api.mediastack.com/v1/news?access_key=${M}&keywords=${encodeURIComponent(kw)}&languages=en&limit=1${extra}`);
    const j = await r.json() as { pagination?: { total?: number }; error?: { code?: string; message?: string } };
    return { http: r.status, total: j.pagination?.total, error: j.error ? `${j.error.code}: ${j.error.message}` : null };
  };
  await safe('mediastack_current', () => mediastack('fractional executive', '&countries=us,gb'));
  await safe('mediastack_fractional', () => mediastack('fractional'));
  await safe('mediastack_with_dates', () => mediastack('fractional', `&date=${addDays(end, -30)},${end}`));
  const B = Deno.env.get('BRAVE_API_KEY') || '';
  const brave = async (path: string, q: string, extra: string) => {
    await new Promise((r) => setTimeout(r, 1200));
    const r = await fetch(`https://api.search.brave.com/res/v1/${path}?q=${encodeURIComponent(q)}${extra}`, { headers: { 'X-Subscription-Token': B, Accept: 'application/json' } });
    const j = await r.json() as { results?: unknown[]; web?: { results?: unknown[] }; query?: { more_results_available?: boolean } };
    return { http: r.status, returned: (j.results ?? j.web?.results ?? []).length, more_available: j.query?.more_results_available ?? null };
  };
  const roles = '"fractional CFO" OR "fractional CMO" OR "fractional CTO" OR "fractional executive"';
  await safe('brave_news_month_20', () => brave('news/search', roles, '&count=20&freshness=pm'));
  await safe('brave_news_week_50', () => brave('news/search', roles, '&count=50&freshness=pw'));
  await safe('brave_news_day_50', () => brave('news/search', roles, '&count=50&freshness=pd'));
  await safe('brave_web_week_20', () => brave('web/search', '"fractional CFO"', '&count=20&freshness=pw&result_filter=web'));
  await safe('brave_web_day_20', () => brave('web/search', '"fractional CFO"', '&count=20&freshness=pd&result_filter=web'));
  await safe('brave_reddit_week_20', () => brave('web/search', 'site:reddit.com "fractional CFO"', '&count=20&freshness=pw&result_filter=web'));
  await safe('brave_reddit_day_20', () => brave('web/search', 'site:reddit.com "fractional CFO"', '&count=20&freshness=pd&result_filter=web'));
  await safe('brave_linkedin_week_20', () => brave('web/search', 'site:linkedin.com/in "fractional CFO"', '&count=20&freshness=pw&result_filter=web'));
  await safe('brave_linkedin_day_20', () => brave('web/search', 'site:linkedin.com/in "fractional CFO"', '&count=20&freshness=pd&result_filter=web'));
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  // ?diagnose=guardian: the headlines behind each part of GUARDIAN_TRIAL_QUERY
  // over its 90-day window, so every match can be classified. Stores nothing.
  if (url.searchParams.get('diagnose') === 'guardian') {
    const G = Deno.env.get('GUARDIAN_API_KEY') || '';
    const end = new Date().toISOString().slice(0, 10), start = addDays(end, -90);
    const parts = ['"fractional"', '"interim chief executive"', '"interim CEO"', '"interim finance director"', '"interim chief financial officer"', GUARDIAN_TRIAL_QUERY];
    const out: Record<string, unknown> = { window: `${start}..${end}` };
    for (const q of parts) {
      const j = await getJson(`https://content.guardianapis.com/search?q=${encodeURIComponent(q)}&from-date=${start}&to-date=${end}&page-size=50&order-by=newest&api-key=${G}`, {}, 2) as
        { response?: { total?: number; results?: Array<{ webPublicationDate: string; sectionName: string; webTitle: string; webUrl: string }> } };
      out[q] = { total: j.response?.total, articles: (j.response?.results || []).map((a) => `${a.webPublicationDate.slice(0, 10)} [${a.sectionName}] ${a.webTitle} | ${a.webUrl}`) };
    }
    return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  // ?diagnose=relevance: the items behind the text-match trials, so each can be
  // checked for whether it is about fractional leadership at all. Found
  // necessary on 2026-10-23: all 7 Guardian "fractional" matches were
  // unrelated (cricket, F1, fractional jet ownership). Stores nothing; one
  // Mediastack call and three Brave calls.
  if (url.searchParams.get('diagnose') === 'relevance') {
    const out: Record<string, unknown> = {};
    const M = Deno.env.get('MEDIASTACK_API_KEY') || '';
    try {
      const j = await (await fetch(`http://api.mediastack.com/v1/news?access_key=${M}&keywords=fractional&languages=en&limit=25`)).json() as { pagination?: { total?: number }; data?: Array<{ title: string; source: string; published_at: string }>; error?: { message?: string } };
      out.mediastack = j.error ? j.error.message : { total: j.pagination?.total, titles: (j.data || []).map((a) => `${a.published_at.slice(0, 10)} [${a.source}] ${a.title}`) };
    } catch (e) { out.mediastack = (e as Error).message; }
    const titles = async (path: string, q: string, fresh: string, n: number) => {
      await new Promise((r) => setTimeout(r, 1200));
      const j = await getJson(`https://api.search.brave.com/res/v1/${path}?q=${encodeURIComponent(q)}&count=${n}&freshness=${fresh}${path === 'web/search' ? '&result_filter=web' : ''}`, { headers: { 'X-Subscription-Token': BRAVE, Accept: 'application/json' } }, 2) as { results?: Array<{ title: string; url: string }>; web?: { results?: Array<{ title: string; url: string }> } };
      return (j.results ?? j.web?.results ?? []).map((r) => `${r.title} | ${r.url}`);
    };
    out.brave_news = await titles('news/search', BRAVE_ROLE_TERMS.join(' OR '), 'pw', 50).catch((e) => (e as Error).message);
    out.brave_web_cfo = await titles('web/search', '"fractional CFO"', 'pw', 20).catch((e) => (e as Error).message);
    out.reddit_cfo = await titles('web/search', 'site:reddit.com "fractional CFO"', 'pm', 20).catch((e) => (e as Error).message);
    for (const term of BRAVE_ROLE_TERMS) out[`brave_web ${term}`] = await titles('web/search', term, 'pw', 20).catch((e) => (e as Error).message);
    const end = Math.floor(Date.now() / 1000);
    const hn: string[] = [];
    for (const phrase of HN_TRIAL_PHRASES) {
      const j = await getJson(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(`"${phrase}"`)}&advancedSyntax=true&tags=(story,comment)&hitsPerPage=8&numericFilters=created_at_i>${end - 30 * 86400}`, {}, 2) as { hits?: Array<{ title?: string; story_title?: string; comment_text?: string }> };
      for (const h of j.hits || []) hn.push(`[${phrase}] ${(h.title || h.story_title || '').slice(0, 80)} :: ${(h.comment_text || '').replace(/<[^>]+>/g, ' ').slice(0, 160)}`);
    }
    out.hn_wide = hn;
    // The live hn input's own query (production, not a trial): stories matching
    // the bare word "fractional" over 30 days. Sampled because live inputs had
    // never been through gate check 0 (2026-10-23).
    const prod = await getJson(`https://hn.algolia.com/api/v1/search?query=%22fractional%22&tags=story&hitsPerPage=50&numericFilters=created_at_i>${end - 30 * 86400}`, {}, 2) as { nbHits?: number; hits?: Array<{ title?: string; url?: string }> };
    out.hn_production = { total: prod.nbHits, titles: (prod.hits || []).map((h) => `${h.title} | ${h.url || ''}`) };
    try {
      const tok = (await getJson('https://api.podchaser.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `mutation { requestAccessToken(input:{grant_type: CLIENT_CREDENTIALS, client_id:"${PODCHASER_ID}", client_secret:"${PODCHASER_SECRET}"}) { access_token } }` }) }, 1) as { data?: { requestAccessToken?: { access_token?: string } } }).data?.requestAccessToken?.access_token;
      const j = await getJson('https://api.podchaser.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ query: '{ podcasts(searchTerm: "fractional executive", first: 50, sort: { sortBy: DATE_OF_FIRST_EPISODE, direction: DESCENDING }) { paginatorInfo { total } data { title } } }' }) }, 1) as { data?: { podcasts?: { paginatorInfo?: { total?: number }; data?: Array<{ title: string }> } }; errors?: Array<{ message: string }> };
      out.podchaser = j.errors ? j.errors.map((e) => e.message) : { total: j.data?.podcasts?.paginatorInfo?.total, newest_titles: (j.data?.podcasts?.data || []).map((p) => p.title) };
    } catch (e) { out.podchaser = (e as Error).message; }
    return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  // ?diagnose=podchaser: repair attempt for trial_podchaser_flow, which failed
  // gate check 0 (about 3 of the 50 newest "fractional executive" matches are
  // about fractional leadership; Podchaser's search is fuzzy). Counts only new
  // podcasts whose title or description names fractional executive work.
  if (url.searchParams.get('diagnose') === 'podchaser') {
    const tok = (await getJson('https://api.podchaser.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `mutation { requestAccessToken(input:{grant_type: CLIENT_CREDENTIALS, client_id:"${PODCHASER_ID}", client_secret:"${PODCHASER_SECRET}"}) { access_token } }` }) }, 1) as { data?: { requestAccessToken?: { access_token?: string } } }).data?.requestAccessToken?.access_token;
    const pattern = /\bfractional\s+(c[a-z]o|chief|executive|exec|leader|leadership|cfo|cmo|cto|coo|cro|ceo)/i;
    const out: Record<string, unknown> = {};
    for (const term of ['fractional executive', 'fractional CFO', 'fractional CMO', 'fractional CTO']) {
      const j = await getJson('https://api.podchaser.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ query: `{ podcasts(searchTerm: ${JSON.stringify(term)}, first: 100, sort: { sortBy: DATE_OF_FIRST_EPISODE, direction: DESCENDING }) { paginatorInfo { total } data { title description startDate } } }` }) }, 1) as
        { data?: { podcasts?: { paginatorInfo?: { total?: number }; data?: Array<{ title: string; description?: string; startDate?: string }> } }; errors?: Array<{ message: string }> };
      if (j.errors) { out[term] = j.errors.map((e) => e.message); continue; }
      const items = j.data?.podcasts?.data || [];
      const relevant = items.filter((p) => pattern.test(`${p.title} ${p.description || ''}`));
      out[term] = { total: j.data?.podcasts?.paginatorInfo?.total, sampled: items.length, relevant: relevant.length,
        relevant_titles: relevant.map((p) => `${(p.startDate || '').slice(0, 10)} ${p.title}`), oldest_sampled: items.at(-1)?.startDate?.slice(0, 10) };
    }
    return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (url.searchParams.get('diagnose') === 'repairs') {
    return new Response(JSON.stringify(await diagnoseRepairs(), null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const today = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const backfillDays = Math.max(0, Math.min(90, Number(url.searchParams.get('backfill_days') || 0)));
  const only = (url.searchParams.get('only') || '').split(',').filter(Boolean);
  const want = (s: string) => (!only.length || only.includes(s)) && TRIAL_SOURCES.includes(s);
  const dates = backfillDays ? Array.from({ length: backfillDays }, (_, i) => addDays(today, -(backfillDays - i))) : [today];
  const from = dates[0], to = dates.at(-1)!;
  const backfilled = backfillDays > 0;
  const rows: Row[] = [];
  const report: Record<string, string> = {};

  const attempt = async (source: string, fn: () => Promise<Row[]>) => {
    if (!want(source)) return;
    try { const r = await fn(); rows.push(...r); report[source] = `${r.length} rows`; }
    catch (e) { report[source] = `failed: ${(e as Error).message}`; console.error(`[trials] ${source}:`, (e as Error).message); }
  };

  if (!backfilled) await attempt('trial_google_jobs', () => googleJobs(today));
  await attempt('trial_podchaser_relevant', async () => {
    const shows = await relevantPodcasts();
    return dates.map((d) => {
      const n = shows.filter((p) => p.start > addDays(d, -90) && p.start <= d).length;
      return row(d, 'trial_podchaser_relevant', 'relevant_new_90d', n, logScale(n, SCALE_FULL.trial_podchaser_relevant),
        { backfilled, note: backfilled ? 'backfilled from each show\'s first-episode date; a show indexed after it started is counted from its start date' : undefined });
    });
  });
  await attempt('trial_wikipedia', async () => {
    const w = await wikiDaily(from, to);
    return dates.flatMap((d) => { const s = windowSum(w.byDate, d, 7); return s == null ? [] : [row(d, 'trial_wikipedia', 'interim_fractional_pages', Math.round(s / 7), logScale(s / 7, SCALE_FULL.trial_wikipedia), { pages: w.pages, missing_pages: w.missing, backfilled })]; });
  });
  await attempt('trial_hn_wide', async () => {
    const out: Row[] = [];
    for (const d of dates) { const n = await hnCount(d); out.push(row(d, 'trial_hn_wide', 'mentions_30d', n, logScale(n, SCALE_FULL.trial_hn_wide), { phrases: HN_TRIAL_PHRASES, backfilled })); }
    return out;
  });

  await attempt('trial_trends', () => trendsRows(dates, backfilled));
  if (!backfilled) {
    await attempt('trial_brave_news', async () => {
      // Distinct publishing sites, not results (Ruling, Krish, 2026-10-23): one
      // SEO publisher supplied 16 of 22 results on 2026-10-23.
      const r = await braveCount('news/search', BRAVE_ROLE_TERMS.join(' OR '), 'pw', 50);
      const sites = new Set(r.hosts);
      const top = [...sites].map((h) => [h, r.hosts.filter((x) => x === h).length] as const).sort((a, b) => b[1] - a[1])[0];
      return [row(today, 'trial_brave_news', 'distinct_sites_7d', sites.size, logScale(sites.size, SCALE_FULL.trial_brave_news),
        { results: r.count, capped: r.capped, top_site: top ? { host: top[0], results: top[1] } : null })];
    });
    await attempt('trial_brave_web', async () => {
      let total = 0, capped = false;
      for (const term of BRAVE_ROLE_TERMS) { const r = await braveCount('web/search', term, 'pw', 20); total += r.count; capped ||= r.capped; }
      return [row(today, 'trial_brave_web', 'results_7d', total, logScale(total, SCALE_FULL.trial_brave_web), { terms: BRAVE_ROLE_TERMS, capped })];
    });
    await attempt('trial_reddit', async () => {
      let total = 0, capped = false;
      for (const term of BRAVE_ROLE_TERMS) { const r = await braveCount('web/search', `site:reddit.com ${term}`, 'pm', 20); total += r.count; capped ||= r.capped; }
      return [row(today, 'trial_reddit', 'results_30d', total, logScale(total, SCALE_FULL.trial_reddit), { terms: BRAVE_ROLE_TERMS, capped })];
    });
  }

  if (rows.length) {
    const { error } = await supabase.from('signals').upsert(rows, { onConflict: 'date,source,signal_type,category' });
    if (error) return new Response(JSON.stringify({ error: error.message, report }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  await supabase.from('pipeline_runs').insert({
    source: 'collect-trials', started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    status: Object.values(report).some((v) => v.startsWith('failed')) ? 'error' : 'success',
    records_inserted: rows.length, metadata: { target_date: today, backfill_days: backfillDays, report },
  });
  return new Response(JSON.stringify({ ok: true, date: today, backfill_days: backfillDays, rows: rows.length, report }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
