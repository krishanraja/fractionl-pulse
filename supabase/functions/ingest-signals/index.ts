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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 6 roles with verified job counts (excluded VP roles with 0 results)
const FRACTIONAL_ROLES = [
  { phrase: 'fractional CFO', category: 'cfo', weight: 1.5 },     // 121 jobs
  { phrase: 'fractional CMO', category: 'cmo', weight: 1.2 },     // 13 jobs
  { phrase: 'fractional CTO', category: 'cto', weight: 1.2 },     // 19 jobs
  { phrase: 'fractional COO', category: 'coo', weight: 1.0 },     // 5 jobs
  { phrase: 'fractional CRO', category: 'cro', weight: 1.0 },     // 3 jobs
  { phrase: 'interim CEO', category: 'ceo', weight: 1.3 },        // 10 jobs
];

const GOOGLE_TRENDS_TERMS = [
  'fractional CMO',
  'fractional CFO',
  'fractional CTO',
  'fractional executive'
];

// Supply-side search terms: measures intent to BECOME a fractional executive.
// Leading indicator — search interest precedes actual supply changes by 4-8 weeks.
const SUPPLY_TRENDS_TERMS = [
  'become fractional executive',
  'fractional consulting business',
  'how to be a fractional CFO',
  'fractional executive career',
];

// Brave Web Search terms for broader web discourse (blogs, forums, LinkedIn)
const BRAVE_WEB_SEARCH_TERMS = [
  'fractional executive',
  'fractional CFO hiring',
  'fractional CMO experience',
  'fractional CTO startup',
];

// Data completeness weights per source (not all sources are equal)
const SOURCE_CONFIDENCE_WEIGHTS: Record<string, number> = {
  adzuna: 0.25,
  google_trends: 0.20,
  sec_edgar: 0.15,
  newsapi: 0.08,
  brave_news: 0.08,
  brave_web: 0.06,
  people_data_labs: 0.20,
  supply_trends: 0.10,
};

interface SignalResult {
  source: string;
  signal_type: 'demand' | 'supply' | 'momentum';
  category: string;
  raw_value: number;
  normalized_value: number;
  metadata?: Record<string, any>;
  success: boolean;
  error?: string;
}

// Safe number validation: guards against NaN, Infinity, negatives
function safeNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

// Fetch with retry and exponential backoff for transient failures
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
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`[Retry] Attempt ${attempt + 1} failed, waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError || new Error('fetchWithRetry exhausted');
}

// Normalization functions with input validation.
// Each maps a raw API value to a 0-100 scale. Constants are calibrated to
// historical data ranges observed during development (March 2026).

function normalizeJobCount(count: number): number {
  // Log scale: 200 jobs = score 100. Chosen because the highest-volume role
  // (Fractional CFO) peaks at ~150-200 live listings in the US.
  const safe = safeNumber(count, 0);
  if (safe === 0) return 15;  // floor for inactive markets
  return Math.min(100, Math.round(Math.log10(safe + 1) / Math.log10(200) * 100));
}

function normalizeFormD(count: number): number {
  // Linear scale: 800 tech Form D filings per 90-day window = score 50.
  // 800 is the approximate historical median for "software OR technology OR SaaS" filings.
  const safe = safeNumber(count, 0);
  const baseline = 800;
  return Math.min(100, Math.round((safe / baseline) * 50));
}

function normalizeNews(articleCount: number): number {
  // Square-root scale: dampens spikes from viral articles.
  // ~44 articles → score ~100. Typical quiet week is 5-10 articles (~34-47 score).
  const safe = safeNumber(articleCount, 0);
  return Math.min(100, Math.round(Math.sqrt(safe) * 15));
}

function normalizeTrends(avg: number): number {
  // Google Trends already returns 0-100 natively (relative search interest).
  // We pass through directly, with a floor of 5 to distinguish "some interest" from "zero data."
  const safe = safeNumber(avg, 0);
  return Math.max(5, Math.min(100, Math.round(safe)));
}

function normalizeSupplyCount(count: number): number {
  // Log scale similar to job counts. 5000 profiles with "fractional" in title = score 50.
  // This is calibrated to initial PDL test queries (March 2026).
  const safe = safeNumber(count, 0);
  if (safe === 0) return 10; // floor
  return Math.min(100, Math.round(Math.log10(safe + 1) / Math.log10(10000) * 100));
}

function normalizeWebMentions(count: number): number {
  // Log scale for web search result counts. 50,000 estimated results = score ~100.
  // Calibration constant may need tuning after initial runs.
  const safe = safeNumber(count, 0);
  if (safe === 0) return 10; // floor
  return Math.min(100, Math.max(10, Math.round(Math.log10(safe + 1) / Math.log10(50000) * 100)));
}

// Calculate weighted confidence based on which sources succeeded
function calculateWeightedConfidence(successfulSources: string[]): number {
  const total = Object.values(SOURCE_CONFIDENCE_WEIGHTS).reduce((a, b) => a + b, 0);
  const achieved = successfulSources.reduce((sum, src) => sum + (SOURCE_CONFIDENCE_WEIGHTS[src] || 0), 0);
  return Math.round((achieved / total) * 100) / 100;
}

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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const count = safeNumber(data.count, 0);
      jobCounts[role.category] = count;

      const normalized = normalizeJobCount(count);

      results.push({
        source: 'adzuna',
        signal_type: 'demand',
        category: role.category,
        raw_value: count,
        normalized_value: normalized,
        metadata: { role_phrase: role.phrase, weight: role.weight },
        success: true
      });

      console.log(`[Adzuna] ${role.phrase}: ${count} jobs → score ${normalized}`);

    } catch (error) {
      console.error(`[Adzuna] ${role.phrase} failed:`, error.message);
      results.push({
        source: 'adzuna',
        signal_type: 'demand',
        category: role.category,
        raw_value: 0,
        normalized_value: 15, // floor score
        success: false,
        error: error.message
      });
    }
  }

  // Calculate weighted average for aggregate demand
  const totalJobs = Object.values(jobCounts).reduce((a, b) => a + b, 0);
  const weightedSum = FRACTIONAL_ROLES.reduce((sum, role) => {
    const count = jobCounts[role.category] || 0;
    return sum + (normalizeJobCount(count) * role.weight);
  }, 0);
  const totalWeights = FRACTIONAL_ROLES.reduce((sum, role) => sum + role.weight, 0);
  const aggregateScore = Math.round(weightedSum / totalWeights);

  results.push({
    source: 'adzuna',
    signal_type: 'demand',
    category: 'aggregate',
    raw_value: totalJobs,
    normalized_value: aggregateScore,
    metadata: { role_count: FRACTIONAL_ROLES.length, total_jobs: totalJobs },
    success: true
  });

  console.log(`[Adzuna] Aggregate: ${totalJobs} total jobs → score ${aggregateScore}`);
  return results;
}

async function collectGoogleTrendsSignal(date: string): Promise<SignalResult> {
  console.log('[Google Trends] Starting collection...');
  
  try {
    // Start Apify run
    const runResponse = await fetchWithRetry(`https://api.apify.com/v2/acts/apify~google-trends-scraper/runs?token=${APIFY_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchTerms: GOOGLE_TRENDS_TERMS,
        geo: 'US',
        timeRange: 'today 3-m',
        outputMode: 'complete'
      })
    });

    if (!runResponse.ok) {
      throw new Error(`Apify run failed: HTTP ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    
    console.log(`[Google Trends] Started run ${runId}, polling...`);

    // Poll until complete (max 120 seconds)
    let status = 'READY';
    let pollCount = 0;
    const maxPolls = 24; // 120s / 5s
    
    while (status !== 'SUCCEEDED' && status !== 'FAILED' && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`);
      const statusData = await statusResponse.json();
      status = statusData.data.status;
      pollCount++;
      
      console.log(`[Google Trends] Poll ${pollCount}: ${status}`);
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Trends run ${status} after ${pollCount * 5}s`);
    }

    // Fetch results
    const resultsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`);
    const results = await resultsResponse.json();
    
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('No trends data returned');
    }

    // Calculate 4-week average from valid data points
    const termAverages = results.map(item => {
      const timeline = item.interestOverTime_timelineData || [];
      const validPoints = timeline.filter((t: any) => t.hasData && t.hasData[0]);
      const recent4Weeks = validPoints.slice(-4);
      const avg = recent4Weeks.length > 0 
        ? recent4Weeks.reduce((sum: number, t: any) => sum + (t.value[0] || 0), 0) / recent4Weeks.length
        : 0;
      
      console.log(`[Google Trends] ${item.searchTerm}: 4-week avg = ${avg.toFixed(1)}`);
      return avg;
    });

    const overallAvg = termAverages.reduce((a, b) => a + b, 0) / termAverages.length;
    const normalizedScore = normalizeTrends(overallAvg);
    
    console.log(`[Google Trends] Overall average: ${overallAvg.toFixed(1)} → score ${normalizedScore}`);

    return {
      source: 'google_trends',
      signal_type: 'momentum',
      category: 'search_interest',
      raw_value: Math.round(overallAvg * 10) / 10,
      normalized_value: normalizedScore,
      metadata: { 
        terms: GOOGLE_TRENDS_TERMS, 
        term_averages: termAverages.map(a => Math.round(a * 10) / 10),
        valid_data_points: results.length
      },
      success: true
    };

  } catch (error) {
    console.error('[Google Trends] Failed:', error.message);
    return {
      source: 'google_trends',
      signal_type: 'momentum',
      category: 'search_interest', 
      raw_value: 0,
      normalized_value: 25, // pessimistic fallback
      success: false,
      error: error.message
    };
  }
}

async function collectSupplyTrendsSignal(date: string): Promise<SignalResult> {
  console.log('[Supply Trends] Starting supply-side search interest collection...');

  try {
    const runResponse = await fetchWithRetry(`https://api.apify.com/v2/acts/apify~google-trends-scraper/runs?token=${APIFY_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchTerms: SUPPLY_TRENDS_TERMS,
        geo: 'US',
        timeRange: 'today 3-m',
        outputMode: 'complete'
      })
    });

    if (!runResponse.ok) {
      throw new Error(`Apify run failed: HTTP ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;

    console.log(`[Supply Trends] Started run ${runId}, polling...`);

    let status = 'READY';
    let pollCount = 0;
    const maxPolls = 24;

    while (status !== 'SUCCEEDED' && status !== 'FAILED' && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`);
      const statusData = await statusResponse.json();
      status = statusData.data.status;
      pollCount++;

      console.log(`[Supply Trends] Poll ${pollCount}: ${status}`);
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Supply trends run ${status} after ${pollCount * 5}s`);
    }

    const resultsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`);
    const results = await resultsResponse.json();

    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('No supply trends data returned');
    }

    const termAverages = results.map(item => {
      const timeline = item.interestOverTime_timelineData || [];
      const validPoints = timeline.filter((t: any) => t.hasData && t.hasData[0]);
      const recent4Weeks = validPoints.slice(-4);
      const avg = recent4Weeks.length > 0
        ? recent4Weeks.reduce((sum: number, t: any) => sum + (t.value[0] || 0), 0) / recent4Weeks.length
        : 0;

      console.log(`[Supply Trends] ${item.searchTerm}: 4-week avg = ${avg.toFixed(1)}`);
      return avg;
    });

    const overallAvg = termAverages.reduce((a, b) => a + b, 0) / termAverages.length;
    const normalizedScore = normalizeTrends(overallAvg);

    console.log(`[Supply Trends] Overall average: ${overallAvg.toFixed(1)} → score ${normalizedScore}`);

    return {
      source: 'supply_trends',
      signal_type: 'supply',
      category: 'supply_intent',
      raw_value: Math.round(overallAvg * 10) / 10,
      normalized_value: normalizedScore,
      metadata: {
        terms: SUPPLY_TRENDS_TERMS,
        term_averages: termAverages.map(a => Math.round(a * 10) / 10),
        valid_data_points: results.length
      },
      success: true
    };

  } catch (error) {
    console.error('[Supply Trends] Failed:', error.message);
    return {
      source: 'supply_trends',
      signal_type: 'supply',
      category: 'supply_intent',
      raw_value: 0,
      normalized_value: 25,
      success: false,
      error: error.message
    };
  }
}

async function collectSecEdgarSignal(date: string): Promise<SignalResult> {
  console.log('[SEC EDGAR] Collecting Form D filings...');
  
  try {
    // 90-day window for VC funding leading indicator
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 90);
    
    const url = `https://efts.sec.gov/LATEST/search-index?forms=D&dateRange=custom&startdt=${startDate.toISOString().slice(0, 10)}&enddt=${endDate.toISOString().slice(0, 10)}&q=%22software%22+OR+%22technology%22+OR+%22SaaS%22`;

    const response = await fetchWithRetry(url, {
      headers: { 'User-Agent': 'FWI-Pulse/1.0 research@fractionl.ai' }
    }, 3, 15000);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const count = safeNumber(data.hits?.total?.value, 0);
    const normalizedScore = normalizeFormD(count);
    
    console.log(`[SEC EDGAR] ${count} tech Form D filings (90 days) → score ${normalizedScore}`);
    
    return {
      source: 'sec_edgar',
      signal_type: 'demand',
      category: 'vc_pipeline',
      raw_value: count,
      normalized_value: normalizedScore,
      metadata: { 
        window_days: 90, 
        search_terms: ['software', 'technology', 'SaaS'],
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10)
      },
      success: true
    };
    
  } catch (error) {
    console.error('[SEC EDGAR] Failed:', error.message);
    return {
      source: 'sec_edgar',
      signal_type: 'demand',
      category: 'vc_pipeline',
      raw_value: 0,
      normalized_value: 30, // pessimistic fallback
      success: false,
      error: error.message
    };
  }
}

async function collectNewsApiSignal(date: string): Promise<SignalResult> {
  console.log('[NewsAPI] Collecting fractional executive coverage...');
  
  try {
    // 28-day window (free tier limit)
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 28);
    
    const query = encodeURIComponent('"fractional CMO" OR "fractional CFO" OR "fractional CTO" OR "fractional executive"');
    const url = `https://newsapi.org/v2/everything?q=${query}&from=${startDate.toISOString().slice(0, 10)}&language=en&apiKey=${NEWS_API_KEY}`;

    const response = await fetchWithRetry(url);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    const count = safeNumber(data.totalResults, 0);
    const normalizedScore = normalizeNews(count);
    
    console.log(`[NewsAPI] ${count} articles (28 days) → score ${normalizedScore}`);
    
    return {
      source: 'newsapi',
      signal_type: 'momentum',
      category: 'media_coverage',
      raw_value: count,
      normalized_value: normalizedScore,
      metadata: { 
        window_days: 28,
        search_phrases: ['fractional CMO', 'fractional CFO', 'fractional CTO', 'fractional executive']
      },
      success: true
    };
    
  } catch (error) {
    console.error('[NewsAPI] Failed:', error.message);
    return {
      source: 'newsapi', 
      signal_type: 'momentum',
      category: 'media_coverage',
      raw_value: 0,
      normalized_value: 20, // pessimistic fallback
      success: false,
      error: error.message
    };
  }
}

async function collectBraveNewsSignal(date: string): Promise<SignalResult> {
  if (!BRAVE_API_KEY) {
    console.log('[Brave News] No API key configured, skipping');
    return {
      source: 'brave_news',
      signal_type: 'momentum',
      category: 'media_coverage',
      raw_value: 0,
      normalized_value: 20,
      success: false,
      error: 'No BRAVE_API_KEY configured'
    };
  }

  console.log('[Brave News] Collecting fractional executive news coverage...');

  try {
    const query = encodeURIComponent('"fractional CFO" OR "fractional CMO" OR "fractional CTO" OR "fractional executive"');
    let totalArticles = 0;

    // Paginate up to 3 pages (Brave News returns max 20 per page, no totalResults field)
    for (let offset = 0; offset < 60; offset += 20) {
      const url = `https://api.search.brave.com/res/v1/news/search?q=${query}&count=20&offset=${offset}&freshness=pm`;

      const response = await fetchWithRetry(url, {
        headers: { 'X-Subscription-Token': BRAVE_API_KEY }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      const results = data.results || [];
      totalArticles += results.length;

      // Stop paginating if fewer than 20 results (no more pages)
      if (results.length < 20) break;

      // Rate limit: 1 request/second on free tier
      if (offset + 20 < 60) {
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
    }

    const normalizedScore = normalizeNews(totalArticles);
    console.log(`[Brave News] ${totalArticles} articles (past month) → score ${normalizedScore}`);

    return {
      source: 'brave_news',
      signal_type: 'momentum',
      category: 'media_coverage',
      raw_value: totalArticles,
      normalized_value: normalizedScore,
      metadata: {
        window: 'past_month',
        search_phrases: ['fractional CFO', 'fractional CMO', 'fractional CTO', 'fractional executive']
      },
      success: true
    };

  } catch (error) {
    console.error('[Brave News] Failed:', error.message);
    return {
      source: 'brave_news',
      signal_type: 'momentum',
      category: 'media_coverage',
      raw_value: 0,
      normalized_value: 20,
      success: false,
      error: error.message
    };
  }
}

async function collectBraveWebMentionsSignal(date: string): Promise<SignalResult> {
  if (!BRAVE_API_KEY) {
    console.log('[Brave Web] No API key configured, skipping');
    return {
      source: 'brave_web',
      signal_type: 'momentum',
      category: 'web_discourse',
      raw_value: 0,
      normalized_value: 15,
      success: false,
      error: 'No BRAVE_API_KEY configured'
    };
  }

  console.log('[Brave Web] Collecting web discourse signals...');

  try {
    const resultCounts: number[] = [];

    for (let i = 0; i < BRAVE_WEB_SEARCH_TERMS.length; i++) {
      const term = BRAVE_WEB_SEARCH_TERMS[i];
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(term)}&count=20&freshness=pm&result_filter=web`;

      const response = await fetchWithRetry(url, {
        headers: { 'X-Subscription-Token': BRAVE_API_KEY }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      // Brave Web Search provides an estimated total result count
      const estimatedTotal = safeNumber(data.web?.totalResults ?? data.query?.total_count ?? data.web?.results?.length, 0);
      resultCounts.push(estimatedTotal);

      console.log(`[Brave Web] "${term}": ~${estimatedTotal} results`);

      // Rate limit: 1 request/second on free tier
      if (i < BRAVE_WEB_SEARCH_TERMS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
    }

    const avgCount = resultCounts.length > 0
      ? resultCounts.reduce((a, b) => a + b, 0) / resultCounts.length
      : 0;
    const normalizedScore = normalizeWebMentions(avgCount);

    console.log(`[Brave Web] Average estimated results: ${Math.round(avgCount)} → score ${normalizedScore}`);

    return {
      source: 'brave_web',
      signal_type: 'momentum',
      category: 'web_discourse',
      raw_value: Math.round(avgCount),
      normalized_value: normalizedScore,
      metadata: {
        terms: BRAVE_WEB_SEARCH_TERMS,
        term_counts: resultCounts,
        window: 'past_month'
      },
      success: true
    };

  } catch (error) {
    console.error('[Brave Web] Failed:', error.message);
    return {
      source: 'brave_web',
      signal_type: 'momentum',
      category: 'web_discourse',
      raw_value: 0,
      normalized_value: 15,
      success: false,
      error: error.message
    };
  }
}

async function collectPDLSupplySignals(date: string): Promise<SignalResult[]> {
  if (!PDL_API_KEY) {
    console.log('[PDL] No API key configured, skipping supply signal collection');
    return [];
  }

  console.log('[PDL] Starting supply signal collection...');
  const results: SignalResult[] = [];

  // Query PDL for each fractional role to count professionals with that title
  const PDL_ROLES = [
    { title: 'fractional CFO', category: 'cfo' },
    { title: 'fractional CMO', category: 'cmo' },
    { title: 'fractional CTO', category: 'cto' },
    { title: 'fractional COO', category: 'coo' },
    { title: 'fractional CRO', category: 'cro' },
    { title: 'fractional CEO', category: 'ceo' },
  ];

  let totalProfiles = 0;

  for (const role of PDL_ROLES) {
    try {
      const response = await fetchWithRetry(
        'https://api.peopledatalabs.com/v5/person/search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': PDL_API_KEY,
          },
          body: JSON.stringify({
            sql: `SELECT * FROM person WHERE job_title LIKE '%${role.title}%' AND location_country='us'`,
            size: 1, // Minimum allowed by PDL API; we only use the total count
          }),
        },
        2, // fewer retries to conserve API credits
        15000
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const count = safeNumber(data.total, 0);
      totalProfiles += count;
      const normalized = normalizeSupplyCount(count);

      results.push({
        source: 'people_data_labs',
        signal_type: 'supply',
        category: role.category,
        raw_value: count,
        normalized_value: normalized,
        metadata: { query_title: role.title, geo: 'us' },
        success: true,
      });

      console.log(`[PDL] ${role.title}: ${count} profiles → score ${normalized}`);
    } catch (error) {
      console.error(`[PDL] ${role.title} failed:`, error.message);
      results.push({
        source: 'people_data_labs',
        signal_type: 'supply',
        category: role.category,
        raw_value: 0,
        normalized_value: 10,
        success: false,
        error: error.message,
      });
    }
  }

  // Aggregate supply signal
  if (results.some(r => r.success)) {
    const successfulScores = results.filter(r => r.success).map(r => r.normalized_value);
    const avgScore = Math.round(successfulScores.reduce((a, b) => a + b, 0) / successfulScores.length);

    results.push({
      source: 'people_data_labs',
      signal_type: 'supply',
      category: 'aggregate',
      raw_value: totalProfiles,
      normalized_value: avgScore,
      metadata: { role_count: PDL_ROLES.length, total_profiles: totalProfiles },
      success: true,
    });

    console.log(`[PDL] Aggregate: ${totalProfiles} total profiles → score ${avgScore}`);
  }

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Support explicit date parameter for backfill and scheduling
  const urlParams = new URL(req.url).searchParams;
  const today = urlParams.get('date') || new Date().toISOString().slice(0, 10);
  console.log(`[Pipeline] Starting signal collection for ${today}`);

  // Track pipeline execution
  const { data: runData } = await supabase
    .from('pipeline_runs')
    .insert({ 
      source: 'ingest-signals', 
      started_at: new Date().toISOString(), 
      status: 'running',
      metadata: { target_date: today }
    })
    .select()
    .single();

  try {
    // Collect all signals in parallel for speed
    const [
      adzunaResults,
      trendsResult,
      edgarResult,
      newsResult,
      braveNewsResult,
      braveWebResult,
      pdlResults,
      supplyTrendsResult
    ] = await Promise.all([
      collectAdzunaSignals(today),
      collectGoogleTrendsSignal(today),
      collectSecEdgarSignal(today),
      collectNewsApiSignal(today),
      collectBraveNewsSignal(today),
      collectBraveWebMentionsSignal(today),
      collectPDLSupplySignals(today),
      collectSupplyTrendsSignal(today)
    ]);

    // Flatten all results
    const allSignals = [
      ...adzunaResults,
      trendsResult,
      edgarResult,
      newsResult,
      braveNewsResult,
      braveWebResult,
      ...pdlResults,
      supplyTrendsResult
    ];

    const successfulSignals = allSignals.filter(s => s.success);
    const failedSignals = allSignals.filter(s => !s.success);

    console.log(`[Pipeline] ${successfulSignals.length}/${allSignals.length} signals collected successfully`);

    if (successfulSignals.length < 2) {
      throw new Error(`Insufficient signals: ${successfulSignals.length}/4 sources succeeded`);
    }

    // Prepare database records
    const signalRecords = successfulSignals.map(signal => ({
      date: today,
      source: signal.source,
      signal_type: signal.signal_type,
      category: signal.category,
      normalized_value: signal.normalized_value,
      raw_value: signal.raw_value,
      metadata: signal.metadata || {}
    }));

    // Atomic upsert: use ON CONFLICT to avoid delete+insert race condition
    const { error: upsertError } = await supabase
      .from('signals')
      .upsert(signalRecords, { onConflict: 'date,source,signal_type,category' });

    if (upsertError) throw upsertError;

    // Weighted confidence: not all sources are equally important
    const successfulSources = [...new Set(successfulSignals.map(s => s.source))];
    const confidence = calculateWeightedConfidence(successfulSources);
    
    // Update pipeline run status
    if (runData?.id) {
      await supabase.from('pipeline_runs').update({
        completed_at: new Date().toISOString(),
        status: 'success',
        records_inserted: signalRecords.length,
        confidence: confidence,
        metadata: { 
          successful_sources: successfulSignals.map(s => s.source),
          failed_sources: failedSignals.map(s => ({ source: s.source, error: s.error }))
        }
      }).eq('id', runData.id);
    }

    // Update data_source_health for each source
    const allSourceNames = ['adzuna', 'google_trends', 'sec_edgar', 'newsapi', 'brave_news', 'brave_web', 'people_data_labs', 'supply_trends'];
    const now = new Date().toISOString();
    for (const src of allSourceNames) {
      const srcSignals = allSignals.filter(s => s.source === src);
      if (srcSignals.length === 0) continue; // source wasn't attempted
      const anySuccess = srcSignals.some(s => s.success);
      const errors = srcSignals.filter(s => !s.success);
      await supabase.from('data_source_health').upsert({
        source: src,
        last_checked: now,
        ...(anySuccess ? { last_success: now, status: 'healthy', error_count: 0 } : { status: errors.length > 0 ? 'failed' : 'unknown', error_count: errors.length }),
        metadata: { last_error: errors[0]?.error || null },
        updated_at: now,
      }, { onConflict: 'source' });
    }

    // Trigger FWI calculation
    console.log('[Pipeline] Triggering FWI calculation...');
    const fwiResponse = await fetch(`${SUPABASE_URL}/functions/v1/calculate-fwi?date=${today}`, {
      headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });

    const fwiResult = fwiResponse.ok ? await fwiResponse.json() : { error: 'FWI calculation failed' };

    return new Response(JSON.stringify({
      success: true,
      date: today,
      signals_collected: successfulSignals.length,
      signals_failed: failedSignals.length,
      confidence: confidence,
      fwi_result: fwiResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Pipeline] Failed:', error.message);
    
    // Update pipeline run with error
    if (runData?.id) {
      await supabase.from('pipeline_runs').update({
        completed_at: new Date().toISOString(),
        status: 'error',
        error: error.message
      }).eq('id', runData.id);
    }

    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});