// Shared environment guard for the Vercel-side functions.
//
// WHY THIS EXISTS
// ---------------
// Every handler here used to read `process.env.SUPABASE_URL || ''`. When the
// variable is missing on the deployment target — which is its actual state as
// of 2026-08-08 — that empty string is concatenated into a request URL and the
// runtime throws "Failed to parse URL from /rest/v1/...". Three consequences,
// none of them obvious from the error:
//
//   1. /api/health returns 503 with a message about URL parsing rather than
//      about configuration, so it reads as a transient upstream problem.
//   2. The daily cron's ingest call fails the same way.
//   3. The degradation alert it would have sent fails the same way again,
//      because sendAlert() posts to `${SUPABASE_URL}/functions/v1/...` too.
//      The alert path is taken out by the same missing variable that caused
//      the thing worth alerting about.
//
// The pipeline itself kept running throughout, because the real daily schedule
// is the pg_cron job inside Supabase (supabase/migrations/008_daily_refresh_cron.sql).
// So the system looked healthy while every Vercel-side check and alert attached
// to it was dead — silent degradation of the monitoring rather than of the data.
//
// A missing variable is now a named, immediate failure instead of a confusing
// one three calls later.

// A flat shape rather than a discriminated union: this project compiles with
// `strictNullChecks: false` (tsconfig.app.json), where narrowing on `ok` does
// not work and every access to `missing`/`message` would be a type error.
export type ConfigResult = {
  ok: boolean;
  missing: string[];
  message: string;
  supabaseUrl: string;
  serviceKey: string;
};

export function loadConfig(required: string[] = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']): ConfigResult {
  const missing = required.filter((name) => !process.env[name]);
  const message = missing.length
    ? `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Set them on the Vercel project (Settings → Environment Variables) and redeploy. ' +
      'Until then this function cannot reach Supabase, and any alert it would send fails for the same reason.'
    : '';

  if (missing.length) console.error(`[Config] ${message}`);

  return {
    ok: missing.length === 0,
    missing,
    message,
    supabaseUrl: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}
