// Validates the FWI against official statistics held out of the composite.
// Read-only, dependency-free, no secrets. docs/DATA_QUALITY_STRATEGY.md §1.
//
// WHY THIS EXISTS
// ---------------
// Twenty inputs feed a composite that has never been checked against an
// external measure of the thing it claims to track. `bls`, `fred` and
// `census_acs` are collected as `signal_type = 'context'` and excluded from
// calculate-fwi's composite (only 'demand' | 'supply' | 'momentum' feed a
// pillar) — that is what makes them usable as a held-out validation set
// instead of an input.
//
// METHOD, AND WHY IT IS NOT JUST A PEARSON OVER THE DAILY ROWS
// --------------------------------------------------------------
// Official series update monthly (BLS) or weekly (FRED). The collector snaps
// the latest published value every day, so a daily join repeats the same
// value for ~20-30 consecutive rows. Correlating on daily rows treats each
// repeat as an independent observation and inflates n by an order of
// magnitude (pseudo-replication) — the exact "n" mistake §1 warns against.
//
// This script instead collapses each anchor series into its actual release
// periods (one row per distinct published value) and correlates the FWI's
// mean score *within each period* against the anchor value. n is therefore
// the number of independent official releases that have landed since the
// daily era began (2026-06-01), which is usually small — and reporting that
// n honestly, with the CI it implies, is the point.
//
// Run:  node scripts/validate-anchor.mjs             (human report)
//       node scripts/validate-anchor.mjs --json      (machine report)
//
// Exit: 0 always unless the script itself could not run (2). This measures;
// it does not judge — §5 of the strategy needs a person for that.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const JSON_MODE = process.argv.includes('--json');

// Same daily-era boundary as quality-metrics.mjs, for the same reason: before
// 2026-06-01 the history is a weekly/biweekly backfill and mixing eras
// measures the sampling difference rather than the sources.
const DAILY_ERA_START = '2026-06-01';

// FWI fields available to correlate against an anchor.
const FWI_FIELDS = { overall: 'overall_score', demand: 'demand_score', supply: 'supply_score', culture: 'momentum_score' };

// Context sources currently collected that are candidate anchors. Verified
// against supabase/functions/calculate-fwi/index.ts and ingest-signals: all
// are `signal_type: 'context'`, never read by calculate-fwi, so none
// of them feed the thing they would validate.
const ANCHORS = [
  { source: 'bls', category: 'job_openings', label: 'BLS JOLTS job openings (total nonfarm)' },
  // Wired 2026-09-24, so its history starts then and it will report no rows
  // until the first monthly release lands. This is the anchor §1 actually
  // names; total nonfarm stays above as the broader control.
  { source: 'bls', category: 'job_openings_pbs', label: 'BLS JOLTS job openings (professional & business services — the §1 anchor, collected from 2026-09-24)' },
  { source: 'fred', category: 'icsa', label: 'FRED initial jobless claims (ICSA)' },
  { source: 'census_acs', category: 'self_employment', label: 'Census ACS self-employment' },
];

function supabaseConfig() {
  const src = read('src/lib/supabase.ts');
  const url = src.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/);
  const key = src.match(/(eyJ[A-Za-z0-9._-]+)/);
  if (!url || !key) throw new Error('Could not read Supabase URL/anon key from src/lib/supabase.ts');
  const envUrl = process.env.SUPABASE_URL, envKey = process.env.SUPABASE_ANON_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey };
  return { url: url[1], key: key[1] };
}

const SB = supabaseConfig();
async function restAll(path) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SB.url}/rest/v1/${path}&limit=1000&offset=${offset}`, {
      headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}` },
    });
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 4) return { r: null, n };
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
  if (dx === 0 || dy === 0) return { r: null, n, degenerate: true };
  return { r: num / Math.sqrt(dx * dy), n };
}

// Fisher z-transform 95% CI. At n=4 (df=1) this is intentionally almost the
// full [-1, 1] range — that width IS the finding when releases are scarce,
// not a bug in the CI math.
function fisherCI(r, n) {
  if (r === null || n < 4) return null;
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const back = (zz) => (Math.exp(2 * zz) - 1) / (Math.exp(2 * zz) + 1);
  return [back(z - 1.96 * se), back(z + 1.96 * se)];
}

async function run() {
  const fwi = await restAll(`fwi_scores?select=date,overall_score,demand_score,supply_score,momentum_score&date=gte.${DAILY_ERA_START}&order=date.asc`);
  const fwiByDate = Object.fromEntries(fwi.map((r) => [r.date, r]));

  const contextRows = await restAll(
    `signals?select=date,source,category,raw_value&signal_type=eq.context&source=in.(${ANCHORS.map((a) => a.source).join(',')})&date=gte.${DAILY_ERA_START}&order=date.asc`,
  );

  const results = [];
  for (const anchor of ANCHORS) {
    const rows = contextRows.filter((r) => r.source === anchor.source && r.category === anchor.category);
    if (rows.length === 0) { results.push({ ...anchor, skipped: 'no rows in daily era' }); continue; }

    // Collapse to release periods: consecutive days sharing the same raw
    // value are one release, not one observation per day.
    const periods = {};
    for (const r of rows) (periods[r.raw_value] ||= []).push(r.date);
    const periodRows = Object.entries(periods).map(([val, dates]) => ({ value: Number(val), dates: dates.sort() }));

    if (periodRows.length < 4) {
      results.push({ ...anchor, skipped: `only ${periodRows.length} distinct release(s) in the daily era — need >= 4 to compute any correlation`, periods: periodRows.map((p) => ({ value: p.value, first: p.dates[0], last: p.dates[p.dates.length - 1], days: p.dates.length })) });
      continue;
    }
    // A series with zero variance across its releases (e.g. a single-year
    // ACS estimate repeated) cannot be an anchor no matter how much history
    // accumulates against it.
    const distinctValues = new Set(periodRows.map((p) => p.value));
    if (distinctValues.size < 2) {
      results.push({ ...anchor, skipped: 'zero variance across releases in the daily era — not usable as an anchor' });
      continue;
    }

    const fieldResults = {};
    for (const [pillar, field] of Object.entries(FWI_FIELDS)) {
      const xs = [], ys = [];
      for (const p of periodRows) {
        const vals = p.dates.map((d) => fwiByDate[d]?.[field]).filter((v) => v != null);
        if (vals.length === 0) continue;
        xs.push(p.value);
        ys.push(vals.reduce((a, b) => a + b, 0) / vals.length);
      }
      const { r, n } = pearson(xs, ys);
      fieldResults[pillar] = { r, n, ci95: fisherCI(r, n) };
    }
    results.push({ ...anchor, lag_weeks: 0, releases: periodRows.length, fields: fieldResults });
  }

  if (JSON_MODE) { console.log(JSON.stringify({ since: DAILY_ERA_START, results }, null, 2)); return; }

  console.log(`ANCHOR VALIDATION — ${DAILY_ERA_START} to today, lag 0 (release-period correlation)\n`);
  for (const r of results) {
    console.log(`${r.label}`);
    if (r.skipped) { console.log(`  skipped: ${r.skipped}`); if (r.periods) for (const p of r.periods) console.log(`    ${p.value}  ${p.first} -> ${p.last} (${p.days}d)`); console.log(''); continue; }
    console.log(`  n = ${r.releases} independent release(s) since ${DAILY_ERA_START}`);
    for (const [pillar, f] of Object.entries(r.fields)) {
      const rTxt = f.r === null ? 'n/a' : f.r.toFixed(3);
      const ciTxt = f.ci95 ? `95% CI [${f.ci95[0].toFixed(2)}, ${f.ci95[1].toFixed(2)}]` : 'CI n/a (n<4)';
      console.log(`  r(${pillar}) = ${rTxt}  ${ciTxt}`);
    }
    console.log('');
  }
}

run().catch((err) => { console.error('validate-anchor failed:', err.message); process.exit(2); });
