// Weekly-anchor validation of the FWI. Read-only, dependency-free, no secrets.
// docs/DATA_QUALITY_STRATEGY.md §1.
//
// WHY THIS EXISTS (alongside validate-anchor.mjs)
// ------------------------------------------------
// validate-anchor.mjs correlates against whatever the collector happened to
// store, which gives n = 6 releases. The anchors themselves are public and
// keyless, with full history, so the limit on n was our collection, not the
// world's. This script pulls the weekly official series directly and joins
// them to the FWI's weekly mean for the daily era (2026-06-01 onward):
//   - FRED ICSA initial jobless claims (keyless fredgraph.csv)
//   - Census Business Formation Statistics weekly applications: all (BA),
//     high-propensity (HBA), planned-wages (WBA)
// One row per calendar week ending Saturday, so n is independent weeks.
//
// Levels AND week-over-week changes are reported: with ~20 points that both
// drift, a levels correlation can be a shared trend. Lags -4..+4 weeks
// (positive = FWI leads the anchor). Every coefficient prints its n and CI,
// and the count of comparisons made is printed so a lone significant cell can
// be judged against chance.
//
// Run:  node scripts/validate-anchor-weekly.mjs [--json]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAILY_ERA_START = '2026-06-01';
const JSON_MODE = process.argv.includes('--json');

function sb() {
  const s = readFileSync(join(ROOT, 'src/lib/supabase.ts'), 'utf8');
  const url = s.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)[1];
  const key = s.match(/(eyJ[A-Za-z0-9._-]+)/)[1];
  return { url, key };
}
const SB = sb();
async function restAll(path) {
  const out = [];
  for (let o = 0; ; o += 1000) {
    const r = await fetch(`${SB.url}/rest/v1/${path}&limit=1000&offset=${o}`, { headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}` } });
    if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
    const p = await r.json(); out.push(...p); if (p.length < 1000) return out;
  }
}
async function csv(url) {
  let r;
  for (let i = 0; i < 4; i++) {
    r = await fetch(url, { headers: { 'User-Agent': 'pulse-quality/1.0 (+https://pulse.fractionl.ai)' } });
    if (r.ok) break;
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  const [h, ...rows] = (await r.text()).trim().split(/\r?\n/);
  const cols = h.split(',');
  return rows.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
}

const DAY = 86400000;
const sat = (iso) => { const d = new Date(iso + 'T00:00:00Z'); return new Date(+d + ((6 - d.getUTCDay() + 7) % 7) * DAY).toISOString().slice(0, 10); };
const shift = (iso, weeks) => new Date(+new Date(iso + 'T00:00:00Z') + weeks * 7 * DAY).toISOString().slice(0, 10);

function pearson(x, y) {
  const n = x.length; if (n < 5) return { r: null, n };
  const mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  let nu = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { nu += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return dx && dy ? { r: nu / Math.sqrt(dx * dy), n } : { r: null, n };
}
function ci(r, n) {
  if (r === null || n < 5) return null;
  const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)];
}

const fwi = await restAll(`fwi_scores?select=date,overall_score,demand_score,supply_score,momentum_score&date=gte.${DAILY_ERA_START}&order=date.asc`);
const lastDate = fwi[fwi.length - 1].date;
const FIELDS = { overall: 'overall_score', demand: 'demand_score', supply: 'supply_score', culture: 'momentum_score' };
const wk = {};
for (const row of fwi) (wk[sat(row.date)] ||= []).push(row);
// Only complete weeks (7 daily rows would be ideal; require >= 5 so a gap
// week does not enter on one or two days) and not the in-progress week.
const fwiWeeks = {};
for (const [w, rows] of Object.entries(wk)) {
  if (rows.length < 5 || w > lastDate) continue;
  fwiWeeks[w] = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => {
    const v = rows.map((r) => r[f]).filter((x) => x != null);
    return [k, v.length >= 5 ? v.reduce((a, b) => a + b) / v.length : null];
  }));
}

const anchors = {};
const icsa = await csv('https://fred.stlouisfed.org/graph/fredgraph.csv?id=ICSA&cosd=2026-01-01');
anchors['FRED ICSA initial claims'] = Object.fromEntries(icsa.map((r) => [r.observation_date || r.DATE, Number(r.ICSA)]).filter(([, v]) => !Number.isNaN(v)));
const bfs = await csv('https://www.census.gov/econ/bfs/csv/bfs_us_apps_weekly_nsa.csv');
const dt = await csv('https://www.census.gov/econ/bfs/csv/date_table.csv');
const endOf = {}; for (const r of dt) { const [m, d, y] = r[Object.keys(r)[3]].split('/'); endOf[`${r.Year}-${r.Week}`] = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
const bfsSeries = (col) => Object.fromEntries(bfs.filter((r) => r.Year === '2026' && r[col] !== '').map((r) => [endOf[`${r.Year}-${r.Week}`], Number(r[col])]));
// Year-over-year change removes the strong calendar seasonality in raw NSA applications.
anchors['Census BFS all applications, YoY %'] = bfsSeries('YY_BA_NSA');
anchors['Census BFS high-propensity applications, YoY %'] = bfsSeries('YY_HBA_NSA');
anchors['Census BFS planned-wages applications, YoY %'] = bfsSeries('YY_WBA_NSA');

const out = [];
let comparisons = 0;
for (const [label, series] of Object.entries(anchors)) {
  const cells = [];
  for (const mode of ['level', 'change']) {
    for (let lag = -4; lag <= 4; lag++) {
      for (const pillar of Object.keys(FIELDS)) {
        const xs = [], ys = [];
        for (const [w, f] of Object.entries(fwiWeeks)) {
          if (f[pillar] == null) continue;
          const aw = shift(w, -lag); // lag>0: FWI at week w vs anchor lag weeks earlier... see header: positive = FWI leads
          const a = series[aw]; if (a === undefined) continue;
          if (mode === 'level') { xs.push(a); ys.push(f[pillar]); }
          else {
            const a0 = series[shift(aw, -1)], f0 = fwiWeeks[shift(w, -1)]?.[pillar];
            if (a0 === undefined || f0 == null) continue;
            xs.push(a - a0); ys.push(f[pillar] - f0);
          }
        }
        const { r, n } = pearson(xs, ys);
        if (r !== null) { comparisons++; cells.push({ mode, lag, pillar, r, n, ci: ci(r, n) }); }
      }
    }
  }
  out.push({ label, cells });
}

if (JSON_MODE) { console.log(JSON.stringify({ since: DAILY_ERA_START, weeks: Object.keys(fwiWeeks).length, comparisons, out }, null, 2)); process.exit(0); }
console.log(`WEEKLY ANCHOR VALIDATION — FWI weeks ${Object.keys(fwiWeeks)[0]} .. ${Object.keys(fwiWeeks).at(-1)} (${Object.keys(fwiWeeks).length} complete weeks)`);
console.log(`positive lag = anchor value taken lag weeks BEFORE the FWI week (anchor leads FWI); negative = FWI leads anchor\n`);
for (const { label, cells } of out) {
  console.log(label);
  for (const mode of ['level', 'change']) {
    for (const pillar of Object.keys(FIELDS)) {
      const c0 = cells.find((c) => c.mode === mode && c.lag === 0 && c.pillar === pillar);
      const best = cells.filter((c) => c.mode === mode && c.pillar === pillar).sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
      const f = (c) => c ? `r=${c.r.toFixed(2)} n=${c.n} CI[${c.ci[0].toFixed(2)},${c.ci[1].toFixed(2)}]` : 'n/a';
      console.log(`  ${mode.padEnd(6)} ${pillar.padEnd(7)} lag0 ${f(c0)}   | strongest ${best ? 'lag ' + best.lag + ' ' + f(best) : 'n/a'}`);
    }
  }
  console.log('');
}
console.log(`${comparisons} correlations computed in total (anchors x levels/changes x lags x pillars). At 95%, ~${(comparisons * 0.05).toFixed(0)} would exclude zero by chance alone.`);
