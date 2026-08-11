import type { VercelRequest, VercelResponse } from './_types.js';
// The .js extension is required: package.json sets "type": "module", and under
// ESM an extensionless relative specifier throws ERR_MODULE_NOT_FOUND at
// invocation. The specifier names the emitted file, not the .ts source.
import { loadConfig } from './_config.js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const STALE_HOURS = 48;

interface FWIScoreRow { date: string }
interface PipelineRunRow { status: string; error?: string | null }
interface SourceHealthRow { source: string; status: string }

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // A misconfigured deployment must not look like an unhealthy pipeline. Three
  // upstream checks failing on "Failed to parse URL" reads as a Supabase outage
  // when the truth is that this function was never given the URL.
  const config = loadConfig();
  if (!config.ok) {
    return res.status(503).json({
      status: 'misconfigured',
      issues: [config.message],
      missing: config.missing,
      checked_at: new Date().toISOString(),
    });
  }

  const headers = {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  };

  const issues: string[] = [];

  // 1. Check latest FWI score age
  try {
    const fwiRes = await fetch(
      `${SUPABASE_URL}/rest/v1/fwi_scores?select=date&order=date.desc&limit=1`,
      { headers },
    );
    const [latest] = await fwiRes.json() as FWIScoreRow[];
    if (!latest) {
      issues.push('No FWI scores exist in database');
    } else {
      const ageHours = (Date.now() - new Date(latest.date + 'T00:00:00Z').getTime()) / (1000 * 60 * 60);
      if (ageHours > STALE_HOURS) {
        issues.push(`Latest FWI score is ${Math.round(ageHours)}h old (threshold: ${STALE_HOURS}h)`);
      }
    }
  } catch (error: unknown) {
    issues.push(`FWI score check failed: ${errorMessage(error)}`);
  }

  // 2. Check latest pipeline run
  try {
    const runRes = await fetch(
      `${SUPABASE_URL}/rest/v1/pipeline_runs?select=status,started_at,error&order=started_at.desc&limit=3`,
      { headers },
    );
    const runs = await runRes.json() as PipelineRunRow[];
    if (!runs || runs.length === 0) {
      issues.push('No pipeline runs recorded');
    } else {
      const lastRun = runs[0];
      if (lastRun.status === 'error') {
        issues.push(`Last pipeline run failed: ${lastRun.error || 'unknown error'}`);
      }
      const consecutiveErrors = runs.filter((run) => run.status === 'error').length;
      if (consecutiveErrors >= 2) {
        issues.push(`${consecutiveErrors} of last 3 pipeline runs failed`);
      }
    }
  } catch (error: unknown) {
    issues.push(`Pipeline run check failed: ${errorMessage(error)}`);
  }

  // 3. Check data source health
  try {
    const healthRes = await fetch(
      `${SUPABASE_URL}/rest/v1/data_source_health?select=source,status,last_checked`,
      { headers },
    );
    const sources = await healthRes.json() as SourceHealthRow[];
    const failed = sources.filter((source) => source.status === 'failed' || source.status === 'degraded');
    if (failed.length > 0) {
      issues.push(`${failed.length} data source(s) unhealthy: ${failed.map((source) => source.source).join(', ')}`);
    }
  } catch (error: unknown) {
    issues.push(`Data source health check failed: ${errorMessage(error)}`);
  }

  const healthy = issues.length === 0;

  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    issues,
    checked_at: new Date().toISOString(),
  });
}
