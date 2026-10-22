// Candidate evaluation for sec_exec_transitions (probationary).
// Read-only, dependency-free, no secrets. docs/DATA_QUALITY_STRATEGY.md §4/§5 outcome 2.
//
// WHY THIS EXISTS
// ---------------
// The collected series is a rolling 90-day filing count, so the stored daily
// value barely moves (CV ~2%, normalised value 48-52) and says nothing about
// whether the candidate carries information. SEC full-text search is keyless
// and has history, so this pulls the filings per calendar week directly
// (Monday-Sunday, one row per independent week) and joins them to the FWI's
// weekly mean for the daily era.
//
// PRE-REGISTERED primary test, fixed before the data was read: total weekly
// filings (both terms) vs the DEMAND pillar, levels, lag 0. Everything else
// printed is exploratory; the count of cells is printed so a lone hit can be
// judged against chance.
//
// Run:  node scripts/evaluate-sec-candidate.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const START = '2026-06-01'; // Monday; daily era
const TERMS = ['interim chief financial officer', 'interim chief executive officer'];
const UA = 'FWI-Pulse/1.0 data@fractionl.ai';

const src = readFileSync(join(ROOT, 'src/lib/supabase.ts'), 'utf8');
const SB = {
  url: src.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)[1],
  key: src.match(/(eyJ[A-Za-z0-9._-]+)/)[1],
};
const sb = async (path) => {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const res = await fetch(`${SB.url}/rest/v1/${path}&limit=1000&offset=${off}`,
      { headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}` } });
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) return out;
  }
};

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => Math.sqrt(mean(a.map((x) => (x - mean(a)) ** 2)));
const pearson = (a, b) => {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db);
};
const ci = (r, n) => {
  const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3);
  return `[${Math.tanh(z - 1.96 * se).toFixed(2)}, ${Math.tanh(z + 1.96 * se).toFixed(2)}]`;
};
const diff = (a) => a.slice(1).map((x, i) => x - a[i]);
const addDays = (d, n) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);
const row = (label, X, Y) => {
  const r = pearson(X, Y);
  console.log(`  ${label.padEnd(34)} n=${String(X.length).padEnd(3)} r=${r.toFixed(2).padStart(5)}  95% CI ${ci(r, X.length)}`);
  return { r, n: X.length };
};

const today = new Date().toISOString().slice(0, 10);
const fwi = await sb(`fwi_scores?select=date,overall_score,demand_score,supply_score,momentum_score&date=gte.${START}&order=date.asc`);
const stored = await sb('signals?select=date,raw_value,normalized_value&source=eq.sec_exec_transitions&order=date.asc');

const weeks = [];
for (let s = START; addDays(s, 6) < today; s = addDays(s, 7)) {
  const e = addDays(s, 6);
  let total = 0;
  for (const t of TERMS) {
    const u = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${t}"`)}&forms=8-K&dateRange=custom&startdt=${s}&enddt=${e}`;
    const res = await fetch(u, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`SEC FTS HTTP ${res.status}`);
    total += Number((await res.json()).hits.total.value);
    await new Promise((r) => setTimeout(r, 1200)); // SEC rate limit
  }
  const rows = fwi.filter((f) => f.date >= s && f.date <= e);
  if (rows.length < 5) continue; // incomplete week
  const m = (k) => mean(rows.map((x) => x[k]));
  weeks.push({ s, total, overall: m('overall_score'), demand: m('demand_score'), supply: m('supply_score'), culture: m('momentum_score') });
}

const tot = weeks.map((w) => w.total);
console.log(`SEC weekly filings, ${weeks[0].s} to ${weeks.at(-1).s}: n=${weeks.length} weeks`);
console.log(`  mean ${mean(tot).toFixed(1)}  sd ${sd(tot).toFixed(1)}  min ${Math.min(...tot)}  max ${Math.max(...tot)}  CV ${(sd(tot) / mean(tot) * 100).toFixed(0)}%`);
const nv = stored.map((s) => s.normalized_value), rv = stored.map((s) => s.raw_value);
console.log(`Stored series (rolling 90d): ${stored.length} rows ${stored[0]?.date}..${stored.at(-1)?.date}, raw ${Math.min(...rv)}-${Math.max(...rv)} CV ${(sd(rv) / mean(rv) * 100).toFixed(1)}%, normalised ${Math.min(...nv)}-${Math.max(...nv)}\n`);

console.log('PRE-REGISTERED PRIMARY (filings vs demand pillar, levels, lag 0)');
const primary = row('filings vs demand', tot, weeks.map((w) => w.demand));
const loo = tot.map((_, k) => pearson(tot.filter((_, i) => i !== k), weeks.map((w) => w.demand).filter((_, i) => i !== k)));
console.log(`  leave-one-week-out range ${Math.min(...loo).toFixed(2)} to ${Math.max(...loo).toFixed(2)}\n`);

console.log('EXPLORATORY (not claimed)');
let cells = 0;
for (const f of ['overall', 'demand', 'supply', 'culture']) {
  const y = weeks.map((w) => w[f]);
  for (const lag of [0, 1, 2]) { row(`${f} levels, filings lead ${lag}w`, tot.slice(0, tot.length - lag), y.slice(lag)); cells++; }
  row(`${f} week-on-week change, lag 0`, diff(tot), diff(y)); cells++;
}
console.log(`\n${cells} cells; about ${(cells * 0.05).toFixed(1)} would exclude zero by chance alone.`);
console.log(`Primary excludes zero: ${ci(primary.r, primary.n).slice(1, -1).split(', ').map(Number).every((x) => x > 0) ? 'yes' : 'no'}`);
