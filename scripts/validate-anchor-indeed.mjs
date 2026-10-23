// Indeed Hiring Lab anchor: the single test pre-registered on 2026-10-23 in
// docs/DATA_QUALITY_STRATEGY.md §1, before this data was pulled. Read-only,
// dependency-free, no secrets.
//
// Anchor: unweighted mean of Indeed's US "total postings" index for
// Accounting, Marketing, Software Development and Management (fixed in the
// pre-registration; do not edit the list to improve a result).
// Primary: week-on-week change in the FWI demand pillar vs week-on-week change
// in the anchor, lag 0, Saturday-ending complete weeks of the daily era.
// Secondary (reported, not claimed): levels, and the FWI overall. No lag scan.
//
// Run:  node scripts/validate-anchor-indeed.mjs [--json]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAILY_ERA_START = '2026-06-01';
const CATEGORIES = ['Accounting', 'Marketing', 'Software Development', 'Management'];
const URL = 'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/US/job_postings_by_sector_US.csv';
const JSON_MODE = process.argv.includes('--json');

const s = readFileSync(join(ROOT, 'src/lib/supabase.ts'), 'utf8');
const SB = { url: s.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)[1], key: s.match(/(eyJ[A-Za-z0-9._-]+)/)[1] };
async function restAll(path) {
  const out = [];
  for (let o = 0; ; o += 1000) {
    const r = await fetch(`${SB.url}/rest/v1/${path}&limit=1000&offset=${o}`, { headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}` } });
    if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
    const p = await r.json(); out.push(...p); if (p.length < 1000) return out;
  }
}
const DAY = 86400000;
const sat = (iso) => { const d = new Date(iso + 'T00:00:00Z'); return new Date(+d + ((6 - d.getUTCDay() + 7) % 7) * DAY).toISOString().slice(0, 10); };
const prevWeek = (iso) => new Date(+new Date(iso + 'T00:00:00Z') - 7 * DAY).toISOString().slice(0, 10);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
function pearson(x, y) {
  const n = x.length; if (n < 5) return { r: null, n };
  const mx = mean(x), my = mean(y); let nu = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { nu += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  const r = nu / Math.sqrt(dx * dy); const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3);
  return { r, n, ci: [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)] };
}

const res = await fetch(URL, { headers: { 'User-Agent': 'pulse-quality/1.0 (+https://pulse.fractionl.ai)' } });
if (!res.ok) throw new Error(`${URL} -> ${res.status}`);
const lines = (await res.text()).trim().split(/\r?\n/);
const cols = lines[0].split(',');
const ix = Object.fromEntries(cols.map((c, i) => [c, i]));
// display_name can contain commas inside quotes ("Arts & Entertainment" does not, but be safe)
const daily = {};
for (const l of lines.slice(1)) {
  const m = l.match(/^([^,]+),([^,]+),([^,]+),([^,]+),"?([^"]*)"?$/);
  if (!m) continue;
  const [, date, , val, variable, name] = m;
  if (variable !== 'total postings' || !CATEGORIES.includes(name) || date < DAILY_ERA_START) continue;
  (daily[date] ||= {})[name] = Number(val);
}
void ix;
const anchorWeeks = {};
for (const [d, byCat] of Object.entries(daily)) {
  if (Object.keys(byCat).length !== CATEGORIES.length) continue;
  (anchorWeeks[sat(d)] ||= []).push(mean(Object.values(byCat)));
}
const lastAnchorDay = Object.keys(daily).sort().at(-1);

const fwi = await restAll(`fwi_scores?select=date,overall_score,demand_score&date=gte.${DAILY_ERA_START}&order=date.asc`);
const lastFwiDay = fwi.at(-1).date;
const fwiWeeks = {};
for (const r of fwi) (fwiWeeks[sat(r.date)] ||= []).push(r);

const weeks = Object.keys(fwiWeeks).filter((w) =>
  fwiWeeks[w].length >= 5 && w <= lastFwiDay && w <= lastAnchorDay && (anchorWeeks[w]?.length ?? 0) >= 5).sort();
const W = Object.fromEntries(weeks.map((w) => [w, {
  anchor: mean(anchorWeeks[w]),
  demand: mean(fwiWeeks[w].map((r) => r.demand_score)),
  overall: mean(fwiWeeks[w].map((r) => r.overall_score)),
}]));

function test(field, mode) {
  const xs = [], ys = [];
  for (const w of weeks) {
    if (mode === 'level') { xs.push(W[w].anchor); ys.push(W[w][field]); continue; }
    const p = W[prevWeek(w)]; if (!p) continue;
    xs.push(W[w].anchor - p.anchor); ys.push(W[w][field] - p[field]);
  }
  return pearson(xs, ys);
}
const out = {
  preregistered: '2026-10-23', anchor: CATEGORIES, weeks: { first: weeks[0], last: weeks.at(-1), n: weeks.length },
  primary: { test: 'demand WoW change vs anchor WoW change, lag 0', ...test('demand', 'change') },
  secondary: {
    overall_change: test('overall', 'change'),
    demand_level: test('demand', 'level'),
    overall_level: test('overall', 'level'),
  },
};
if (JSON_MODE) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
const f = (t) => (t.r == null ? `n=${t.n} (too few)` : `r=${t.r.toFixed(2)}  n=${t.n}  95% CI [${t.ci[0].toFixed(2)}, ${t.ci[1].toFixed(2)}]`);
console.log(`INDEED ANCHOR (pre-registered 2026-10-23) — weeks ${out.weeks.first} .. ${out.weeks.last}, ${out.weeks.n} complete weeks`);
console.log(`Anchor: mean of Indeed US total postings index, ${CATEGORIES.join(', ')}\n`);
console.log(`PRIMARY   ${out.primary.test}`);
console.log(`          ${f(out.primary)}`);
const pass = out.primary.r != null && out.primary.ci[0] > 0;
const verdict = pass ? 'PASS: positive, CI excludes zero'
  : out.primary.r != null && out.primary.ci[1] < 0 ? 'FAIL: the opposite sign to the hypothesis, CI excludes zero'
    : 'FAIL: no detectable relationship at this n';
console.log(`          ${verdict}\n`);
console.log('SECONDARY (reported, not claimed)');
console.log(`  overall WoW change   ${f(out.secondary.overall_change)}`);
console.log(`  demand level         ${f(out.secondary.demand_level)}`);
console.log(`  overall level        ${f(out.secondary.overall_level)}`);
