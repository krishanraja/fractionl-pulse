import type { VercelRequest, VercelResponse } from '../_types.js';
// .js extension required — see the note in api/health.ts ("type": "module").
import { loadConfig } from '../_config.js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface IngestResult {
  signals_collected?: number;
  confidence?: number;
  fwi_result?: { overall_score?: number };
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is actually called by Vercel Cron (or has the secret)
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${CRON_SECRET}` && !req.headers['x-vercel-cron']) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const config = loadConfig();
  if (!config.ok) {
    return res.status(500).json({ error: 'misconfigured', missing: config.missing, message: config.message });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    // Step 1: Trigger ingest-signals
    const ingestRes = await fetch(`${SUPABASE_URL}/functions/v1/ingest-signals?date=${today}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!ingestRes.ok) {
      const errText = await ingestRes.text();
      throw new Error(`ingest-signals failed (${ingestRes.status}): ${errText}`);
    }

    const ingestResult = await ingestRes.json() as IngestResult;

    // Step 2: Trigger AI insights generation (non-blocking, best-effort)
    let insightsResult = null;
    try {
      const insightsRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-pulse-insights`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      if (insightsRes.ok) {
        insightsResult = await insightsRes.json();
      }
    } catch (_) {
      // Non-critical: insights generation can fail without breaking the pipeline
    }

    return res.status(200).json({
      success: true,
      date: today,
      ingest: {
        signals_collected: ingestResult.signals_collected,
        confidence: ingestResult.confidence,
        fwi_score: ingestResult.fwi_result?.overall_score,
      },
      insights_generated: insightsResult !== null,
      triggered_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error('[Cron] Weekly ingest failed:', message);
    return res.status(500).json({
      error: message,
      date: today,
      triggered_at: new Date().toISOString(),
    });
  }
}
