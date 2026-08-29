/**
 * Read-only audit of talent-supply coverage in fwi_scores.
 *
 * For each recent fwi_scores row it reports whether supply_score is a real reading
 * or null (unmeasured), and — for null days — whether the signals table holds any
 * *genuine* supply signal (raw_value > 0) that a recompute could recover, versus only
 * empty placeholders (e.g. gofractional raw_value 0) that are correctly excluded.
 * It also reports the most recent continuous run of real supply readings, which is the
 * window the dashboard frames the chart to.
 *
 * This script writes nothing. It is purely diagnostic.
 *
 * Run: SUPABASE_SERVICE_KEY=... npx tsx scripts/supply-gap-audit.ts
 *      (falls back to the public anon key for read-only access if no service key is set)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dtlcprcpvdomrehbejhw.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bGNwcmNwdmRvbXJlaGJlamh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MTM3ODEsImV4cCI6MjA2OTM4OTc4MX0.bSvVAJb5Y2Tszq_AcvAHaNeJs5m--kFlRH4XZ2dfP_8';
const KEY = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;

const WEEKS = Number(process.env.AUDIT_LIMIT || 60);

async function rest(path: string): Promise<unknown[]> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!resp.ok) throw new Error(`${path} -> ${resp.status} ${await resp.text()}`);
  return resp.json();
}

async function main() {
  const scores = (
    await rest(`fwi_scores?select=date,supply_score&order=date.desc&limit=${WEEKS}`)
  ).reverse() as { date: string; supply_score: number | null }[];

  if (scores.length === 0) {
    console.log('No fwi_scores rows found.');
    return;
  }

  // Pull every supply signal across the audited window in one query.
  const from = scores[0].date;
  const to = scores[scores.length - 1].date;
  const supplySignals = (await rest(
    `signals?select=date,source,category,raw_value&signal_type=eq.supply&date=gte.${from}&date=lte.${to}&order=date.asc`,
  )) as { date: string; source: string; category: string; raw_value: number | null }[];

  const realByDate = new Set<string>();
  for (const s of supplySignals) {
    if (s.raw_value != null && s.raw_value > 0) realByDate.add(s.date);
  }

  let measured = 0;
  let nullRecoverable = 0; // null today, but a real supply signal exists → recompute would recover
  let nullEmpty = 0; // null and genuinely no real signal → nothing to recover

  console.log(`\nTalent-supply coverage, ${from} → ${to} (${scores.length} rows)\n`);
  for (const r of scores) {
    if (r.supply_score != null) {
      measured++;
      continue;
    }
    if (realByDate.has(r.date)) {
      nullRecoverable++;
      console.log(`  ${r.date}  NULL  ← recoverable (real supply signal present; recompute it)`);
    } else {
      nullEmpty++;
      console.log(`  ${r.date}  NULL  ← genuinely unmeasured (no real supply signal)`);
    }
  }

  // Most recent continuous run of real readings (the chart's display window).
  let runStart = scores.length;
  if (scores[scores.length - 1].supply_score != null) {
    runStart = scores.length - 1;
    while (runStart > 0 && scores[runStart - 1].supply_score != null) runStart--;
  }
  const run = scores.slice(runStart);

  console.log(`\nSummary:`);
  console.log(`  measured days:            ${measured}`);
  console.log(`  null but recoverable:     ${nullRecoverable}  (run calculate-fwi for these dates)`);
  console.log(`  null, genuinely empty:    ${nullEmpty}  (no real data — not fabricated)`);
  console.log(
    `  trailing continuous run:  ${run.length} readings` +
      (run.length ? ` (${run[0].date} → ${run[run.length - 1].date})` : ''),
  );
  console.log(
    `\nThe dashboard frames the chart to the trailing continuous run so it is gapless using\nonly real readings. Genuinely-empty days are not bridged with invented points.\n`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
