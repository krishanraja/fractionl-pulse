// Seam impact: the measured before-and-after of a proposed methodology change.
// Read-only, dependency-free, no secrets. docs/CITABILITY.md, restatement rule.
//
// WHY THIS EXISTS
// ---------------
// A change to what the published number means (dropping a source, changing how
// a pillar is averaged) is never applied to history. It gets an effective date
// and a recorded impact. This script produces that impact: it rebuilds the
// composite from stored `signals` exactly the way `calculate-fwi` does today,
// proves the rebuild matches the published `fwi_scores` row for row, then
// rebuilds it again under each proposed variant and reports the difference.
// Nothing is written anywhere; the variants exist only in this process.
//
// The baseline replica mirrors supabase/functions/calculate-fwi/index.ts:
//   - pillar = mean of every non-context signal ROW of that type that day
//     (a source with six role rows counts six times)
//   - supply rows with raw_value <= 0 are excluded; no supply -> weight
//     redistributed to demand and culture
//   - each pillar rounded to 0.1, composite = 0.5 D + 0.2 S + 0.3 C, rounded
//
// Run:  node scripts/seam-impact.mjs [--since=YYYY-MM-DD] [--json] [--series]
//       --series adds each variant's daily pillars to the JSON, for anchor checks.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const SINCE = arg('since', '2026-06-01');
const JSON_MODE = process.argv.includes('--json');

function sb() {
  const s = readFileSync(join(ROOT, 'src/lib/supabase.ts'), 'utf8');
  return { url: s.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)[1], key: s.match(/(eyJ[A-Za-z0-9._-]+)/)[1] };
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

const W = { demand: 0.5, supply: 0.2, momentum: 0.3 };
const r1 = (x) => Math.round(x * 10) / 10;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
function pearson(x, y) {
  const mx = mean(x), my = mean(y); let n = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return dx && dy ? n / Math.sqrt(dx * dy) : null;
}

// Sources whose normalized value did not move once in the trailing window.
// A reading that cannot move is not evidence (serpapi_supply_trends, 2026-09-21).
function constantSources(rows, sinceIso) {
  const seen = {};
  for (const r of rows) {
    if (r.signal_type === 'context' || r.date < sinceIso) continue;
    (seen[r.source] ||= new Set()).add(`${r.category}:${r.normalized_value}`);
  }
  return Object.entries(seen).filter(([, s]) => {
    const byCat = {};
    for (const k of s) { const [c] = k.split(':'); byCat[c] = (byCat[c] || 0) + 1; }
    return Object.values(byCat).every((n) => n === 1);
  }).map(([src]) => src).sort();
}

// variant: { exclude: Set<source>, perSource: bool, carryForward: bool }
function composite(dayRows, variant, carry) {
  const by = { demand: [], supply: [], momentum: [] };
  const perSrc = { demand: {}, supply: {}, momentum: {} };
  for (const s of dayRows) {
    if (!(s.signal_type in by)) continue;
    if (variant.exclude?.has(s.source)) continue;
    if (s.signal_type === 'supply' && (s.raw_value == null || s.raw_value <= 0)) continue;
    const v = Number(s.normalized_value) || 0;
    by[s.signal_type].push(v);
    (perSrc[s.signal_type][s.source] ||= []).push(v);
  }
  if (variant.carryForward) {
    // A source missing today contributes its own last observed per-source mean
    // (at most 7 days old), so the pillar does not jump because a source failed.
    for (const t of Object.keys(by)) {
      for (const [src, last] of Object.entries(carry[t] || {})) {
        if (perSrc[t][src] || variant.exclude?.has(src)) continue;
        if (last.age < 7) perSrc[t][src] = [last.v], by[t].push(last.v);
      }
    }
  }
  const pillar = (t) => {
    if (variant.perSource) { const m = Object.values(perSrc[t]).map(mean); return m.length ? r1(mean(m)) : null; }
    return by[t].length ? r1(mean(by[t])) : null;
  };
  const d = pillar('demand') ?? 0, c = pillar('momentum') ?? 0, s = variant.noSupply ? null : pillar('supply');
  const w = s == null ? { demand: W.demand / 0.8, supply: 0, momentum: W.momentum / 0.8 } : W;
  return { overall: r1(d * w.demand + (s ?? 0) * w.supply + c * w.momentum), d, s, c, perSrc };
}

function runSeries(days, rowsByDay, variant) {
  const out = {}; const carry = { demand: {}, supply: {}, momentum: {} };
  for (const d of days) {
    for (const t of Object.keys(carry)) for (const k of Object.keys(carry[t])) carry[t][k].age++;
    const c = composite(rowsByDay[d], variant, carry);
    for (const t of Object.keys(c.perSrc)) for (const [src, v] of Object.entries(c.perSrc[t])) carry[t][src] = { v: mean(v), age: 0 };
    out[d] = c;
  }
  return out;
}

function summarise(days, published, series) {
  const lv = days.map((d) => series[d].overall), pub = days.map((d) => published[d]);
  const diff = days.map((d, i) => lv[i] - pub[i]);
  const ch = (a) => a.slice(1).map((x, i) => x - a[i]);
  const last28 = days.slice(-28);
  return {
    n_days: days.length,
    mean_level: r1(mean(lv)),
    mean_shift_vs_published: r1(mean(diff)),
    max_abs_shift: r1(Math.max(...diff.map(Math.abs))),
    sd_daily_change: r1(sd(ch(lv))),
    sd_daily_change_last28: r1(sd(ch(last28.map((d) => series[d].overall)))),
    r_with_published: pearson(lv, pub)?.toFixed(3),
    // Chain link: the additive offset that makes the new method continuous with
    // the published level, measured over the last 28 published days and frozen
    // at the seam. linked_latest is what the latest day would publish.
    link_offset_28d: r1(mean(last28.map((d) => published[d] - series[d].overall))),
    linked_latest: r1(series[days.at(-1)].overall + mean(last28.map((d) => published[d] - series[d].overall))),
    latest: { date: days.at(-1), overall: series[days.at(-1)].overall, demand: series[days.at(-1)].d, supply: series[days.at(-1)].s, culture: series[days.at(-1)].c },
  };
}

const [signals, scores] = await Promise.all([
  restAll(`signals?select=date,source,signal_type,category,raw_value,normalized_value&date=gte.${SINCE}&order=date.asc`),
  restAll(`fwi_scores?select=date,overall_score&date=gte.${SINCE}&order=date.asc`),
]);
const rowsByDay = {};
for (const s of signals) (rowsByDay[s.date.slice(0, 10)] ||= []).push(s);
const published = Object.fromEntries(scores.map((s) => [s.date, Number(s.overall_score)]));
const days = Object.keys(published).filter((d) => rowsByDay[d]).sort();

const lastDay = days.at(-1);
// Constant over the whole window, not a recent slice: a source that moved even
// once since --since is not called constant here.
const CONSTANT = constantSources(signals, SINCE);

const baseline = runSeries(days, rowsByDay, {});
const matched = days.filter((d) => Math.abs(baseline[d].overall - published[d]) <= 0.15).length;

// The list put to Krish on 2026-10-23, frozen so the proposal reproduces
// whatever --since is used. CONSTANT above is recomputed for the window.
const PROPOSED_RETIRE = ['brave_news', 'brave_talent', 'brave_web', 'guardian', 'mediastack', 'podchaser', 'reddit', 'gofractional'];
const VARIANTS = {
  'A. drop constant inputs': { exclude: new Set(CONSTANT) },
  'B. one vote per source (mean of each source, then of sources)': { perSource: true },
  'C. carry a missing source forward up to 7 days': { carryForward: true, perSource: true },
  'A+B+C': { exclude: new Set(CONSTANT), perSource: true, carryForward: true },
  // Proposed 2026-10-23 package: the constants plus gofractional (a published
  // marketing figure behind a paid scraper), with supply either kept on its one
  // remaining moving source or suspended until a second one exists.
  'P1. A+B+C, also drop gofractional, supply on serpapi_linkedin alone': { exclude: new Set(PROPOSED_RETIRE), perSource: true, carryForward: true },
  'P2. as P1, supply pillar suspended (weight to demand and culture)': { exclude: new Set(PROPOSED_RETIRE), perSource: true, carryForward: true, noSupply: true },
};
const results = { since: SINCE, days: days.length, constant_sources_last28d: CONSTANT,
  replica: { matched_within_0_15: matched, of: days.length },
  published: summarise(days, published, Object.fromEntries(days.map((d) => [d, { overall: published[d] }]))),
  variants: {} };
const SERIES_MODE = process.argv.includes('--series');
for (const [k, v] of Object.entries(VARIANTS)) {
  const series = runSeries(days, rowsByDay, v);
  results.variants[k] = summarise(days, published, series);
  if (SERIES_MODE) results.variants[k].series = Object.fromEntries(days.map((d) => [d, { overall: series[d].overall, demand: series[d].d, supply: series[d].s, culture: series[d].c }]));
}
if (SERIES_MODE) results.baseline_series = Object.fromEntries(days.map((d) => [d, { overall: baseline[d].overall, demand: baseline[d].d, supply: baseline[d].s, culture: baseline[d].c }]));

if (JSON_MODE || SERIES_MODE) { console.log(JSON.stringify(results, null, 2)); process.exit(0); }
console.log(`SEAM IMPACT — ${days[0]} .. ${lastDay} (${days.length} published days). Nothing is written.\n`);
console.log(`Replica of calculate-fwi reproduces ${matched}/${days.length} published days within 0.15 points.`);
console.log(`${matched === days.length ? 'Baseline trusted.' : 'Days that do not reproduce were computed by an earlier method; read variant shifts as approximate.'}\n`);
console.log(`Constant since ${SINCE} (one normalized value per category): ${CONSTANT.join(', ') || 'none'}\n`);
const p = results.published;
console.log(`Published series   mean ${p.mean_level}  sd(daily change) ${p.sd_daily_change}  last 28d ${p.sd_daily_change_last28}`);
for (const [k, s] of Object.entries(results.variants)) {
  console.log(`\n${k}`);
  console.log(`  mean ${s.mean_level}  shift vs published ${s.mean_shift_vs_published >= 0 ? '+' : ''}${s.mean_shift_vs_published}  max |shift| ${s.max_abs_shift}  r with published ${s.r_with_published}`);
  console.log(`  sd(daily change) ${s.sd_daily_change}  last 28d ${s.sd_daily_change_last28}   latest ${s.latest.date}: ${s.latest.overall} (D ${s.latest.demand} S ${s.latest.supply} C ${s.latest.culture})`);
  if (s.link_offset_28d != null) console.log(`  chain-linked: offset ${s.link_offset_28d >= 0 ? '+' : ''}${s.link_offset_28d} (28-day mean gap), latest would publish ${s.linked_latest}`);
}
