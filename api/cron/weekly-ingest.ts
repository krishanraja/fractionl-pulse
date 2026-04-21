import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = 'https://dtlcprcpvdomrehbejhw.supabase.co';
const CRON_SECRET = process.env.CRON_SECRET || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is actually called by Vercel Cron (or has the secret)
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${CRON_SECRET}` && !req.headers['x-vercel-cron']) {
    return res.status(401).json({ error: 'Unauthorized' });
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

    const ingestResult = await ingestRes.json();

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
  } catch (error: any) {
    console.error('[Cron] Weekly ingest failed:', error.message);
    return res.status(500).json({
      error: error.message,
      date: today,
      triggered_at: new Date().toISOString(),
    });
  }
}
