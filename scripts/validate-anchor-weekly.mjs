// Weekly-granularity validation of the FWI against FRED initial jobless claims
// (ICSA), using the FULL public ICSA history rather than only the rows Pulse
// has collected. docs/DATA_QUALITY_STRATEGY.md §1.
//
// WHY: validate-anchor.mjs can only see releases Pulse collected itself (ICSA
// since 2026-08-11, n=6 on 2026-10-01), so its n is capped by when collection
// began, not by how much official data exists. ICSA is public back to 1967 and
// the keyless fredgraph.csv endpoint serves it, so the FWI's own daily era is
// the only limit. Weekly means of the FWI against weekly ICSA give n≈17 at lag 0.
//
// METHOD: ICSA is week-ending Saturday. FWI is averaged over the same Sun-Sat
// window; only complete weeks inside the daily era (>= 2026-06-01) count.
// Lag k pairs FWI(week t) with ICSA(week t+k), i.e. the FWI leading ICSA by k
// weeks. Both LEVELS and WEEK-OVER-WEEK CHANGES are reported: levels of two
// slow series share trends and overstate r, so changes are the harder test.
// n is reported on every line; the 95% CI is Fisher z. Seven lags x 4 fields x
// 2 transforms = 56 tests, so a lone CI excluding zero is expected by chance.
//
// Run: node scripts/validate-anchor-weekly.mjs   (read-only, no secrets)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAILY_ERA_START = '2026-06-01';
const MAX_LAG = 6;
const src = readFileSync(join(ROOT, 'src/lib/supabase.ts'), 'utf8');
const SB = { url: src.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)[1], key: src.match(/(eyJ[A-Za-z0-9._-]+)/)[1] };
const FIELDS = { overall: 'overall_score', demand: 'demand_score', supply: 'supply_score', culture: 'momentum_score' };

const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
function pearson(xs, ys) {
  const n = xs.length; if (n < 4) return { r: null, n };
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
  return dx && dy ? { r: num / Math.sqrt(dx * dy), n } : { r: null, n };
}
function ci(r, n) {
  if (r === null || n < 4) return null;
  const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)];
}
const fmt = (r, n) => { if (r === null) return `n=${n}  r=n/a`; const c = ci(r, n); return `n=${String(n).padStart(2)}  r=${r.toFixed(3).padStart(6)}  CI [${c[0].toFixed(2)}, ${c[1].toFixed(2)}]${c[0] > 0 || c[1] < 0 ? '  *excl 0' : ''}`; };

async function fredCsv(url) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); const t = await r.text(); if (r.ok && t.startsWith('observation_date')) return t; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error('FRED ICSA fetch failed after 4 attempts');
}
const fred = (await fredCsv(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=ICSA&cosd=${addDays(DAILY_ERA_START, -14)}`))
  .trim().split('\n').slice(1).map((l) => l.split(',')).map(([d, v]) => ({ week_end: d, v: Number(v) })).filter((x) => Number.isFinite(x.v));
const res = await fetch(`${SB.url}/rest/v1/fwi_scores?select=date,overall_score,demand_score,supply_score,momentum_score&date=gte.${DAILY_ERA_START}&order=date.asc&limit=1000`, { headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}` } });
if (!res.ok) throw new Error(`fwi_scores ${res.status}`);
const fwi = await res.json();
const lastDay = fwi.at(-1).date;

// Complete weeks only: Sun..Sat ending at week_end, fully inside the daily era and the FWI history.
const weeks = fred.filter((w) => addDays(w.week_end, -6) >= DAILY_ERA_START && w.week_end <= lastDay).map((w) => {
  const start = addDays(w.week_end, -6);
  const rows = fwi.filter((r) => r.date >= start && r.date <= w.week_end);
  const o = { week_end: w.week_end, icsa: w.v, days: rows.length };
  for (const [k, col] of Object.entries(FIELDS)) {
    const vals = rows.map((r) => r[col]).filter((x) => x !== null && x !== undefined).map(Number);
    o[k] = vals.length >= 4 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return o;
});
// ICSA history before the first complete week is needed for lagged-forward pairing only after it; fine.
const fredAll = Object.fromEntries(fred.map((w) => [w.week_end, w.v]));
console.log(`FWI vs FRED ICSA — weekly means, daily era from ${DAILY_ERA_START}, ${weeks.length} complete weeks (${weeks[0].week_end} .. ${weeks.at(-1).week_end})`);
console.log('Lag k: FWI in week t vs ICSA in week t+k (FWI leads). Negative r = FWI up when claims down.\n');
for (const transform of ['level', 'change']) {
  console.log(`== ${transform === 'level' ? 'LEVELS' : 'WEEK-OVER-WEEK CHANGES (detrended; the harder test)'} ==`);
  for (const k of Object.keys(FIELDS)) {
    console.log(`  ${k}`);
    for (let lag = 0; lag <= MAX_LAG; lag++) {
      const xs = [], ys = [];
      for (let i = transform === 'change' ? 1 : 0; i < weeks.length; i++) {
        const a = weeks[i][k], aPrev = transform === 'change' ? weeks[i - 1][k] : 0;
        const wkLag = addDays(weeks[i].week_end, 7 * lag);
        const b = fredAll[wkLag];
        const bPrev = transform === 'change' ? fredAll[addDays(wkLag, -7)] : 0;
        if (a == null || aPrev == null || b == null || bPrev == null) continue;
        xs.push(a - aPrev); ys.push(b - bPrev);
      }
      console.log(`    lag ${lag}  ${fmt(...Object.values(pearson(xs, ys)))}`);
    }
  }
  console.log();
}
