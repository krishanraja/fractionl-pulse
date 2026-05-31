import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ADZUNA_APP_ID = Deno.env.get('ADZUNA_APP_ID') || '';
const ADZUNA_APP_KEY = Deno.env.get('ADZUNA_APP_KEY') || '';
const APIFY_API_KEY = Deno.env.get('APIFY_API_KEY') || '';
const NEWS_API_KEY = Deno.env.get('NEWS_API_KEY') || '';
const PDL_API_KEY = Deno.env.get('PDL_API_KEY') || '';
const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') || '';
const FRED_API_KEY = Deno.env.get('FRED_API_KEY') || '';
const SERP_API_KEY = Deno.env.get('SERP_API_KEY') || '';
const MEDIASTACK_API_KEY = Deno.env.get('MEDIASTACK_API_KEY') || '';
const PODCHASER_API_KEY = Deno.env.get('PODCHASER_API_KEY') || '';
const GUARDIAN_API_KEY = Deno.env.get('GUARDIAN_API_KEY') || '';
const NYT_API_KEY = Deno.env.get('NYT_API_KEY') || '';
const CENSUS_API_KEY = Deno.env.get('CENSUS_API_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SKIP_SOURCES = (Deno.env.get('SKIP_SOURCES') || '').split(',').map(s => s.trim()).filter(Boolean);

const SOURCE_COST_ESTIMATE: Record<string, number> = {
  adzuna: 0, sec_edgar: 0, newsapi: 0, hn: 0, census_acs: 0, fred: 0, guardian: 0,
  serpapi_jobs: 0.005, serpapi_trends: 0.005, serpapi_linkedin: 0.02, serpapi_supply_trends: 0.005,
  brave_news: 0.003, brave_web: 0.003,
  mediastack: 0, nyt: 0, podchaser: 0,
  people_data_labs: 0.06, reddit: 0, gofractional: 0.01,
  google_trends: 0.01, supply_trends: 0.01,
  bls: 0, wikipedia_pageviews: 0, openalex: 0,
};

function shouldSkip(source: string): boolean {
  if (SKIP_SOURCES.includes(source)) {
    console.log(`[Skip] ${source} is in SKIP_SOURCES, skipping`);
    return true;
  }
  return false;
}

const FRACTIONAL_ROLES = [
  { phrase: 'fractional CFO', category: 'cfo', weight: 1.5 },
  { phrase: 'fractional CMO', category: 'cmo', weight: 1.2 },
  { phrase: 'fractional CTO', category: 'cto', weight: 1.2 },
  { phrase: 'fractional COO', category: 'coo', weight: 1.0 },
  { phrase: 'fractional CRO', category: 'cro', weight: 1.0 },
  { phrase: 'interim CEO', category: 'ceo', weight: 1.3 },
];

const GOOGLE_TRENDS_TERMS = [
  'fractional CMO',
  'fractional CFO',
  'fractional CTO',
  'fractional executive'
];

const SUPPLY_TRENDS_TERMS = [
  'become fractional executive',
  'fractional consulting business',
  'how to be a fractional CFO',
  'fractional executive career',
];

const BRAVE_WEB_SEARCH_TERMS = [
  'fractional executive',
  'fractional CFO hiring',
  'fractional CMO experience',
  'fractional CTO startup',
];

// Note: google_trends, supply_trends (both Apify), people_data_labs (HTTP 404), and
// nyt (HTTP 401) were retired 2026-05-30 — they had been failing every run for weeks and
// are fully covered by serpapi_trends / serpapi_supply_trends / serpapi_linkedin + brave_talent
// / guardian respectively. Removing them keeps the confidence denominator honest.
const SOURCE_CONFIDENCE_WEIGHTS: Record<string, number> = {
  adzuna: 0.12,
  serpapi_jobs: 0.07,
  serpapi_trends: 0.05,
  sec_edgar: 0.09,
  newsapi: 0.04,
  brave_news: 0.03,
  brave_web: 0.03,
  mediastack: 0.03,
  guardian: 0.02,
  podchaser: 0.02,
  reddit: 0.02,
  hn: 0.01,
  serpapi_linkedin: 0.05,
  brave_talent: 0.05,
  gofractional: 0.04,
  serpapi_supply_trends: 0.03,
  fred: 0.01,
  census_acs: 0.01,
  bls: 0.04,
  wikipedia_pageviews: 0.06,
  openalex: 0.02,
};

const WIKIPEDIA_PAGES = [
  'Chief_financial_officer',
  'Chief_marketing_officer',
  'Chief_technology_officer',
  'Self-employment',
  'Independent_contractor',
  'Fractional_ownership',
];

const BLS_SERIES = [
  { id: 'JTS000000000000000JOL', name: 'JOLTS Job Openings', category: 'job_openings', baseline: 7000 },
  { id: 'LNS14000000', name: 'Unemployment Rate', category: 'unemployment', baseline: 4.0 },
  { id: 'CES0500000003', name: 'Avg Hourly Earnings (Private)', category: 'wages', baseline: 35 },
];

const OPENALEX_PHRASES = [
  '"fractional CFO"',
  '"fractional CMO"',
  '"fractional CTO"',
  '"fractional executive"',
  '"interim executive"',
];

interface SignalResult {
  source: string;
  signal_type: 'demand' | 'supply' | 'momentum' | 'context';
  category: string;
  raw_value: number;
  normalized_value: number;
  metadata?: Record<string, any>;
  success: boolean;
  error?: string;
}

function safeNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

// Per-host rate limiter. Several collectors hit the same rate-limited vendor
// (SerpAPI, Brave) concurrently via Promise.all; without spacing they trigger
// 429 storms (this is exactly what floored the supply index May 8-18 2026).
// throttleHost serializes requests to these hosts with a minimum interval.
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
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
}

// Parse a Retry-After header (seconds OR an HTTP-date), capped, else null.
function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const secs = parseInt(value, 10);
  if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 10000);
  const when = Date.parse(value);
  if (Number.isFinite(when)) return Math.min(Math.max(when - Date.now(), 0), 10000);
  return null;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  timeoutMs = 10000
): Promise<Response> {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* non-URL input, no throttle */ }
  // Reserve ONE host slot per call (not per attempt) so a retrying call cannot
  // keep advancing the shared per-host counter and starve sibling collectors.
  await throttleHost(host);
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      // Success, or a non-retryable client error (any 4xx except 429): return as-is.
      if (response.ok || (response.status < 500 && response.status !== 429)) return response;
      lastError = new Error(`HTTP ${response.status}`);
      // 429 = rate limited. Honor Retry-After when present, else exponential backoff.
      if (response.status === 429 && attempt < maxRetries) {
        const backoff = parseRetryAfter(response.headers.get('retry-after'))
          ?? Math.min(Math.pow(2, attempt) * 1000, 8000);
        console.log(`[Retry] 429 from ${host}, waiting ${backoff}ms (attempt ${attempt + 1})...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      // 5xx: fall through to the backoff below and retry.
    } catch (error) {
      lastError = error;
    }
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[Retry] Attempt ${attempt + 1} failed, waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError || new Error('fetchWithRetry exhausted');
}

// Per-collector soft timeout: resolves to `fallback` if the collector has not
// finished within ms, so one slow or rate-limited vendor can never block the whole
// run. This replaces the old single global deadline that discarded EVERY source's
// results on a timeout. The collector keeps running in the background; its late
// result is ignored. Collectors never reject (they catch internally), so the
// catch arm here is just defensive.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const t = setTimeout(() => {
      if (!settled) { settled = true; console.warn(`[Timeout] ${label} exceeded ${ms}ms, degrading to fallback`); resolve(fallback); }
    }, ms);
    p.then(
      (v) => { if (!settled) { settled = true; clearTimeout(t); resolve(v); } },
      () => { if (!settled) { settled = true; clearTimeout(t); resolve(fallback); } },
    );
  });
}

// Fallback SignalResult for the timeout of a single-result collector.
function failedSignal(source: string, signal_type: SignalResult['signal_type'], category: string): SignalResult {
  return { source, signal_type, category, raw_value: 0, normalized_value: 0, success: false, error: 'collector timeout' };
}

// --- Normalization functions ---

function normalizeJobCount(count: number): number {
  const safe = safeNumber(count, 0);
  if (safe === 0) return 15;
  return Math.min(100, Math.round(Math.log10(safe + 1) / Math.log10(200) * 100));
}

function normalizeFormD(count: number): number {
  const safe = safeNumber(count, 0);
  const baseline = 800;
  return Math.min(100, Math.round((safe / baseline) * 50));
}

function normalizeNews(articleCount: number): number {
  const safe = safeNumber(articleCount, 0);
  return Math.min(100, Math.round(Math.sqrt(safe) * 15));
}

function normalizeTrends(avg: number): number {
  const safe = safeNumber(avg, 0);
  return Math.max(5, Math.min(100, Math.round(safe)));
}

function normalizeSupplyCount(count: number): number {
  const safe = safeNumber(count, 0);
  if (safe === 0) return 10;
  return Math.min(100, Math.round(Math.log10(safe + 1) / Math.log10(10000) * 100));
}

function normalizeWebMentions(count: number): number {
  const safe = safeNumber(count, 0);
  if (safe === 0) return 10;
  return Math.min(100, Math.max(10, Math.round(Math.log10(safe + 1) / Math.log10(50000) * 100)));
}

function normalizePodcastCount(count: number): number {
  const safe = safeNumber(count, 0);
  if (safe === 0) return 5;
  return Math.min(100, Math.round(Math.sqrt(safe) * 10));
}

function normalizeRedditActivity(posts: number, avgScore: number): number {
  const postSignal = Math.min(50, Math.sqrt(safeNumber(posts, 0)) * 8);
  const engagementSignal = Math.min(50, Math.sqrt(safeNumber(avgScore, 0)) * 5);
  return Math.min(100, Math.round(postSignal + engagementSignal));
}

function normalizePrestigeMedia(count: number): number {
  const safe = safeNumber(count, 0);
  if (safe === 0) return 5;
  if (safe <= 2) return 30;
  if (safe <= 5) return 55;
  if (safe <= 10) return 75;
  return Math.min(100, 75 + safe);
}

function calculateWeightedConfidence(successfulSources: string[]): number {
  const total = Object.values(SOURCE_CONFIDENCE_WEIGHTS).reduce((a, b) => a + b, 0);
  const achieved = successfulSources.reduce((sum, src) => sum + (SOURCE_CONFIDENCE_WEIGHTS[src] || 0), 0);
  return Math.round((achieved / total) * 100) / 100;
}

// ============================================================
// DEMAND COLLECTORS
// ============================================================

async function collectAdzunaSignals(date: string): Promise<SignalResult[]> {
  const results: SignalResult[] = [];
  const jobCounts: Record<string, number> = {};
  console.log('[Adzuna] Starting job count collection...');

  for (const role of FRACTIONAL_ROLES) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&what_phrase=${encodeURIComponent(role.phrase)}&results_per_page=1`;
      const response = await fetchWithRetry(url, {
        headers: { 'User-Agent': 'FWI-Pulse/1.0 data@fractionl.ai' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const count = safeNumber(data.count, 0);
      jobCounts[role.category] = count;
      const normalized = normalizeJobCount(count);
      results.push({
        source: 'adzuna', signal_type: 'demand', category: role.category,
        raw_value: count, normalized_value: normalized,
        metadata: { role_phrase: role.phrase, weight: role.weight }, success: true
      });
      console.log(`[Adzuna] ${role.phrase}: ${count} jobs -> score ${normalized}`);
    } catch (error) {
      console.error(`[Adzuna] ${role.phrase} failed:`, error.message);
      results.push({
        source: 'adzuna', signal_type: 'demand', category: role.category,
        raw_value: 0, normalized_value: 15, success: false, error: error.message
      });
    }
  }

  const totalJobs = Object.values(jobCounts).reduce((a, b) => a + b, 0);
  const weightedSum = FRACTIONAL_ROLES.reduce((sum, role) => {
    return sum + (normalizeJobCount(jobCounts[role.category] || 0) * role.weight);
  }, 0);
  const totalWeights = FRACTIONAL_ROLES.reduce((sum, role) => sum + role.weight, 0);
  results.push({
    source: 'adzuna', signal_type: 'demand', category: 'aggregate',
    raw_value: totalJobs, normalized_value: Math.round(weightedSum / totalWeights),
    metadata: { role_count: FRACTIONAL_ROLES.length, total_jobs: totalJobs }, success: true
  });
  return results;
}

async function collectSerpApiJobsSignals(date: string): Promise<SignalResult[]> {
  if (!SERP_API_KEY) {
    console.log('[SerpAPI Jobs] No key, skipping');
    return [];
  }
  console.log('[SerpAPI Jobs] Starting Google Jobs cross-check...');
  const results: SignalResult[] = [];
  let totalJobs = 0;

  for (const role of FRACTIONAL_ROLES) {
    try {
      const url = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(role.phrase)}&gl=us&hl=en&api_key=${SERP_API_KEY}`;
      const response = await fetchWithRetry(url, {}, 2, 15000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const jobs = data.jobs_results || [];
      const count = jobs.length;
      totalJobs += count;
      const normalized = normalizeJobCount(count);
      results.push({
        source: 'serpapi_jobs', signal_type: 'demand', category: role.category,
        raw_value: count, normalized_value: normalized,
        metadata: { role_phrase: role.phrase, sample_titles: jobs.slice(0, 3).map((j: any) => j.title) },
        success: true
      });
      console.log(`[SerpAPI Jobs] ${role.phrase}: ${count} jobs -> score ${normalized}`);
    } catch (error) {
      console.error(`[SerpAPI Jobs] ${role.phrase} failed:`, error.message);
      results.push({
        source: 'serpapi_jobs', signal_type: 'demand', category: role.category,
        raw_value: 0, normalized_value: 15, success: false, error: error.message
      });
    }
  }

  if (results.some(r => r.success)) {
    const successScores = results.filter(r => r.success).map(r => r.normalized_value);
    results.push({
      source: 'serpapi_jobs', signal_type: 'demand', category: 'aggregate',
      raw_value: totalJobs,
      normalized_value: Math.round(successScores.reduce((a, b) => a + b, 0) / successScores.length),
      metadata: { total_jobs: totalJobs }, success: true
    });
  }
  return results;
}

async function collectSecEdgarSignal(date: string): Promise<SignalResult> {
  console.log('[SEC EDGAR] Collecting Form D filings...');
  try {
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 90);
    const url = `https://efts.sec.gov/LATEST/search-index?forms=D&dateRange=custom&startdt=${startDate.toISOString().slice(0, 10)}&enddt=${endDate.toISOString().slice(0, 10)}&q=%22software%22+OR+%22technology%22+OR+%22SaaS%22`;
    const response = await fetchWithRetry(url, {
      headers: { 'User-Agent': 'FWI-Pulse/1.0 research@fractionl.ai' }
    }, 3, 15000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const count = safeNumber(data.hits?.total?.value, 0);
    const normalizedScore = normalizeFormD(count);
    console.log(`[SEC EDGAR] ${count} tech Form D filings (90 days) -> score ${normalizedScore}`);
    return {
      source: 'sec_edgar', signal_type: 'demand', category: 'vc_pipeline',
      raw_value: count, normalized_value: normalizedScore,
      metadata: { window_days: 90, search_terms: ['software', 'technology', 'SaaS'],
        start_date: startDate.toISOString().slice(0, 10), end_date: endDate.toISOString().slice(0, 10) },
      success: true
    };
  } catch (error) {
    console.error('[SEC EDGAR] Failed:', error.message);
    return {
      source: 'sec_edgar', signal_type: 'demand', category: 'vc_pipeline',
      raw_value: 0, normalized_value: 30, success: false, error: error.message
    };
  }
}

// ============================================================
// CULTURE / MOMENTUM COLLECTORS
// ============================================================

async function collectSerpApiTrendsSignal(date: string): Promise<SignalResult> {
  if (!SERP_API_KEY) {
    console.log('[SerpAPI Trends] No key, falling back to Apify');
    return { source: 'serpapi_trends', signal_type: 'momentum', category: 'search_interest',
      raw_value: 0, normalized_value: 25, success: false, error: 'No SERP_API_KEY' };
  }
  console.log('[SerpAPI Trends] Collecting demand-side search interest...');
  try {
    const q = GOOGLE_TRENDS_TERMS.join(',');
    const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(q)}&data_type=TIMESERIES&geo=US&api_key=${SERP_API_KEY}`;
    const response = await fetchWithRetry(url, {}, 2, 15000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const timeline = data.interest_over_time?.timeline_data || [];
    const recent4 = timeline.slice(-4);
    const termAverages: number[] = [];
    if (recent4.length > 0 && recent4[0].values) {
      for (let i = 0; i < recent4[0].values.length; i++) {
        const avg = recent4.reduce((sum: number, t: any) => sum + safeNumber(t.values[i]?.extracted_value, 0), 0) / recent4.length;
        termAverages.push(avg);
      }
    }
    const overallAvg = termAverages.length > 0 ? termAverages.reduce((a, b) => a + b, 0) / termAverages.length : 0;
    const normalizedScore = normalizeTrends(overallAvg);
    console.log(`[SerpAPI Trends] Overall avg: ${overallAvg.toFixed(1)} -> score ${normalizedScore}`);
    return {
      source: 'serpapi_trends', signal_type: 'momentum', category: 'search_interest',
      raw_value: Math.round(overallAvg * 10) / 10, normalized_value: normalizedScore,
      metadata: { terms: GOOGLE_TRENDS_TERMS, term_averages: termAverages.map(a => Math.round(a * 10) / 10), data_points: recent4.length },
      success: true
    };
  } catch (error) {
    console.error('[SerpAPI Trends] Failed:', error.message);
    return { source: 'serpapi_trends', signal_type: 'momentum', category: 'search_interest',
      raw_value: 0, normalized_value: 25, success: false, error: error.message };
  }
}

async function collectGoogleTrendsSignal(date: string): Promise<SignalResult> {
  console.log('[Google Trends] Starting Apify collection (fallback)...');
  try {
    const runResponse = await fetchWithRetry(`https://api.apify.com/v2/acts/apify~google-trends-scraper/runs?token=${APIFY_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerms: GOOGLE_TRENDS_TERMS, geo: 'US', timeRange: 'today 3-m', outputMode: 'complete' })
    });
    if (!runResponse.ok) throw new Error(`Apify run failed: HTTP ${runResponse.status}`);
    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    let status = 'READY';
    let pollCount = 0;
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && pollCount < 24) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`);
      const statusData = await statusResponse.json();
      status = statusData.data.status;
      pollCount++;
    }
    if (status !== 'SUCCEEDED') throw new Error(`Trends run ${status} after ${pollCount * 5}s`);
    const resultsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`);
    const results = await resultsResponse.json();
    if (!Array.isArray(results) || results.length === 0) throw new Error('No trends data returned');
    const termAverages = results.map(item => {
      const timeline = item.interestOverTime_timelineData || [];
      const validPoints = timeline.filter((t: any) => t.hasData && t.hasData[0]);
      const recent4Weeks = validPoints.slice(-4);
      return recent4Weeks.length > 0
        ? recent4Weeks.reduce((sum: number, t: any) => sum + (t.value[0] || 0), 0) / recent4Weeks.length : 0;
    });
    const overallAvg = termAverages.reduce((a, b) => a + b, 0) / termAverages.length;
    return {
      source: 'google_trends', signal_type: 'momentum', category: 'search_interest',
      raw_value: Math.round(overallAvg * 10) / 10, normalized_value: normalizeTrends(overallAvg),
      metadata: { terms: GOOGLE_TRENDS_TERMS, term_averages: termAverages.map(a => Math.round(a * 10) / 10) },
      success: true
    };
  } catch (error) {
    console.error('[Google Trends] Failed:', error.message);
    return { source: 'google_trends', signal_type: 'momentum', category: 'search_interest',
      raw_value: 0, normalized_value: 25, success: false, error: error.message };
  }
}

async function collectNewsApiSignal(date: string): Promise<SignalResult> {
  console.log('[NewsAPI] Collecting fractional executive coverage...');
  try {
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 28);
    const query = encodeURIComponent('"fractional CMO" OR "fractional CFO" OR "fractional CTO" OR "fractional executive"');
    const url = `https://newsapi.org/v2/everything?q=${query}&from=${startDate.toISOString().slice(0, 10)}&language=en&sortBy=relevancy&pageSize=5&apiKey=${NEWS_API_KEY}`;
    const response = await fetchWithRetry(url);
    if (!response.ok) { const e = await response.json(); throw new Error(`HTTP ${response.status}: ${e.message || ''}`); }
    const data = await response.json();
    const count = safeNumber(data.totalResults, 0);
    const articles = (data.articles || []).slice(0, 5);
    const topArticles = articles.map((a: any) => ({
      title: a.title || '', url: a.url || '', source: a.source?.name || ''
    }));
    console.log(`[NewsAPI] ${count} articles (28d), storing ${topArticles.length} headlines`);
    return {
      source: 'newsapi', signal_type: 'momentum', category: 'media_coverage',
      raw_value: count, normalized_value: normalizeNews(count),
      metadata: { window_days: 28, search_phrases: ['fractional CMO', 'fractional CFO', 'fractional CTO', 'fractional executive'],
        top_articles: topArticles }, success: true
    };
  } catch (error) {
    console.error('[NewsAPI] Failed:', error.message);
    return { source: 'newsapi', signal_type: 'momentum', category: 'media_coverage',
      raw_value: 0, normalized_value: 20, success: false, error: error.message };
  }
}

async function collectMediastackSignal(date: string): Promise<SignalResult> {
  if (!MEDIASTACK_API_KEY) {
    console.log('[Mediastack] No key, skipping');
    return { source: 'mediastack', signal_type: 'momentum', category: 'media_coverage',
      raw_value: 0, normalized_value: 20, success: false, error: 'No MEDIASTACK_API_KEY' };
  }
  console.log('[Mediastack] Collecting news coverage...');
  try {
    const url = `http://api.mediastack.com/v1/news?access_key=${MEDIASTACK_API_KEY}&keywords=fractional+executive&languages=en&countries=us,gb&limit=25&sort=published_desc`;
    const response = await fetchWithRetry(url, {}, 2, 10000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const articles = data.data || [];
    const count = safeNumber(data.pagination?.total, articles.length);
    const topArticles = articles.slice(0, 5).map((a: any) => ({
      title: a.title || '', url: a.url || '', source: a.source || ''
    }));
    console.log(`[Mediastack] ${count} results, ${articles.length} returned`);
    return {
      source: 'mediastack', signal_type: 'momentum', category: 'media_coverage',
      raw_value: count, normalized_value: normalizeNews(count),
      metadata: { top_articles: topArticles }, success: true
    };
  } catch (error) {
    console.error('[Mediastack] Failed:', error.message);
    return { source: 'mediastack', signal_type: 'momentum', category: 'media_coverage',
      raw_value: 0, normalized_value: 20, success: false, error: error.message };
  }
}

async function collectGuardianSignal(date: string): Promise<SignalResult> {
  if (!GUARDIAN_API_KEY) {
    console.log('[Guardian] No key, skipping');
    return { source: 'guardian', signal_type: 'momentum', category: 'prestige_media',
      raw_value: 0, normalized_value: 5, success: false, error: 'No GUARDIAN_API_KEY' };
  }
  console.log('[Guardian] Collecting prestige media mentions...');
  try {
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 90);
    const url = `https://content.guardianapis.com/search?q=%22fractional+executive%22+OR+%22fractional+CFO%22&from-date=${startDate.toISOString().slice(0, 10)}&to-date=${endDate.toISOString().slice(0, 10)}&page-size=10&api-key=${GUARDIAN_API_KEY}`;
    const response = await fetchWithRetry(url, {}, 2, 10000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const count = safeNumber(data.response?.total, 0);
    const articles = (data.response?.results || []).slice(0, 5);
    const topArticles = articles.map((a: any) => ({
      title: a.webTitle || '', url: a.webUrl || '', section: a.sectionName || ''
    }));
    console.log(`[Guardian] ${count} articles (90d) -> score ${normalizePrestigeMedia(count)}`);
    return {
      source: 'guardian', signal_type: 'momentum', category: 'prestige_media',
      raw_value: count, normalized_value: normalizePrestigeMedia(count),
      metadata: { window_days: 90, top_articles: topArticles }, success: true
    };
  } catch (error) {
    console.error('[Guardian] Failed:', error.message);
    return { source: 'guardian', signal_type: 'momentum', category: 'prestige_media',
      raw_value: 0, normalized_value: 5, success: false, error: error.message };
  }
}

async function collectNYTSignal(date: string): Promise<SignalResult> {
  if (!NYT_API_KEY) {
    console.log('[NYT] No key, skipping');
    return { source: 'nyt', signal_type: 'momentum', category: 'prestige_media',
      raw_value: 0, normalized_value: 5, success: false, error: 'No NYT_API_KEY' };
  }
  console.log('[NYT] Collecting prestige media mentions...');
  try {
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 90);
    const beginStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
    const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://api.nytimes.com/svc/search/v2/articlesearch.json?q=%22fractional+executive%22+OR+%22fractional+CFO%22&begin_date=${beginStr}&end_date=${endStr}&api-key=${NYT_API_KEY}`;
    const response = await fetchWithRetry(url, {}, 2, 10000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const docs = data.response?.docs || [];
    const count = safeNumber(data.response?.meta?.hits, docs.length);
    const topArticles = docs.slice(0, 5).map((d: any) => ({
      title: d.headline?.main || '', url: d.web_url || '',
      facets: (d.des_facet || []).slice(0, 3)
    }));
    console.log(`[NYT] ${count} articles (90d) -> score ${normalizePrestigeMedia(count)}`);
    return {
      source: 'nyt', signal_type: 'momentum', category: 'prestige_media',
      raw_value: count, normalized_value: normalizePrestigeMedia(count),
      metadata: { window_days: 90, top_articles: topArticles }, success: true
    };
  } catch (error) {
    console.error('[NYT] Failed:', error.message);
    return { source: 'nyt', signal_type: 'momentum', category: 'prestige_media',
      raw_value: 0, normalized_value: 5, success: false, error: error.message };
  }
}

async function collectPodchaserSignal(_date: string): Promise<SignalResult> {
  if (!PODCHASER_API_KEY) {
    console.log('[Podchaser] No key, skipping');
    return { source: 'podchaser', signal_type: 'momentum', category: 'audio_culture',
      raw_value: 0, normalized_value: 5, success: false, error: 'No PODCHASER_API_KEY' };
  }
  console.log('[Podchaser] Collecting podcast mentions...');
  try {
    const query = `{ podcasts(searchTerm: "fractional executive", first: 50) { paginatorInfo { total } data { title } } }`;
    const response = await fetchWithRetry('https://api.podchaser.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PODCHASER_API_KEY}` },
      body: JSON.stringify({ query })
    }, 2, 10000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const total = safeNumber(data.data?.podcasts?.paginatorInfo?.total, 0);
    const sampleTitles = (data.data?.podcasts?.data || []).slice(0, 5).map((p: any) => p.title);
    console.log(`[Podchaser] ${total} podcasts mentioning fractional -> score ${normalizePodcastCount(total)}`);
    return {
      source: 'podchaser', signal_type: 'momentum', category: 'audio_culture',
      raw_value: total, normalized_value: normalizePodcastCount(total),
      metadata: { sample_titles: sampleTitles }, success: true
    };
  } catch (error) {
    console.error('[Podchaser] Failed:', error.message);
    return { source: 'podchaser', signal_type: 'momentum', category: 'audio_culture',
      raw_value: 0, normalized_value: 5, success: false, error: error.message };
  }
}

async function collectRedditSignal(_date: string): Promise<SignalResult> {
  // Reddit's free .json endpoint now serves HTML to unauthenticated/datacenter requests
  // (verified 2026-05-31; the old collector silently returned 0 while reporting success).
  // Measure community discourse via Brave web search (site:reddit.com) instead.
  if (!BRAVE_API_KEY) {
    return { source: 'reddit', signal_type: 'momentum', category: 'community_discourse',
      raw_value: 0, normalized_value: 10, success: false, error: 'No BRAVE_API_KEY' };
  }
  console.log('[Reddit] Collecting community discourse via Brave site:reddit.com...');
  try {
    const terms = ['fractional executive', 'fractional CFO', 'fractional CMO'];
    let total = 0;
    const sampleTitles: string[] = [];
    for (const term of terms) {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(`site:reddit.com "${term}"`)}&count=20&result_filter=web`;
      const response = await fetchWithRetry(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } }, 2, 8000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const results = data.web?.results || [];
      total += safeNumber(results.length, 0);
      for (const r of results.slice(0, 2)) if (r.title) sampleTitles.push(r.title);
    }
    const normalized = normalizeRedditActivity(total, total);
    console.log(`[Reddit] ${total} reddit results via Brave -> ${normalized}`);
    return {
      source: 'reddit', signal_type: 'momentum', category: 'community_discourse',
      raw_value: total, normalized_value: normalized,
      metadata: { via: 'brave_site_search', sample_titles: sampleTitles.slice(0, 5), window: 'recent' },
      success: true
    };
  } catch (error) {
    console.error('[Reddit] Failed:', error.message);
    return { source: 'reddit', signal_type: 'momentum', category: 'community_discourse',
      raw_value: 0, normalized_value: 10, success: false, error: error.message };
  }
}

async function collectHNSignal(_date: string): Promise<SignalResult> {
  console.log('[HN] Collecting Hacker News discourse...');
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=%22fractional%22&tags=story&hitsPerPage=50&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 30 * 86400}`;
    const response = await fetchWithRetry(url, {}, 2, 8000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const hits = data.hits || [];
    const totalHits = safeNumber(data.nbHits, hits.length);
    const avgPoints = hits.length > 0 ? hits.reduce((s: number, h: any) => s + safeNumber(h.points, 0), 0) / hits.length : 0;
    const normalized = normalizeRedditActivity(totalHits, avgPoints);
    console.log(`[HN] ${totalHits} stories, avg points ${avgPoints.toFixed(1)} -> ${normalized}`);
    return {
      source: 'hn', signal_type: 'momentum', category: 'community_discourse',
      raw_value: totalHits, normalized_value: normalized,
      metadata: { avg_points: Math.round(avgPoints), window: 'past_month',
        top_stories: hits.slice(0, 3).map((h: any) => ({ title: h.title, url: h.url, points: h.points })) },
      success: true
    };
  } catch (error) {
    console.error('[HN] Failed:', error.message);
    return { source: 'hn', signal_type: 'momentum', category: 'community_discourse',
      raw_value: 0, normalized_value: 10, success: false, error: error.message };
  }
}

async function collectBraveNewsSignal(date: string): Promise<SignalResult> {
  if (!BRAVE_API_KEY) {
    return { source: 'brave_news', signal_type: 'momentum', category: 'media_coverage',
      raw_value: 0, normalized_value: 20, success: false, error: 'No BRAVE_API_KEY' };
  }
  console.log('[Brave News] Collecting news coverage...');
  try {
    const query = encodeURIComponent('"fractional CFO" OR "fractional CMO" OR "fractional CTO" OR "fractional executive"');
    const url = `https://api.search.brave.com/res/v1/news/search?q=${query}&count=20&freshness=pm`;
    const response = await fetchWithRetry(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } }, 2, 8000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const totalArticles = safeNumber(data.query?.total_count, (data.results || []).length);
    return {
      source: 'brave_news', signal_type: 'momentum', category: 'media_coverage',
      raw_value: totalArticles, normalized_value: normalizeNews(totalArticles),
      metadata: { window: 'past_month' }, success: true
    };
  } catch (error) {
    console.error('[Brave News] Failed:', error.message);
    return { source: 'brave_news', signal_type: 'momentum', category: 'media_coverage',
      raw_value: 0, normalized_value: 20, success: false, error: error.message };
  }
}

async function collectBraveWebMentionsSignal(date: string): Promise<SignalResult> {
  if (!BRAVE_API_KEY) {
    return { source: 'brave_web', signal_type: 'momentum', category: 'web_discourse',
      raw_value: 0, normalized_value: 15, success: false, error: 'No BRAVE_API_KEY' };
  }
  console.log('[Brave Web] Collecting web discourse...');
  try {
    const counts: number[] = [];
    for (let i = 0; i < BRAVE_WEB_SEARCH_TERMS.length; i++) {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(BRAVE_WEB_SEARCH_TERMS[i])}&count=20&freshness=pm&result_filter=web`;
      const response = await fetchWithRetry(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      counts.push(safeNumber(data.web?.totalResults ?? data.web?.results?.length, 0));
      // Inter-call spacing is handled centrally by throttleHost (per-host 1.2s for Brave).
    }
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    return {
      source: 'brave_web', signal_type: 'momentum', category: 'web_discourse',
      raw_value: Math.round(avg), normalized_value: normalizeWebMentions(avg),
      metadata: { terms: BRAVE_WEB_SEARCH_TERMS, term_counts: counts, window: 'past_month' }, success: true
    };
  } catch (error) {
    console.error('[Brave Web] Failed:', error.message);
    return { source: 'brave_web', signal_type: 'momentum', category: 'web_discourse',
      raw_value: 0, normalized_value: 15, success: false, error: error.message };
  }
}

// ============================================================
// SUPPLY COLLECTORS
// ============================================================

async function collectPDLSupplySignals(date: string): Promise<SignalResult[]> {
  if (!PDL_API_KEY) { console.log('[PDL] No key, skipping'); return []; }
  console.log('[PDL] Starting supply signal collection...');
  const results: SignalResult[] = [];
  const PDL_ROLES = [
    { title: 'fractional CFO', category: 'cfo' }, { title: 'fractional CMO', category: 'cmo' },
    { title: 'fractional CTO', category: 'cto' }, { title: 'fractional COO', category: 'coo' },
    { title: 'fractional CRO', category: 'cro' }, { title: 'fractional CEO', category: 'ceo' },
  ];
  let totalProfiles = 0;
  for (const role of PDL_ROLES) {
    try {
      const response = await fetchWithRetry('https://api.peopledatalabs.com/v5/person/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': PDL_API_KEY },
        body: JSON.stringify({ sql: `SELECT * FROM person WHERE job_title LIKE '%${role.title}%' AND location_country='us'`, size: 1 }),
      }, 2, 15000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const count = safeNumber(data.total, 0);
      totalProfiles += count;
      results.push({ source: 'people_data_labs', signal_type: 'supply', category: role.category,
        raw_value: count, normalized_value: normalizeSupplyCount(count),
        metadata: { query_title: role.title, geo: 'us' }, success: true });
    } catch (error) {
      results.push({ source: 'people_data_labs', signal_type: 'supply', category: role.category,
        raw_value: 0, normalized_value: 10, success: false, error: error.message });
    }
  }
  if (results.some(r => r.success)) {
    const scores = results.filter(r => r.success).map(r => r.normalized_value);
    results.push({ source: 'people_data_labs', signal_type: 'supply', category: 'aggregate',
      raw_value: totalProfiles, normalized_value: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      metadata: { total_profiles: totalProfiles }, success: true });
  }
  return results;
}

async function collectSerpApiLinkedInSupply(_date: string): Promise<SignalResult[]> {
  if (!SERP_API_KEY) { console.log('[SerpAPI LinkedIn] No key, skipping'); return []; }
  console.log('[SerpAPI LinkedIn] Collecting LinkedIn supply proxy...');
  const results: SignalResult[] = [];
  const roles = ['fractional CFO', 'fractional CMO', 'fractional CTO', 'fractional COO'];
  let totalResults = 0;

  for (const role of roles) {
    try {
      const url = `https://serpapi.com/search.json?engine=google&q=site:linkedin.com/in+%22${encodeURIComponent(role)}%22&gl=us&api_key=${SERP_API_KEY}`;
      const response = await fetchWithRetry(url, {}, 2, 12000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const count = safeNumber(data.search_information?.total_results, 0);
      totalResults += count;
      results.push({
        source: 'serpapi_linkedin', signal_type: 'supply',
        category: role.split(' ')[1]?.toLowerCase() || 'other',
        raw_value: count, normalized_value: normalizeSupplyCount(count),
        metadata: { query: role }, success: true
      });
      console.log(`[SerpAPI LinkedIn] "${role}": ~${count} profiles`);
    } catch (error) {
      console.error(`[SerpAPI LinkedIn] ${role} failed:`, error.message);
    }
  }

  if (results.length > 0) {
    const scores = results.map(r => r.normalized_value);
    results.push({ source: 'serpapi_linkedin', signal_type: 'supply', category: 'aggregate',
      raw_value: totalResults,
      normalized_value: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      metadata: { total_results: totalResults }, success: true });
  }
  return results;
}

// SerpAPI-independent supply source. When SerpAPI rate-limits (429), the LinkedIn
// profile-count proxy disappears and supply collapses toward its floor (~10) — this
// is what happened May 8-18 2026. Brave is a different vendor with a separate quota,
// so it keeps a real talent-pool reading alive when SerpAPI is down. Reuses the proven
// Brave web-search pattern; host throttling/429 retry is handled in fetchWithRetry.
async function collectBraveTalentSupply(_date: string): Promise<SignalResult[]> {
  if (!BRAVE_API_KEY) {
    console.log('[Brave Talent] No BRAVE_API_KEY, skipping');
    return [];
  }
  console.log('[Brave Talent] Collecting LinkedIn fractional-exec supply proxy...');
  const results: SignalResult[] = [];
  const roles = [
    { phrase: 'fractional CFO', category: 'cfo' },
    { phrase: 'fractional CMO', category: 'cmo' },
    { phrase: 'fractional CTO', category: 'cto' },
    { phrase: 'fractional COO', category: 'coo' },
  ];
  let totalProfiles = 0;

  for (const role of roles) {
    try {
      const q = `site:linkedin.com/in "${role.phrase}"`;
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=20&result_filter=web`;
      const response = await fetchWithRetry(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const count = safeNumber(data.web?.totalResults ?? data.web?.results?.length, 0);
      totalProfiles += count;
      results.push({
        source: 'brave_talent', signal_type: 'supply', category: role.category,
        raw_value: count, normalized_value: normalizeSupplyCount(count),
        metadata: { query: q, geo: 'us', proxy: 'brave_web_linkedin', note: 'coarse liveness proxy: Brave result count is page-capped, not a true profile total' }, success: true
      });
      console.log(`[Brave Talent] "${role.phrase}": ~${count} profiles`);
    } catch (error) {
      console.error(`[Brave Talent] ${role.phrase} failed:`, error.message);
      results.push({
        source: 'brave_talent', signal_type: 'supply', category: role.category,
        raw_value: 0, normalized_value: 10, success: false, error: error.message
      });
    }
  }

  if (results.some(r => r.success)) {
    const scores = results.filter(r => r.success).map(r => r.normalized_value);
    results.push({
      source: 'brave_talent', signal_type: 'supply', category: 'aggregate',
      raw_value: totalProfiles,
      normalized_value: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      metadata: { results_returned: totalProfiles, proxy: 'brave_web_linkedin', note: 'SerpAPI-independent supply liveness backstop; coarse, page-capped' }, success: true
    });
  }
  return results;
}

async function collectGoFractionalSupply(_date: string): Promise<SignalResult> {
  if (!APIFY_API_KEY) {
    return { source: 'gofractional', signal_type: 'supply', category: 'marketplace',
      raw_value: 0, normalized_value: 10, success: false, error: 'No APIFY_API_KEY' };
  }
  console.log('[GoFractional] Collecting marketplace listings via Apify web scraper...');
  try {
    const runResponse = await fetchWithRetry(`https://api.apify.com/v2/acts/apify~web-scraper/runs?token=${APIFY_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: 'https://www.gofractional.com/fractional-executives' }],
        pageFunction: `async function pageFunction(context) {
          const $ = context.jQuery;
          const results = [];
          $('[class*="executive"], [class*="profile"], [class*="card"]').each((i, el) => {
            results.push({ title: $(el).find('[class*="name"], h3, h4').first().text().trim() });
          });
          return results.length > 0 ? results : [{ count: $('a[href*="profile"], a[href*="executive"]').length || 0 }];
        }`,
        maxPagesPerCrawl: 3,
      })
    }, 2, 15000);
    if (!runResponse.ok) throw new Error(`Apify run failed: HTTP ${runResponse.status}`);
    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    let status = 'READY';
    let pollCount = 0;
    // Capped at 10 polls (~50s) so this Apify scraper cannot push the whole pipeline
    // past the edge-function wall-clock / pg_cron caller timeout (see orchestrator deadline).
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && pollCount < 10) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const sr = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`);
      status = (await sr.json()).data.status;
      pollCount++;
    }
    if (status !== 'SUCCEEDED') throw new Error(`GoFractional run ${status}`);
    const items = await (await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`)).json();
    const listings = Array.isArray(items) ? items.flat() : [];
    const count = listings.length > 1 ? listings.length : safeNumber(listings[0]?.count, 0);
    console.log(`[GoFractional] ${count} listings found`);
    return {
      source: 'gofractional', signal_type: 'supply', category: 'marketplace',
      raw_value: count, normalized_value: normalizeSupplyCount(count),
      metadata: { method: 'apify_web_scraper', listings_found: count },
      success: true
    };
  } catch (error) {
    console.error('[GoFractional] Failed:', error.message);
    return { source: 'gofractional', signal_type: 'supply', category: 'marketplace',
      raw_value: 0, normalized_value: 10, success: false, error: error.message };
  }
}

async function collectSupplyTrendsSignal(date: string): Promise<SignalResult> {
  console.log('[Supply Trends] Collecting supply-side search interest...');
  try {
    const runResponse = await fetchWithRetry(`https://api.apify.com/v2/acts/apify~google-trends-scraper/runs?token=${APIFY_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerms: SUPPLY_TRENDS_TERMS, geo: 'US', timeRange: 'today 3-m', outputMode: 'complete' })
    });
    if (!runResponse.ok) throw new Error(`Apify run failed: HTTP ${runResponse.status}`);
    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    let status = 'READY';
    let pollCount = 0;
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && pollCount < 24) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const sr = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`);
      status = (await sr.json()).data.status;
      pollCount++;
    }
    if (status !== 'SUCCEEDED') throw new Error(`Run ${status}`);
    const results = await (await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`)).json();
    if (!Array.isArray(results) || results.length === 0) throw new Error('No data');
    const avgs = results.map((item: any) => {
      const pts = (item.interestOverTime_timelineData || []).filter((t: any) => t.hasData?.[0]).slice(-4);
      return pts.length > 0 ? pts.reduce((s: number, t: any) => s + (t.value[0] || 0), 0) / pts.length : 0;
    });
    const overall = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    return {
      source: 'supply_trends', signal_type: 'supply', category: 'supply_intent',
      raw_value: Math.round(overall * 10) / 10, normalized_value: normalizeTrends(overall),
      metadata: { terms: SUPPLY_TRENDS_TERMS, term_averages: avgs.map(a => Math.round(a * 10) / 10) },
      success: true
    };
  } catch (error) {
    console.error('[Supply Trends] Failed:', error.message);
    return { source: 'supply_trends', signal_type: 'supply', category: 'supply_intent',
      raw_value: 0, normalized_value: 25, success: false, error: error.message };
  }
}

async function collectSerpApiSupplyTrends(_date: string): Promise<SignalResult> {
  if (!SERP_API_KEY) {
    return { source: 'serpapi_supply_trends', signal_type: 'supply', category: 'supply_intent',
      raw_value: 0, normalized_value: 25, success: false, error: 'No SERP_API_KEY' };
  }
  console.log('[SerpAPI Supply Trends] Collecting supply-intent search interest...');
  try {
    const q = SUPPLY_TRENDS_TERMS.join(',');
    const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(q)}&data_type=TIMESERIES&geo=US&api_key=${SERP_API_KEY}`;
    const response = await fetchWithRetry(url, {}, 2, 15000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const timeline = data.interest_over_time?.timeline_data || [];
    const recent4 = timeline.slice(-4);
    const termAverages: number[] = [];
    if (recent4.length > 0 && recent4[0].values) {
      for (let i = 0; i < recent4[0].values.length; i++) {
        const avg = recent4.reduce((sum: number, t: any) => sum + safeNumber(t.values[i]?.extracted_value, 0), 0) / recent4.length;
        termAverages.push(avg);
      }
    }
    const overall = termAverages.length > 0 ? termAverages.reduce((a, b) => a + b, 0) / termAverages.length : 0;
    console.log(`[SerpAPI Supply Trends] Overall: ${overall.toFixed(1)} -> ${normalizeTrends(overall)}`);
    return {
      source: 'serpapi_supply_trends', signal_type: 'supply', category: 'supply_intent',
      raw_value: Math.round(overall * 10) / 10, normalized_value: normalizeTrends(overall),
      metadata: { terms: SUPPLY_TRENDS_TERMS, term_averages: termAverages }, success: true
    };
  } catch (error) {
    console.error('[SerpAPI Supply Trends] Failed:', error.message);
    return { source: 'serpapi_supply_trends', signal_type: 'supply', category: 'supply_intent',
      raw_value: 0, normalized_value: 25, success: false, error: error.message };
  }
}

// ============================================================
// CONTEXT COLLECTORS (not used in composite — enrichment only)
// ============================================================

async function collectFredContext(_date: string): Promise<SignalResult[]> {
  if (!FRED_API_KEY) { console.log('[FRED] No key, skipping'); return []; }
  console.log('[FRED] Collecting macro context...');
  const results: SignalResult[] = [];
  const series = [
    { id: 'JTSJOL', name: 'JOLTS Job Openings' },
    { id: 'UNRATE', name: 'Unemployment Rate' },
    { id: 'ICSA', name: 'Initial Jobless Claims' },
  ];
  for (const s of series) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;
      const response = await fetchWithRetry(url, {}, 2, 10000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const obs = data.observations?.[0];
      const value = safeNumber(obs?.value, 0);
      results.push({
        source: 'fred', signal_type: 'context', category: s.id.toLowerCase(),
        raw_value: value, normalized_value: 50,
        metadata: { series_name: s.name, date: obs?.date, units: data.units || '' },
        success: true
      });
      console.log(`[FRED] ${s.name}: ${value} (${obs?.date})`);
    } catch (error) {
      console.error(`[FRED] ${s.name} failed:`, error.message);
    }
  }
  return results;
}

async function collectCensusACS(_date: string): Promise<SignalResult> {
  console.log('[Census ACS] Collecting self-employment data...');
  // The Census Data API now requires a key on ALL data queries: keyless requests 302 to
  // an HTML "missing_key" page that returns 200, which broke response.json() with the
  // "Unexpected token '<'" error seen since 2026-05-12. Skip cleanly if no key is set.
  if (!CENSUS_API_KEY) {
    console.warn('[Census ACS] No CENSUS_API_KEY; the Census API rejects keyless data queries. Skipping.');
    return { source: 'census_acs', signal_type: 'context', category: 'self_employment',
      raw_value: 0, normalized_value: 50, success: false, error: 'missing CENSUS_API_KEY' };
  }
  const YEAR = '2023';
  try {
    // acs5 (5-year) is more reliable than acs1 for an unattended collector.
    // redirect:'manual' so a bad/missing key surfaces as a 3xx error instead of being
    // followed to an HTML 200 page that then breaks JSON parsing.
    const url = `https://api.census.gov/data/${YEAR}/acs/acs5?get=B19053_001E,B19053_002E&for=us:1&key=${CENSUS_API_KEY}`;
    // A bad/missing key 302s to an HTML missing_key page that itself returns 200; let the
    // redirect follow, then the content-type / leading-'<' guard below catches it with a
    // clear error instead of letting response.json() choke on '<'.
    const response = await fetchWithRetry(url, {}, 2, 10000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const ct = response.headers.get('content-type') || '';
    const body = await response.text();
    if (!ct.includes('json') || body.trimStart().startsWith('<')) {
      throw new Error(`Non-JSON response from Census (likely bad/missing key; content-type="${ct}", starts "${body.slice(0, 30).replace(/\s+/g, ' ')}")`);
    }
    const data = JSON.parse(body);
    const row = data[1];
    const totalHouseholds = safeNumber(row?.[0], 0);
    const selfEmployedHouseholds = safeNumber(row?.[1], 0);
    const pct = totalHouseholds > 0 ? Math.round((selfEmployedHouseholds / totalHouseholds) * 10000) / 100 : 0;
    console.log(`[Census ACS] ${selfEmployedHouseholds.toLocaleString()} / ${totalHouseholds.toLocaleString()} = ${pct}% self-employment`);
    return {
      source: 'census_acs', signal_type: 'context', category: 'self_employment',
      raw_value: selfEmployedHouseholds, normalized_value: 50,
      metadata: { total_households: totalHouseholds, self_employed_households: selfEmployedHouseholds,
        self_employment_pct: pct, year: Number(YEAR), dataset: 'acs5' },
      success: true
    };
  } catch (error) {
    console.error('[Census ACS] Failed:', error.message);
    return { source: 'census_acs', signal_type: 'context', category: 'self_employment',
      raw_value: 0, normalized_value: 50, success: false, error: error.message };
  }
}

// ============================================================
// FREE NATIVE SOURCES (added 2026-05-11)
// ============================================================

async function collectBLSSignals(_date: string): Promise<SignalResult[]> {
  console.log('[BLS] Collecting JOLTS + unemployment + wages from public BLS API...');
  const results: SignalResult[] = [];
  try {
    const year = new Date().getUTCFullYear();
    const response = await fetchWithRetry('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: BLS_SERIES.map(s => s.id),
        startyear: String(year - 1),
        endyear: String(year),
      }),
    }, 2, 15000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== 'REQUEST_SUCCEEDED') {
      throw new Error(`BLS status=${data.status}: ${(data.message || []).join('; ')}`);
    }
    for (const seriesDef of BLS_SERIES) {
      const series = (data.Results?.series || []).find((s: any) => s.seriesID === seriesDef.id);
      const latest = series?.data?.[0];
      if (!latest) {
        results.push({
          source: 'bls', signal_type: 'context', category: seriesDef.category,
          raw_value: 0, normalized_value: 50, success: false,
          error: `No data for ${seriesDef.id}`,
        });
        continue;
      }
      const value = safeNumber(latest.value, 0);
      const ratio = value / seriesDef.baseline;
      const normalized = Math.max(5, Math.min(100, Math.round(50 * ratio)));
      results.push({
        source: 'bls', signal_type: 'context', category: seriesDef.category,
        raw_value: value, normalized_value: normalized,
        metadata: {
          series_id: seriesDef.id, series_name: seriesDef.name,
          period: `${latest.periodName} ${latest.year}`, baseline: seriesDef.baseline,
        },
        success: true,
      });
      console.log(`[BLS] ${seriesDef.name}: ${value} (${latest.periodName} ${latest.year})`);
    }
  } catch (error) {
    console.error('[BLS] Failed:', error.message);
    results.push({
      source: 'bls', signal_type: 'context', category: 'aggregate',
      raw_value: 0, normalized_value: 50, success: false, error: error.message,
    });
  }
  return results;
}

async function collectWikipediaPageviews(date: string): Promise<SignalResult> {
  console.log('[Wikipedia Pageviews] Collecting interest signals from Wikimedia API...');
  try {
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const startStr = fmt(startDate);
    const endStr = fmt(endDate);
    const ua = 'fractionl-pulse/1.0 (https://pulse.fractionl.ai; krishanraja@gmail.com)';
    const perPage: Record<string, number> = {};

    const fetches = WIKIPEDIA_PAGES.map(async (page) => {
      try {
        const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${page}/daily/${startStr}/${endStr}`;
        const res = await fetchWithRetry(url, { headers: { 'User-Agent': ua } }, 2, 10000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const totalViews = (data.items || []).reduce((sum: number, it: any) => sum + safeNumber(it.views, 0), 0);
        perPage[page] = totalViews;
      } catch (err) {
        perPage[page] = 0;
        console.warn(`[Wikipedia Pageviews] ${page} failed: ${err.message}`);
      }
    });
    await Promise.all(fetches);

    const totalViews = Object.values(perPage).reduce((a, b) => a + b, 0);
    if (totalViews === 0) throw new Error('No pageviews collected across any article');
    const avgDaily = totalViews / 7;
    const normalized = Math.min(100, Math.max(5, Math.round(Math.log10(avgDaily + 1) / Math.log10(2000) * 100)));

    return {
      source: 'wikipedia_pageviews', signal_type: 'momentum', category: 'wiki_interest',
      raw_value: Math.round(avgDaily),
      normalized_value: normalized,
      metadata: {
        window_days: 7, total_views_7d: totalViews,
        pages: WIKIPEDIA_PAGES, per_page: perPage,
      },
      success: true,
    };
  } catch (error) {
    console.error('[Wikipedia Pageviews] Failed:', error.message);
    return {
      source: 'wikipedia_pageviews', signal_type: 'momentum', category: 'wiki_interest',
      raw_value: 0, normalized_value: 20, success: false, error: error.message,
    };
  }
}

async function collectOpenAlex(_date: string): Promise<SignalResult> {
  console.log('[OpenAlex] Collecting academic + thought-leadership coverage...');
  try {
    let totalWorks = 0;
    const perPhrase: Record<string, number> = {};
    const since = new Date();
    since.setUTCFullYear(since.getUTCFullYear() - 1);
    const sinceStr = since.toISOString().slice(0, 10);

    const fetches = OPENALEX_PHRASES.map(async (phrase) => {
      try {
        const encoded = encodeURIComponent(phrase);
        const url = `https://api.openalex.org/works?search=${encoded}&filter=from_publication_date:${sinceStr},concepts.id:C144133560|C162324750|C39389867&per-page=1&mailto=krishanraja@gmail.com`;
        const res = await fetchWithRetry(url, {}, 2, 10000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const count = safeNumber(data.meta?.count, 0);
        perPhrase[phrase] = count;
        totalWorks += count;
      } catch (err) {
        perPhrase[phrase] = 0;
        console.warn(`[OpenAlex] ${phrase} failed: ${err.message}`);
      }
    });
    await Promise.all(fetches);

    if (totalWorks === 0 && Object.values(perPhrase).every(v => v === 0)) {
      throw new Error('Zero works across all phrases (likely network or filter mismatch)');
    }
    const normalized = Math.min(100, Math.max(10, Math.round(Math.log10(totalWorks + 1) / Math.log10(500) * 100)));
    return {
      source: 'openalex', signal_type: 'context', category: 'research_interest',
      raw_value: totalWorks,
      normalized_value: normalized,
      metadata: {
        window: 'last_12_months', phrases: OPENALEX_PHRASES, per_phrase: perPhrase,
        concept_filter: 'Business OR Economics OR Management',
      },
      success: true,
    };
  } catch (error) {
    console.error('[OpenAlex] Failed:', error.message);
    return {
      source: 'openalex', signal_type: 'context', category: 'research_interest',
      raw_value: 0, normalized_value: 25, success: false, error: error.message,
    };
  }
}

// ============================================================
// ORCHESTRATOR
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const urlParams = new URL(req.url).searchParams;
  const today = urlParams.get('date') || new Date().toISOString().slice(0, 10);
  const callerAuth = req.headers.get('Authorization') || '';
  console.log(`[Pipeline] Starting signal collection for ${today}`);

  const { data: runData } = await supabase
    .from('pipeline_runs')
    .insert({ source: 'ingest-signals', started_at: new Date().toISOString(), status: 'running',
      metadata: { target_date: today } })
    .select().single();

  // Per-run reset of the throttle counters so a prior warm invocation's leftover
  // slot reservation cannot stall this run's first call to each host.
  for (const k in hostNextSlot) delete hostNextSlot[k];

  try {
    // Retired collectors (2026-05-30): google_trends + supply_trends (Apify), people_data_labs
    // (404), nyt (401). collectBraveTalentSupply added as a SerpAPI-independent supply backbone.
    //
    // Each collector is wrapped in its OWN soft timeout that degrades to a safe fallback. This
    // replaces the old single global deadline: a slow or rate-limited vendor (e.g. a SerpAPI 429
    // storm) now degrades just that source instead of discarding the whole run. Total wall-clock
    // is bounded by the slowest single collector (<= PER_COLLECTOR_MS), comfortably under the
    // pg_cron caller timeout, so the run always completes and the pipeline_runs row always closes.
    const PER_COLLECTOR_MS = 55000;
    const t = <T>(p: Promise<T>, fb: T, label: string) => withTimeout(p, PER_COLLECTOR_MS, fb, label);
    const [
      adzunaResults,
      serpApiJobsResults,
      edgarResult,
      serpApiTrendsResult,
      newsResult,
      mediastackResult,
      guardianResult,
      podchaserResult,
      redditResult,
      hnResult,
      braveNewsResult,
      braveWebResult,
      serpApiLinkedInResults,
      braveTalentResults,
      goFractionalResult,
      serpApiSupplyTrendsResult,
      fredResults,
      censusResult,
      blsResults,
      wikipediaPageviewsResult,
      openAlexResult
    ] = await Promise.all([
      t(collectAdzunaSignals(today), [] as SignalResult[], 'adzuna'),
      t(collectSerpApiJobsSignals(today), [] as SignalResult[], 'serpapi_jobs'),
      t(collectSecEdgarSignal(today), failedSignal('sec_edgar', 'demand', 'vc_pipeline'), 'sec_edgar'),
      t(collectSerpApiTrendsSignal(today), failedSignal('serpapi_trends', 'momentum', 'search_interest'), 'serpapi_trends'),
      t(collectNewsApiSignal(today), failedSignal('newsapi', 'momentum', 'media_coverage'), 'newsapi'),
      t(collectMediastackSignal(today), failedSignal('mediastack', 'momentum', 'media_coverage'), 'mediastack'),
      t(collectGuardianSignal(today), failedSignal('guardian', 'momentum', 'prestige_media'), 'guardian'),
      t(collectPodchaserSignal(today), failedSignal('podchaser', 'momentum', 'audio_culture'), 'podchaser'),
      t(collectRedditSignal(today), failedSignal('reddit', 'momentum', 'community_discourse'), 'reddit'),
      t(collectHNSignal(today), failedSignal('hn', 'momentum', 'community_discourse'), 'hn'),
      t(collectBraveNewsSignal(today), failedSignal('brave_news', 'momentum', 'media_coverage'), 'brave_news'),
      t(collectBraveWebMentionsSignal(today), failedSignal('brave_web', 'momentum', 'web_discourse'), 'brave_web'),
      t(collectSerpApiLinkedInSupply(today), [] as SignalResult[], 'serpapi_linkedin'),
      t(collectBraveTalentSupply(today), [] as SignalResult[], 'brave_talent'),
      t(collectGoFractionalSupply(today), failedSignal('gofractional', 'supply', 'marketplace'), 'gofractional'),
      t(collectSerpApiSupplyTrends(today), failedSignal('serpapi_supply_trends', 'supply', 'supply_intent'), 'serpapi_supply_trends'),
      t(collectFredContext(today), [] as SignalResult[], 'fred'),
      t(collectCensusACS(today), failedSignal('census_acs', 'context', 'self_employment'), 'census_acs'),
      t(collectBLSSignals(today), [] as SignalResult[], 'bls'),
      t(collectWikipediaPageviews(today), failedSignal('wikipedia_pageviews', 'momentum', 'wiki_interest'), 'wikipedia_pageviews'),
      t(collectOpenAlex(today), failedSignal('openalex', 'context', 'research_interest'), 'openalex')
    ]);

    const allSignals: SignalResult[] = [
      ...adzunaResults,
      ...serpApiJobsResults,
      edgarResult,
      serpApiTrendsResult,
      newsResult,
      mediastackResult,
      guardianResult,
      podchaserResult,
      redditResult,
      hnResult,
      braveNewsResult,
      braveWebResult,
      ...serpApiLinkedInResults,
      ...braveTalentResults,
      goFractionalResult,
      serpApiSupplyTrendsResult,
      ...fredResults,
      censusResult,
      ...blsResults,
      wikipediaPageviewsResult,
      openAlexResult
    ];

    const successfulSignals = allSignals.filter(s => s.success);
    const failedSignals = allSignals.filter(s => !s.success);

    console.log(`[Pipeline] ${successfulSignals.length}/${allSignals.length} signals collected successfully`);

    if (successfulSignals.length < 2) {
      throw new Error(`Insufficient signals: ${successfulSignals.length} sources succeeded`);
    }

    // Anomaly guard: reject signals >3 stddev from recent 8-week history
    const { data: recentHistory } = await supabase
      .from('signals')
      .select('source, category, normalized_value')
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(500);

    const historyMap: Record<string, number[]> = {};
    for (const h of (recentHistory || [])) {
      const key = `${h.source}_${h.category}`;
      if (!historyMap[key]) historyMap[key] = [];
      if (historyMap[key].length < 8) historyMap[key].push(h.normalized_value);
    }

    const validatedSignals = successfulSignals.filter(signal => {
      const key = `${signal.source}_${signal.category}`;
      const history = historyMap[key];
      if (!history || history.length < 3) return true; // not enough data to judge
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const stddev = Math.sqrt(history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length);
      if (stddev < 1) return true; // too little variance to judge
      const zScore = Math.abs(signal.normalized_value - mean) / stddev;
      if (zScore > 3) {
        console.warn(`[Anomaly Guard] REJECTED ${key}: value ${signal.normalized_value} is ${zScore.toFixed(1)} stddev from mean ${mean.toFixed(1)} (stddev=${stddev.toFixed(1)})`);
        return false;
      }
      return true;
    });

    const rejected = successfulSignals.length - validatedSignals.length;
    if (rejected > 0) console.log(`[Anomaly Guard] Rejected ${rejected} outlier signal(s)`);

    const signalRecords = validatedSignals.map(signal => ({
      date: today, source: signal.source, signal_type: signal.signal_type,
      category: signal.category, normalized_value: signal.normalized_value,
      raw_value: signal.raw_value, metadata: signal.metadata || {}
    }));

    const { error: upsertError } = await supabase
      .from('signals')
      .upsert(signalRecords, { onConflict: 'date,source,signal_type,category' });

    if (upsertError) throw upsertError;

    const successfulSources = [...new Set(successfulSignals.map(s => s.source))];
    const confidence = calculateWeightedConfidence(successfulSources);

    if (runData?.id) {
      await supabase.from('pipeline_runs').update({
        completed_at: new Date().toISOString(), status: 'success',
        records_inserted: signalRecords.length, confidence,
        metadata: { successful_sources: successfulSources,
          failed_sources: failedSignals.map(s => ({ source: s.source, error: s.error })) }
      }).eq('id', runData.id);
    }

    // Batched into two uniform-column upserts (healthy / failed) instead of ~21 sequential
    // round-trips, so this tail work stays well under the caller timeout. The failed batch
    // omits last_success on purpose so a source's prior last_success is preserved.
    const now = new Date().toISOString();
    const healthyRows: any[] = [];
    const failedRows: any[] = [];
    for (const src of Object.keys(SOURCE_CONFIDENCE_WEIGHTS)) {
      const srcSignals = allSignals.filter(s => s.source === src);
      if (srcSignals.length === 0) continue;
      const errors = srcSignals.filter(s => !s.success);
      if (srcSignals.some(s => s.success)) {
        healthyRows.push({ source: src, last_checked: now, last_success: now, status: 'healthy', error_count: 0, metadata: { last_error: null }, updated_at: now });
      } else {
        failedRows.push({ source: src, last_checked: now, status: 'failed', error_count: errors.length, metadata: { last_error: errors[0]?.error || null }, updated_at: now });
      }
    }
    if (healthyRows.length > 0) await supabase.from('data_source_health').upsert(healthyRows, { onConflict: 'source' });
    if (failedRows.length > 0) await supabase.from('data_source_health').upsert(failedRows, { onConflict: 'source' });

    console.log('[Pipeline] Triggering FWI calculation...');
    let fwiResult: any = { error: 'FWI calculation not attempted' };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000));
        const fwiAuthHeader = callerAuth || `Bearer ${SUPABASE_SERVICE_KEY}`;
        const fwiResponse = await fetch(`${SUPABASE_URL}/functions/v1/calculate-fwi?date=${today}`, {
          headers: { 'Authorization': fwiAuthHeader }
        });
        if (fwiResponse.ok) {
          fwiResult = await fwiResponse.json();
          console.log(`[Pipeline] FWI calculation succeeded: ${fwiResult.overall_score}`);
          break;
        }
      } catch (fwiErr) {
        fwiResult = { error: fwiErr.message };
      }
    }

    return new Response(JSON.stringify({
      success: true, date: today,
      signals_collected: successfulSignals.length, signals_failed: failedSignals.length,
      sources_healthy: successfulSources.length, confidence, fwi_result: fwiResult
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Pipeline] Failed:', error.message);
    if (runData?.id) {
      await supabase.from('pipeline_runs').update({
        completed_at: new Date().toISOString(), status: 'error', error: error.message
      }).eq('id', runData.id);
    }
    return new Response(JSON.stringify({ error: error.message, timestamp: new Date().toISOString() }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
