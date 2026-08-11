import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Content Radar harvester. Where ingest-signals COUNTS sources into a 0-100 number,
// this keeps the TEXT (rising queries, questions, headlines, post/episode/video titles,
// job themes) as content_signals rows for the weekly clustering pass. Reuses the hardened
// ingest-signals patterns: per-host throttle, per-collector soft timeout, pipeline_runs +
// data_source_health instrumentation. Runs weekly (after the FWI ingest), not daily.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SERP_API_KEY = Deno.env.get('SERP_API_KEY') || '';
const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') || '';
const NEWS_API_KEY = Deno.env.get('NEWS_API_KEY') || '';
const MEDIASTACK_API_KEY = Deno.env.get('MEDIASTACK_API_KEY') || '';
const GUARDIAN_API_KEY = Deno.env.get('GUARDIAN_API_KEY') || '';
const PODCHASER_API_KEY = Deno.env.get('PODCHASER_API_KEY') || '';
const PODCHASER_CLIENT_ID = Deno.env.get('PODCHASER_CLIENT_ID') || '';
const PODCHASER_CLIENT_SECRET = Deno.env.get('PODCHASER_CLIENT_SECRET') || '';
const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY') || '';
const APIFY_API_KEY = Deno.env.get('APIFY_API_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SKIP_SOURCES = (Deno.env.get('SKIP_CONTENT_SOURCES') || '').split(',').map(s => s.trim()).filter(Boolean);
const shouldSkip = (s: string) => SKIP_SOURCES.includes(s);

// Per-source diagnostics surfaced in the response to explain 0-doc sources (key state + last error).
const SRC_DIAG: Record<string, string> = {};
const diag = (k: string, v: string) => { SRC_DIAG[k] = v; };

// ---- Fractional vocabulary (the curated niche the whole product is tuned to) ----
const ROLES = [
  { phrase: 'fractional CFO', role: 'cfo' },
  { phrase: 'fractional CMO', role: 'cmo' },
  { phrase: 'fractional CTO', role: 'cto' },
  { phrase: 'fractional COO', role: 'coo' },
  { phrase: 'fractional CRO', role: 'cro' },
  { phrase: 'interim CEO', role: 'ceo' },
  { phrase: 'fractional executive', role: 'general' },
];
const SUBREDDITS = ['fractional', 'CFO', 'CMO', 'smallbusiness', 'Entrepreneur', 'startups', 'agency'];
const AUTOCOMPLETE_PREFIXES = ['how', 'what', 'when', 'why', 'is', 'vs', 'cost of', 'should i hire'];
// Curated fractional-friendly ATS boards (Greenhouse/Lever/Ashby tokens). Sparse hits are fine;
// the value is theme extraction when a fractional/interim role does appear.
const ATS_BOARDS = {
  greenhouse: ['andela', 'gusto', 'brex', 'ramp', 'mercury', 'vanta', 'rippling'],
  lever: ['fractional', 'gopuff', 'plaid', 'netlify'],
  ashby: ['ashby', 'runway', 'linear', 'posthog'],
};
const FRACTIONAL_RE = /fractional|interim|part[- ]?time (chief|head of|c[a-z]o)|\b\d+\s*days?\s*(a|per)\s*week\b/i;
const MARKETPLACES = [
  { name: 'gofractional', url: 'https://www.gofractional.com/fractional-executives' },
  { name: 'fractionaljobs', url: 'https://www.fractionaljobs.io/' },
  { name: 'continuum', url: 'https://www.continuum.work/' },
  { name: 'catalant', url: 'https://gocatalant.com/' },
  { name: 'contra', url: 'https://contra.com/' },
];

interface ContentDoc {
  source: string;
  doc_type: string;
  text: string;
  url?: string;
  role?: string;
  rising_label?: string;
  rising_value?: number;
  engagement?: number;
  raw?: Record<string, unknown>;
}

function safeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// FNV-1a 32-bit hash → 8 hex chars; ample for weekly within-source dedup.
function textHash(s: string): string {
  let h = 2166136261 >>> 0;
  const t = s.toLowerCase().trim();
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

function isoMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

const isQuestion = (s: string) => s.trim().endsWith('?') || /^(how|what|why|when|where|should|is|are|do|does|can|will)\b/i.test(s.trim());

// ---- Per-host throttle (copied from the hardened ingest-signals) ----
const HOST_MIN_INTERVAL_MS: Record<string, number> = {
  'serpapi.com': 1500,
  'api.search.brave.com': 1200,
};
const hostNextSlot: Record<string, number> = {};
async function throttleHost(host: string): Promise<void> {
  const minInterval = HOST_MIN_INTERVAL_MS[host];
  if (!minInterval) return;
  const now = Date.now();
  const slot = Math.max(now, hostNextSlot[host] || 0);
  hostNextSlot[host] = slot + minInterval;
  const wait = slot - now;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const secs = parseInt(value, 10);
  if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 10000);
  const when = Date.parse(value);
  if (Number.isFinite(when)) return Math.min(Math.max(when - Date.now(), 0), 10000);
  return null;
}

async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 2, timeoutMs = 10000): Promise<Response> {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* noop */ }
  await throttleHost(host);
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      lastError = new Error(`HTTP ${res.status}`);
      if (res.status === 429 && attempt < maxRetries) {
        const backoff = parseRetryAfter(res.headers.get('retry-after')) ?? Math.min(Math.pow(2, attempt) * 1000, 8000);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
    } catch (e) { lastError = e as Error; }
    if (attempt < maxRetries) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
  }
  throw lastError || new Error('fetchWithRetry exhausted');
}

// Per-collector soft timeout → degrade to [] so one slow vendor never blocks the run.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const t = setTimeout(() => { if (!settled) { settled = true; console.warn(`[Timeout] ${label} > ${ms}ms`); resolve(fallback); } }, ms);
    p.then(v => { if (!settled) { settled = true; clearTimeout(t); resolve(v); } },
           () => { if (!settled) { settled = true; clearTimeout(t); resolve(fallback); } });
  });
}

// ============================================================
// COLLECTORS (each returns ContentDoc[], catches internally)
// ============================================================

async function harvestSerpRelated(): Promise<ContentDoc[]> {
  if (!SERP_API_KEY || shouldSkip('serpapi_related')) return [];
  const docs: ContentDoc[] = [];
  for (const { phrase, role } of ROLES) {
    try {
      const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(phrase)}&data_type=RELATED_QUERIES&geo=US&api_key=${SERP_API_KEY}`;
      const res = await fetchWithRetry(url, {}, 2, 15000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rq = data.related_queries || {};
      for (const bucket of ['rising', 'top']) {
        for (const item of (rq[bucket] || [])) {
          const q = item.query || '';
          if (!q) continue;
          docs.push({
            source: 'serpapi_related', doc_type: 'search_term', text: q, role,
            rising_label: bucket === 'rising' ? String(item.value || '') : undefined,
            rising_value: safeNumber(item.extracted_value, 0) || undefined,
            raw: { seed: phrase, bucket },
          });
        }
      }
      console.log(`[SerpRelated] ${phrase}: ${docs.length} cumulative`);
    } catch (e) { console.error(`[SerpRelated] ${phrase}:`, (e as Error).message); }
  }
  return docs;
}

async function harvestSerpPAA(): Promise<ContentDoc[]> {
  if (!SERP_API_KEY || shouldSkip('serpapi_paa')) return [];
  const docs: ContentDoc[] = [];
  for (const { phrase, role } of ROLES) {
    try {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(phrase)}&gl=us&hl=en&api_key=${SERP_API_KEY}`;
      const res = await fetchWithRetry(url, {}, 2, 15000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      for (const item of (data.related_questions || [])) {
        const q = item.question || '';
        if (!q) continue;
        docs.push({ source: 'serpapi_paa', doc_type: 'question', text: q, role, url: item.link, raw: { seed: phrase } });
      }
    } catch (e) { console.error(`[SerpPAA] ${phrase}:`, (e as Error).message); }
  }
  return docs;
}

async function harvestAutocomplete(): Promise<ContentDoc[]> {
  if (shouldSkip('google_autocomplete')) return [];
  const docs: ContentDoc[] = [];
  const seen = new Set<string>();
  for (const { phrase, role } of ROLES) {
    for (const prefix of AUTOCOMPLETE_PREFIXES) {
      try {
        const q = `${prefix} ${phrase}`;
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=${encodeURIComponent(q)}`;
        const res = await fetchWithRetry(url, { headers: { 'User-Agent': 'Mozilla/5.0 (FractionlPulse content radar)' } }, 1, 8000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json(); // [query, [suggestions...]]
        for (const s of (Array.isArray(data?.[1]) ? data[1] : [])) {
          if (typeof s !== 'string' || seen.has(s)) continue;
          seen.add(s);
          docs.push({ source: 'google_autocomplete', doc_type: isQuestion(s) ? 'question' : 'search_term', text: s, role, raw: { prefix } });
        }
        await new Promise(r => setTimeout(r, 300));
      } catch (e) { /* free endpoint, soft-fail per prefix */ }
    }
  }
  return docs;
}

async function harvestNews(): Promise<ContentDoc[]> {
  const docs: ContentDoc[] = [];
  const q = '"fractional CFO" OR "fractional CMO" OR "fractional CTO" OR "fractional executive"';
  // NewsAPI
  if (NEWS_API_KEY && !shouldSkip('newsapi')) {
    try {
      const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&from=${from}&language=en&sortBy=publishedAt&pageSize=30&apiKey=${NEWS_API_KEY}`;
      const res = await fetchWithRetry(url);
      if (res.ok) { const d = await res.json(); for (const a of (d.articles || [])) if (a.title) docs.push({ source: 'newsapi', doc_type: 'headline', text: a.title, url: a.url, raw: { src: a.source?.name } }); }
    } catch (e) { console.error('[News/newsapi]', (e as Error).message); }
  }
  // Mediastack
  if (MEDIASTACK_API_KEY && !shouldSkip('mediastack')) {
    try {
      const url = `http://api.mediastack.com/v1/news?access_key=${MEDIASTACK_API_KEY}&keywords=fractional+executive&languages=en&limit=30&sort=published_desc`;
      const res = await fetchWithRetry(url, {}, 2, 10000);
      if (res.ok) { const d = await res.json(); for (const a of (d.data || [])) if (a.title) docs.push({ source: 'mediastack', doc_type: 'headline', text: a.title, url: a.url, raw: { src: a.source } }); }
    } catch (e) { console.error('[News/mediastack]', (e as Error).message); }
  }
  // Guardian (90-day window — fractional-exec coverage in prestige media is sparse).
  if (GUARDIAN_API_KEY && !shouldSkip('guardian')) {
    try {
      const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const url = `https://content.guardianapis.com/search?q=%22fractional%20executive%22%20OR%20%22fractional%20CFO%22&from-date=${from}&page-size=20&api-key=${GUARDIAN_API_KEY}`;
      const res = await fetchWithRetry(url, {}, 2, 10000);
      if (res.ok) { const d = await res.json(); diag('guardian', `total=${d.response?.total ?? '?'}`); for (const a of (d.response?.results || [])) if (a.webTitle) docs.push({ source: 'guardian', doc_type: 'headline', text: a.webTitle, url: a.webUrl }); }
      else diag('guardian', `HTTP ${res.status}`);
    } catch (e) { console.error('[News/guardian]', (e as Error).message); diag('guardian', 'err: ' + (e as Error).message); }
  }
  // Brave News
  if (BRAVE_API_KEY && !shouldSkip('brave_news')) {
    try {
      const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(q)}&count=20&freshness=pw`;
      const res = await fetchWithRetry(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } }, 2, 8000);
      if (res.ok) { const d = await res.json(); for (const a of (d.results || [])) if (a.title) docs.push({ source: 'brave_news', doc_type: 'headline', text: a.title, url: a.url }); }
    } catch (e) { console.error('[News/brave]', (e as Error).message); }
  }
  return docs;
}

async function harvestBraveWeb(): Promise<ContentDoc[]> {
  if (!BRAVE_API_KEY || shouldSkip('brave_web')) return [];
  const docs: ContentDoc[] = [];
  const terms = ['fractional executive trends', 'hiring a fractional CFO', 'fractional CMO playbook', 'fractional leadership 2026'];
  for (const term of terms) {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(term)}&count=15&freshness=pm&result_filter=web`;
      const res = await fetchWithRetry(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      for (const r of (d.web?.results || [])) if (r.title) docs.push({ source: 'brave_web', doc_type: 'web_result', text: r.title, url: r.url, raw: { term } });
    } catch (e) { console.error('[BraveWeb]', (e as Error).message); }
  }
  return docs;
}

// Reddit's free .json endpoint now serves HTML to unauthenticated/datacenter requests
// (verified 2026-05-31), so harvest Reddit thread titles via Brave web search (site:reddit.com)
// instead. Same audience questions/discourse, a working vendor (reuses BRAVE_API_KEY). The
// SUBREDDITS list is retained as documentation of the communities of interest.
async function harvestReddit(): Promise<ContentDoc[]> {
  if (!BRAVE_API_KEY || shouldSkip('reddit')) { diag('reddit', BRAVE_API_KEY ? 'skipped' : 'no BRAVE_API_KEY'); return []; }
  const docs: ContentDoc[] = [];
  let resultsSeen = 0;
  for (const { phrase, role } of ROLES.slice(0, 5)) {
    try {
      const q = `site:reddit.com "${phrase}"`;
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=15&result_filter=web`;
      const res = await fetchWithRetry(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      resultsSeen += (d.web?.results || []).length;
      for (const r of (d.web?.results || [])) {
        // Brave appends " : r/sub" / " - Reddit" to Reddit result titles; strip it to the thread title.
        const title = (r.title || '').replace(/\s*:\s*r\/[\w-]+.*$/i, '').replace(/\s*[-|]\s*Reddit\s*$/i, '').trim();
        if (!title) continue;
        docs.push({ source: 'reddit', doc_type: isQuestion(title) ? 'question' : 'post_title', text: title, url: r.url, raw: { via: 'brave_site_search', seed: phrase, role } });
      }
    } catch (e) { console.error(`[Reddit via Brave ${phrase}]`, (e as Error).message); diag('reddit', 'err: ' + (e as Error).message); }
  }
  if (!('reddit' in SRC_DIAG)) diag('reddit', `brave_results=${resultsSeen} docs=${docs.length}`);
  return docs;
}

async function harvestHN(): Promise<ContentDoc[]> {
  if (shouldSkip('hn')) return [];
  const docs: ContentDoc[] = [];
  for (const q of ['fractional executive', 'fractional CFO', 'interim CTO']) {
    try {
      const since = Math.floor(Date.now() / 1000) - 30 * 86400;
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=40`;
      const res = await fetchWithRetry(url, {}, 2, 8000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      for (const h of (d.hits || [])) {
        const title = h.title || h.story_title;
        if (!title) continue;
        docs.push({ source: 'hn', doc_type: isQuestion(title) ? 'question' : 'post_title', text: title, url: h.url, engagement: safeNumber(h.points, 0), raw: { comments: h.num_comments } });
      }
    } catch (e) { console.error(`[HN ${q}]`, (e as Error).message); }
  }
  return docs;
}

// Podchaser uses OAuth client-credentials: exchange client_id+secret for a short-lived
// access token each run (auto-refreshing, so it can never silently expire like a hardcoded key).
async function getPodchaserToken(): Promise<string> {
  const r = await fetchWithRetry('https://api.podchaser.com/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `mutation { requestAccessToken(input:{grant_type: CLIENT_CREDENTIALS, client_id:"${PODCHASER_CLIENT_ID}", client_secret:"${PODCHASER_CLIENT_SECRET}"}) { access_token } }` }),
  }, 1, 10000);
  const j = await r.json();
  const tok = j?.data?.requestAccessToken?.access_token;
  if (!tok) throw new Error('token: ' + (j?.errors?.[0]?.message || 'no access_token'));
  return tok;
}

async function harvestPodchaser(): Promise<ContentDoc[]> {
  const haveCreds = PODCHASER_CLIENT_ID && PODCHASER_CLIENT_SECRET;
  if (!haveCreds || shouldSkip('podchaser')) { diag('podchaser', haveCreds ? 'skipped' : 'no Podchaser client creds'); return []; }
  const docs: ContentDoc[] = [];
  try {
    const token = await getPodchaserToken();
    // Match the proven FWI ingest query shape exactly (paginatorInfo + first:50).
    const query = `{ podcasts(searchTerm: "fractional executive", first: 50) { paginatorInfo { total } data { title } } }`;
    const res = await fetchWithRetry('https://api.podchaser.com/graphql', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ query }),
    }, 2, 10000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    if (d.errors) diag('podchaser', 'gql_err: ' + JSON.stringify(d.errors).slice(0, 140));
    else diag('podchaser', `total=${d.data?.podcasts?.paginatorInfo?.total ?? '?'} returned=${(d.data?.podcasts?.data || []).length}`);
    for (const p of (d.data?.podcasts?.data || [])) if (p.title) docs.push({ source: 'podchaser', doc_type: 'podcast_title', text: p.title });
  } catch (e) { console.error('[Podchaser]', (e as Error).message); diag('podchaser', 'err: ' + (e as Error).message); }
  return docs;
}

async function harvestATS(): Promise<ContentDoc[]> {
  if (shouldSkip('ats_boards')) return [];
  const docs: ContentDoc[] = [];
  const pushIfFractional = (title: string, url: string | undefined, company: string) => {
    if (title && FRACTIONAL_RE.test(title)) docs.push({ source: 'ats_boards', doc_type: 'job_theme', text: title, url, raw: { company } });
  };
  // Greenhouse (no content needed for the title-level fractional scan)
  for (const token of ATS_BOARDS.greenhouse) {
    try {
      const res = await fetchWithRetry(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`, {}, 1, 8000);
      if (!res.ok) continue;
      const d = await res.json();
      for (const j of (d.jobs || [])) pushIfFractional(j.title, j.absolute_url, token);
    } catch { /* polite skip */ }
  }
  // Lever
  for (const token of ATS_BOARDS.lever) {
    try {
      const res = await fetchWithRetry(`https://api.lever.co/v0/postings/${token}?mode=json`, {}, 1, 8000);
      if (!res.ok) continue;
      const d = await res.json();
      for (const j of (Array.isArray(d) ? d : [])) pushIfFractional(j.text, j.hostedUrl, token);
    } catch { /* skip */ }
  }
  // Ashby
  for (const token of ATS_BOARDS.ashby) {
    try {
      const res = await fetchWithRetry(`https://api.ashbyhq.com/posting-api/job-board/${token}`, {}, 1, 8000);
      if (!res.ok) continue;
      const d = await res.json();
      for (const j of (d.jobs || [])) pushIfFractional(j.title, j.jobUrl, token);
    } catch { /* skip */ }
  }
  return docs;
}

async function harvestYouTube(): Promise<ContentDoc[]> {
  if (!YOUTUBE_API_KEY || shouldSkip('youtube')) return [];
  const docs: ContentDoc[] = [];
  const publishedAfter = new Date(Date.now() - 60 * 86400000).toISOString();
  for (const { phrase, role } of ROLES.slice(0, 4)) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(phrase)}&type=video&order=viewCount&maxResults=10&relevanceLanguage=en&publishedAfter=${publishedAfter}&key=${YOUTUBE_API_KEY}`;
      const res = await fetchWithRetry(url, {}, 1, 10000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      for (const item of (d.items || [])) {
        const title = item.snippet?.title;
        if (!title) continue;
        docs.push({ source: 'youtube', doc_type: 'video_title', text: title, role, url: item.id?.videoId ? `https://youtube.com/watch?v=${item.id.videoId}` : undefined, raw: { channel: item.snippet?.channelTitle, publishedAt: item.snippet?.publishedAt } });
      }
    } catch (e) { console.error(`[YouTube ${phrase}]`, (e as Error).message); }
  }
  return docs;
}

async function harvestMarketplaces(): Promise<ContentDoc[]> {
  if (!APIFY_API_KEY || shouldSkip('marketplace')) { diag('marketplace', APIFY_API_KEY ? 'skipped' : 'no APIFY_API_KEY'); return []; }
  const docs: ContentDoc[] = [];
  // Lightweight count-only scrape via the Apify generic web-scraper. Aggregate counts only,
  // robots-respecting; we store a single 'listing' doc per marketplace as a supply-movement signal.
  // Scrape each marketplace CONCURRENTLY and bounded, so one slow Apify run cannot starve the
  // others (the sequential version returned 0 for all). Every fetch goes through fetchWithRetry
  // (timeout + retry); the whole collector is still capped by the orchestrator's 60s withTimeout.
  const scrapeOne = async (m: { name: string; url: string }): Promise<ContentDoc[]> => {
    try {
      const runRes = await fetchWithRetry(`https://api.apify.com/v2/acts/apify~web-scraper/runs?token=${APIFY_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: m.url }],
          pageFunction: `async function pageFunction(context){const $=context.jQuery;const n=$('[class*="executive"],[class*="profile"],[class*="card"],[class*="listing"],[class*="job"]').length;return [{count:n}];}`,
          maxPagesPerCrawl: 1,
        }),
      }, 1, 12000);
      if (!runRes.ok) return [];
      const run = await runRes.json();
      const runId = run.data.id, datasetId = run.data.defaultDatasetId;
      let status = 'READY', polls = 0;
      while (status !== 'SUCCEEDED' && status !== 'FAILED' && polls < 6) {
        await new Promise(r => setTimeout(r, 4000));
        const sr = await fetchWithRetry(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`, {}, 1, 8000);
        status = (await sr.json()).data.status; polls++;
      }
      if (status !== 'SUCCEEDED') return [];
      const dsRes = await fetchWithRetry(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`, {}, 1, 8000);
      const items = await dsRes.json();
      const count = safeNumber((Array.isArray(items) ? items[0]?.count : 0), 0);
      return count > 0 ? [{ source: 'marketplace', doc_type: 'listing', text: `${m.name}: ${count} fractional listings`, url: m.url, engagement: count, raw: { marketplace: m.name, count } }] : [];
    } catch (e) { console.error(`[Marketplace ${m.name}]`, (e as Error).message); return []; }
  };
  const settled = await Promise.allSettled(MARKETPLACES.map(scrapeOne));
  for (const r of settled) if (r.status === 'fulfilled') docs.push(...r.value);
  diag('marketplace', `key=${APIFY_API_KEY ? 'set' : 'none'} docs=${docs.length}`);
  return docs;
}

// ============================================================
// ORCHESTRATOR
// ============================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const today = new URL(req.url).searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const weekStart = isoMonday(today);
  console.log(`[ContentHarvest] week_start=${weekStart}`);

  const { data: runData } = await supabase.from('pipeline_runs')
    .insert({ source: 'harvest-content-signals', started_at: new Date().toISOString(), status: 'running', metadata: { week_start: weekStart } })
    .select().single();

  for (const k in hostNextSlot) delete hostNextSlot[k];

  try {
    const T = 60000;
    const t = <X>(p: Promise<X>, fb: X, label: string) => withTimeout(p, T, fb, label);
    const groups = await Promise.all([
      t(harvestSerpRelated(), [] as ContentDoc[], 'serpapi_related'),
      t(harvestSerpPAA(), [] as ContentDoc[], 'serpapi_paa'),
      t(harvestAutocomplete(), [] as ContentDoc[], 'google_autocomplete'),
      t(harvestNews(), [] as ContentDoc[], 'news'),
      t(harvestBraveWeb(), [] as ContentDoc[], 'brave_web'),
      t(harvestReddit(), [] as ContentDoc[], 'reddit'),
      t(harvestHN(), [] as ContentDoc[], 'hn'),
      t(harvestPodchaser(), [] as ContentDoc[], 'podchaser'),
      t(harvestATS(), [] as ContentDoc[], 'ats_boards'),
      t(harvestYouTube(), [] as ContentDoc[], 'youtube'),
      t(harvestMarketplaces(), [] as ContentDoc[], 'marketplace'),
    ]);
    const allDocs = groups.flat();

    // Dedup within (source, text_hash); cap text length.
    const seen = new Set<string>();
    const rows = [];
    for (const d of allDocs) {
      const text = (d.text || '').trim().slice(0, 240);
      if (!text) continue;
      const hash = textHash(text);
      const key = `${d.source}::${hash}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        week_start: weekStart, source: d.source, doc_type: d.doc_type, text,
        url: d.url || null, role: d.role || null,
        rising_label: d.rising_label || null, rising_value: d.rising_value ?? null,
        engagement: d.engagement ?? null, text_hash: hash, raw: d.raw || {},
      });
    }

    if (rows.length > 0) {
      // chunked upsert to keep payloads small
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('content_signals').upsert(rows.slice(i, i + 200), { onConflict: 'week_start,source,text_hash' });
        if (error) throw error;
      }
    }

    // Source health (batched, healthy vs failed by whether the source produced any docs).
    const now = new Date().toISOString();
    const sourceNames = ['serpapi_related', 'serpapi_paa', 'google_autocomplete', 'newsapi', 'mediastack', 'guardian', 'brave_news', 'brave_web', 'reddit', 'hn', 'podchaser', 'ats_boards', 'youtube', 'marketplace'];
    const produced = new Set(allDocs.map(d => d.source));
    const healthy = sourceNames.filter(s => produced.has(s)).map(s => ({ source: s, last_checked: now, last_success: now, status: 'healthy', error_count: 0, metadata: { last_error: null }, updated_at: now }));
    if (healthy.length) await supabase.from('data_source_health').upsert(healthy, { onConflict: 'source' });

    const bySource: Record<string, number> = {};
    for (const d of allDocs) bySource[d.source] = (bySource[d.source] || 0) + 1;

    if (runData?.id) {
      await supabase.from('pipeline_runs').update({
        completed_at: now, status: 'success', records_inserted: rows.length,
        metadata: { week_start: weekStart, by_source: bySource, total_docs: allDocs.length, deduped: rows.length },
      }).eq('id', runData.id);
    }

    // Best-effort: trigger the radar generation right after harvest. The run row is already
    // 'success' above, so a slow radar call here can never strand the harvest run; the timeout
    // bounds total wall-clock under the pg_cron caller timeout. The weekly pg_cron also has a
    // safety path: generate-content-radar is idempotent and can be re-invoked for the week.
    let radar: unknown = { skipped: true };
    try {
      const auth = req.headers.get('Authorization') || `Bearer ${SUPABASE_SERVICE_KEY}`;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-content-radar?week_start=${weekStart}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(70000) });
      radar = r.ok ? await r.json() : { error: `HTTP ${r.status}` };
    } catch (e) { radar = { error: (e as Error).message }; }

    return new Response(JSON.stringify({ success: true, week_start: weekStart, docs_collected: allDocs.length, docs_stored: rows.length, by_source: bySource, diag: SRC_DIAG, radar }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ContentHarvest] Failed:', (error as Error).message);
    if (runData?.id) await supabase.from('pipeline_runs').update({ completed_at: new Date().toISOString(), status: 'error', error: (error as Error).message }).eq('id', runData.id);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
