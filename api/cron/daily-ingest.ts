import type { VercelRequest, VercelResponse } from '../_types.js';
// .js extension required — see the note in api/health.ts ("type": "module").
import { loadConfig } from '../_config.js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;

// Degradation thresholds (docs/DATA_SOURCES_ROADMAP.md §6). Overridable via env
// so tightening them doesn't need a code change.
const COMPLETENESS_ALERT_THRESHOLD = Number(process.env.COMPLETENESS_ALERT_THRESHOLD || '0.75');
const MIN_HEALTHY_SOURCES = Number(process.env.MIN_HEALTHY_SOURCES || '14');

interface IngestResult {
  signals_collected?: number;
  confidence?: number;
  sources_healthy?: number;
  fwi_result?: { overall_score?: number };
}

interface CallResult<T> {
  ok: boolean;
  result?: T;
  error?: string;
  attempts: number;
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

async function callWithRetry<T = IngestResult>(
  url: string,
  headers: Record<string, string>,
  label: string,
  retries = MAX_RETRIES,
): Promise<CallResult<T>> {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers });
      if (res.ok) {
        return { ok: true, result: await res.json() as T, attempts: attempt };
      }
      const errText = await res.text();
      if (attempt <= retries) {
        console.warn(`[Cron] ${label} attempt ${attempt} failed (${res.status}), retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
        continue;
      }
      return { ok: false, error: `${label} failed after ${attempt} attempts: ${res.status} ${errText}`, attempts: attempt };
    } catch (err: unknown) {
      const message = errorMessage(err);
      if (attempt <= retries) {
        console.warn(`[Cron] ${label} attempt ${attempt} threw: ${message}, retrying...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
        continue;
      }
      return { ok: false, error: `${label} threw after ${attempt} attempts: ${message}`, attempts: attempt };
    }
  }
  return { ok: false, error: `${label}: exhausted retries`, attempts: MAX_RETRIES + 1 };
}

async function fetchFailedSources(): Promise<string> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/data_source_health?status=eq.failed&select=source,last_success,metadata`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!res.ok) return 'unavailable';
    const rows = await res.json() as Array<{
      source: string;
      last_success: string | null;
      metadata?: { last_error?: string };
    }>;
    if (rows.length === 0) return 'none';
    return rows
      .map(r => `${r.source} (${r.metadata?.last_error || 'unknown error'}; last success ${r.last_success?.slice(0, 10) || 'never'})`)
      .join(', ');
  } catch {
    return 'unavailable';
  }
}

async function sendAlert(
  severity: 'critical' | 'warning',
  subject: string,
  details: Record<string, unknown>,
) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-pipeline-alert`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ severity, subject, details }),
    });

    if (!res.ok) {
      console.error('[Alert] Edge function failed:', res.status, await res.text());
    }
  } catch (err: unknown) {
    console.error('[Alert] Send error:', errorMessage(err));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${CRON_SECRET}` && !req.headers['x-vercel-cron']) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Fail named and immediately. Without this the run dies on a URL-parse error
  // and so does the alert that would have reported it.
  const config = loadConfig();
  if (!config.ok) {
    return res.status(500).json({ error: 'misconfigured', missing: config.missing, message: config.message });
  }

  const today = new Date().toISOString().slice(0, 10);
  const headers = {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  const ingest = await callWithRetry(
    `${SUPABASE_URL}/functions/v1/ingest-signals?date=${today}`,
    headers,
    'ingest-signals',
  );

  let insights: CallResult<unknown> = { ok: false, attempts: 0 };
  if (ingest.ok) {
    insights = await callWithRetry(
      `${SUPABASE_URL}/functions/v1/generate-pulse-insights`,
      headers,
      'generate-pulse-insights',
      1,
    );
  }

  // Record the pipeline run result for health monitoring
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/pipeline_runs`, {
      method: 'POST',
      headers: {
        ...headers,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        source: 'daily-cron',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: ingest.ok ? 'success' : 'error',
        records_inserted: ingest.result?.signals_collected ?? 0,
        confidence: ingest.result?.confidence ?? null,
        error: ingest.error || null,
        metadata: {
          date: today,
          ingest_attempts: ingest.attempts,
          insights_generated: insights.ok,
          insights_attempts: insights.attempts,
        },
      }),
    });
  } catch {
    // Pipeline run logging is best-effort
  }

  // Send email alerts on failure via Supabase Edge Function (uses RESEND_API_KEY from Supabase secrets)
  if (!ingest.ok) {
    await sendAlert('critical', `Daily ingest failed for ${today}`, {
      'Date': today,
      'Error': ingest.error || 'Unknown',
      'Attempts': String(ingest.attempts),
      'Insights attempted': 'No (ingest failed first)',
    });
  } else {
    if (!insights.ok) {
      await sendAlert('warning', `Insights generation failed for ${today}`, {
        'Date': today,
        'Signals collected': String(ingest.result?.signals_collected ?? 'Unknown'),
        'FWI score': String(ingest.result?.fwi_result?.overall_score ?? 'Unknown'),
        'Insights error': 'Generation failed after ingest succeeded',
        'Insights attempts': String(insights.attempts),
      });
    }

    // A "successful" run can still be degraded: individual sources fail silently
    // (429s, expired keys) while the composite keeps publishing on a thinner mix.
    const confidence = ingest.result?.confidence;
    const sourcesHealthy = ingest.result?.sources_healthy;
    const lowConfidence = typeof confidence === 'number' && confidence < COMPLETENESS_ALERT_THRESHOLD;
    const lowCoverage = typeof sourcesHealthy === 'number' && sourcesHealthy < MIN_HEALTHY_SOURCES;
    if (lowConfidence || lowCoverage) {
      await sendAlert('warning', `Pipeline degraded for ${today}: source failures are thinning the index`, {
        'Date': today,
        'Data completeness': String(confidence ?? 'Unknown'),
        'Completeness alert threshold': String(COMPLETENESS_ALERT_THRESHOLD),
        'Healthy sources this run': String(sourcesHealthy ?? 'Unknown'),
        'Minimum healthy sources': String(MIN_HEALTHY_SOURCES),
        'Failing sources': await fetchFailedSources(),
      });
    }
  }

  const status = ingest.ok ? 200 : 500;
  return res.status(status).json({
    success: ingest.ok,
    date: today,
    ingest: {
      ok: ingest.ok,
      attempts: ingest.attempts,
      signals_collected: ingest.result?.signals_collected,
      confidence: ingest.result?.confidence,
      fwi_score: ingest.result?.fwi_result?.overall_score,
      error: ingest.error,
    },
    insights: {
      ok: insights.ok,
      attempts: insights.attempts,
    },
    triggered_at: new Date().toISOString(),
  });
}
