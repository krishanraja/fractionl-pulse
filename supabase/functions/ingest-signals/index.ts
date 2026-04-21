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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

const SOURCE_CONFIDENCE_WEIGHTS: Record<string, number> = {
  adzuna: 0.14,
  serpapi_jobs: 0.08,
  google_trends: 0.08,
  serpapi_trends: 0.06,
  sec_edgar: 0.10,
  newsapi: 0.05,
  brave_news: 0.04,
  brave_web: 0.03,
  mediastack: 0.03,
  guardian: 0.02,
  nyt: 0.02,
  podchaser: 0.02,
  reddit: 0.02,
  hn: 0.01,
  people_data_labs: 0.10,
  serpapi_linkedin: 0.06,
  gofractional: 0.05,
  supply_trends: 0.04,
  serpapi_supply_trends: 0.03,
  fred: 0.01,
  census_acs: 0.01,
};

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

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  timeoutMs = 10000
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
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
  console.log('[NYT] Collecting prestige media mentions...');
  try {
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 90);
    const beginStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
    const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://api.nytimes.com/svc/search/v2/articlesearch.json?q=%22fractional+executive%22+OR+%22fractional+CFO%22&begin_date=${beginStr}&end_date=${endStr}&api-key=NYTIMES_FREE_KEY`;
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
  if (!APIFY_API_KEY) {
    return { source: 'reddit', signal_type: 'momentum', category: 'community_discourse',
      raw_value: 0, normalized_value: 10, success: false, error: 'No APIFY_API_KEY' };
  }
  console.log('[Reddit] Collecting community discourse via Apify...');
  try {
    const runResponse = await fetchWithRetry(`https://api.apify.com/v2/acts/vulnv~reddit-posts-search-scraper/runs?token=${APIFY_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchQueries: ['fractional executive', 'fractional CFO', 'fractional CMO'],
        sort: 'relevance', time: 'month', maxItems: 50
      })
    }, 2, 15000);
    if (!runResponse.ok) throw new Error(`Apify run failed: HTTP ${runResponse.status}`);
    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    let status = 'READY';
    let pollCount = 0;
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && pollCount < 12) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const sr = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`);
      status = (await sr.json()).data.status;
      pollCount++;
    }
    if (status !== 'SUCCEEDED') throw new Error(`Reddit run ${status}`);
    const items = await (await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`)).json();
    const posts = Array.isArray(items) ? items : [];
    const avgScore = posts.length > 0 ? posts.reduce((s: number, p: any) => s + safeNumber(p.score || p.ups, 0), 0) / posts.length : 0;
    const subreddits = [...new Set(posts.map((p: any) => p.subreddit || p.subredditName).filter(Boolean))];
    const normalized = normalizeRedditActivity(posts.length, avgScore);
    console.log(`[Reddit] ${posts.length} posts, avg score ${avgScore.toFixed(1)} -> ${normalized}`);
    return {
      source: 'reddit', signal_type: 'momentum', category: 'community_discourse',
      raw_value: posts.length, normalized_value: normalized,
      metadata: { avg_score: Math.round(avgScore), subreddits: subreddits.slice(0, 10), window: 'past_month' },
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
    let totalArticles = 0;
    for (let offset = 0; offset < 60; offset += 20) {
      const url = `https://api.search.brave.com/res/v1/news/search?q=${query}&count=20&offset=${offset}&freshness=pm`;
      const response = await fetchWithRetry(url, { headers: { 'X-Subscription-Token': BRAVE_API_KEY } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      totalArticles += (data.results || []).length;
      if ((data.results || []).length < 20) break;
      if (offset + 20 < 60) await new Promise(r => setTimeout(r, 1100));
    }
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
      if (i < BRAVE_WEB_SEARCH_TERMS.length - 1) await new Promise(r => setTimeout(r, 1100));
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

async function collectGoFractionalSupply(_date: string): Promise<SignalResult> {
  if (!APIFY_API_KEY) {
    return { source: 'gofractional', signal_type: 'supply', category: 'marketplace',
      raw_value: 0, normalized_value: 10, success: false, error: 'No APIFY_API_KEY' };
  }
  console.log('[GoFractional] Collecting marketplace listings via Apify...');
  try {
    const runResponse = await fetchWithRetry(`https://api.apify.com/v2/acts/lexis-solutions~gofractional-scraper/runs?token=${APIFY_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxItems: 100 })
    }, 2, 15000);
    if (!runResponse.ok) throw new Error(`Apify run failed: HTTP ${runResponse.status}`);
    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    let status = 'READY';
    let pollCount = 0;
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && pollCount < 18) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const sr = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`);
      status = (await sr.json()).data.status;
      pollCount++;
    }
    if (status !== 'SUCCEEDED') throw new Error(`GoFractional run ${status}`);
    const items = await (await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`)).json();
    const listings = Array.isArray(items) ? items : [];
    const rates = listings.map((l: any) => safeNumber(l.hourlyRate || l.rate, 0)).filter(r => r > 0);
    const medianRate = rates.length > 0 ? rates.sort((a, b) => a - b)[Math.floor(rates.length / 2)] : 0;
    const roles = [...new Set(listings.map((l: any) => l.role || l.title).filter(Boolean))];
    console.log(`[GoFractional] ${listings.length} listings, median rate $${medianRate}`);
    return {
      source: 'gofractional', signal_type: 'supply', category: 'marketplace',
      raw_value: listings.length, normalized_value: normalizeSupplyCount(listings.length),
      metadata: { median_hourly_rate: medianRate, roles_found: roles.slice(0, 10), listings_with_rates: rates.length },
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
  try {
    const url = 'https://api.census.gov/data/2023/acs/acs1?get=B19053_001E,B19053_002E&for=us:1';
    const response = await fetchWithRetry(url, {}, 2, 10000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const row = data[1];
    const totalHouseholds = safeNumber(row?.[0], 0);
    const selfEmployedHouseholds = safeNumber(row?.[1], 0);
    const pct = totalHouseholds > 0 ? Math.round((selfEmployedHouseholds / totalHouseholds) * 10000) / 100 : 0;
    console.log(`[Census ACS] ${selfEmployedHouseholds.toLocaleString()} / ${totalHouseholds.toLocaleString()} = ${pct}% self-employment`);
    return {
      source: 'census_acs', signal_type: 'context', category: 'self_employment',
      raw_value: selfEmployedHouseholds, normalized_value: 50,
      metadata: { total_households: totalHouseholds, self_employed_households: selfEmployedHouseholds,
        self_employment_pct: pct, year: 2023 },
      success: true
    };
  } catch (error) {
    console.error('[Census ACS] Failed:', error.message);
    return { source: 'census_acs', signal_type: 'context', category: 'self_employment',
      raw_value: 0, normalized_value: 50, success: false, error: error.message };
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

  try {
    const [
      adzunaResults,
      serpApiJobsResults,
      edgarResult,
      serpApiTrendsResult,
      trendsResult,
      newsResult,
      mediastackResult,
      guardianResult,
      nytResult,
      podchaserResult,
      redditResult,
      hnResult,
      braveNewsResult,
      braveWebResult,
      pdlResults,
      serpApiLinkedInResults,
      goFractionalResult,
      supplyTrendsResult,
      serpApiSupplyTrendsResult,
      fredResults,
      censusResult
    ] = await Promise.all([
      collectAdzunaSignals(today),
      collectSerpApiJobsSignals(today),
      collectSecEdgarSignal(today),
      collectSerpApiTrendsSignal(today),
      collectGoogleTrendsSignal(today),
      collectNewsApiSignal(today),
      collectMediastackSignal(today),
      collectGuardianSignal(today),
      collectNYTSignal(today),
      collectPodchaserSignal(today),
      collectRedditSignal(today),
      collectHNSignal(today),
      collectBraveNewsSignal(today),
      collectBraveWebMentionsSignal(today),
      collectPDLSupplySignals(today),
      collectSerpApiLinkedInSupply(today),
      collectGoFractionalSupply(today),
      collectSupplyTrendsSignal(today),
      collectSerpApiSupplyTrends(today),
      collectFredContext(today),
      collectCensusACS(today)
    ]);

    const allSignals: SignalResult[] = [
      ...adzunaResults,
      ...serpApiJobsResults,
      edgarResult,
      serpApiTrendsResult,
      trendsResult,
      newsResult,
      mediastackResult,
      guardianResult,
      nytResult,
      podchaserResult,
      redditResult,
      hnResult,
      braveNewsResult,
      braveWebResult,
      ...pdlResults,
      ...serpApiLinkedInResults,
      goFractionalResult,
      supplyTrendsResult,
      serpApiSupplyTrendsResult,
      ...fredResults,
      censusResult
    ];

    const successfulSignals = allSignals.filter(s => s.success);
    const failedSignals = allSignals.filter(s => !s.success);

    console.log(`[Pipeline] ${successfulSignals.length}/${allSignals.length} signals collected successfully`);

    if (successfulSignals.length < 2) {
      throw new Error(`Insufficient signals: ${successfulSignals.length} sources succeeded`);
    }

    const signalRecords = successfulSignals.map(signal => ({
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

    const allSourceNames = Object.keys(SOURCE_CONFIDENCE_WEIGHTS);
    const now = new Date().toISOString();
    for (const src of allSourceNames) {
      const srcSignals = allSignals.filter(s => s.source === src);
      if (srcSignals.length === 0) continue;
      const anySuccess = srcSignals.some(s => s.success);
      const errors = srcSignals.filter(s => !s.success);
      await supabase.from('data_source_health').upsert({
        source: src, last_checked: now,
        ...(anySuccess ? { last_success: now, status: 'healthy', error_count: 0 } : { status: 'failed', error_count: errors.length }),
        metadata: { last_error: errors[0]?.error || null }, updated_at: now,
      }, { onConflict: 'source' });
    }

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
