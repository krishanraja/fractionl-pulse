// The trial lane's gate (docs/CITABILITY.md, "Rebuild plan"). Read-only.
//
// For every trial input collected by supabase/functions/collect-trials it
// checks the six-point entry gate and measures what promoting it would do,
// using the same method module the pipeline runs (supabase/functions/_shared/
// fwi-method.ts), so the impact printed is the impact a ruling would have.
//
//   1 dated provenance   >= 28 days stored (live or backfilled from a dated archive)
//   2 it moves           every category moved in the last 28 days, none at a cap
//   3 adds information   |r| < 0.8 against every current v2 input, on 7-day
//                        changes (Ruling, Krish, 2026-10-23: levels conflate
//                        two series that merely trend together); the level r
//                        is still printed as information
//   4 not an anchor      by construction: no held-out series is a trial
//   5 impact measured    v2 over the last 28 days with and without it
//   6 Krish rules        always open here; this script only prepares the case
//
// Run:  node scripts/trial-evaluate.mjs [--json]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { V2_SOURCES, addDays, compositeFromVotes, dailySourceValue, votesFor, officialScore, yoy } from '../supabase/functions/_shared/fwi-method.ts';
import { RELEASE_DAY, fetchOfficialSupply } from '../supabase/functions/_shared/official-supply.ts';
import { TRIALS } from '../supabase/functions/_shared/trials.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
function pearson(a, b) {
  const ds = Object.keys(a).filter((d) => d in b);
  if (ds.length < 10) return { r: null, n: ds.length };
  const x = ds.map((d) => a[d]), y = ds.map((d) => b[d]);
  const mx = mean(x), my = mean(y); let nu = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { nu += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return dx && dy ? { r: nu / Math.sqrt(dx * dy), n: ds.length } : { r: null, n: ds.length, constant: true };
}

const latest = (await restAll('fwi_scores?select=date&order=date.desc'))[0].date;
const since = addDays(latest, -70);
const signals = await restAll(`signals?select=date,source,signal_type,category,raw_value,normalized_value,metadata&date=gte.${since}`);
const trialRows = signals.filter((r) => r.source.startsWith('trial_'));
const prodRows = signals.filter((r) => !r.source.startsWith('trial_'));

// Official supply as known on each day, so the impact uses the real v2 supply pillar.
let officialNote = 'official supply series included';
const official = [];
try {
  const off = await fetchOfficialSupply(); const bls = yoy(off.bls_incorporated);
  for (let d = since; d <= latest; d = addDays(d, 1)) {
    const c = officialScore(off.census_bfs_pbs, d, RELEASE_DAY.census_bfs_pbs);
    if (c) official.push({ date: d, source: 'census_bfs_pbs', category: 'naics54_applications', raw_value: c.value, normalized_value: c.score });
    const b = officialScore(bls, d, RELEASE_DAY.bls_incorporated);
    if (b) official.push({ date: d, source: 'bls_incorporated', category: 'incorporated_self_employed_yoy', raw_value: b.value, normalized_value: b.score });
  }
} catch (e) { officialNote = `official supply unavailable from this address (${e.message}); impact computed without it`; }
const baseRows = [...prodRows, ...official];

// Daily per-source values for the information check.
const byDay = {};
for (const r of [...baseRows, ...trialRows]) (byDay[r.date] ||= []).push(r);
const window28 = Array.from({ length: 28 }, (_, i) => addDays(latest, -27 + i));

function seriesOf(source, extraSources = {}) {
  const saved = { ...V2_SOURCES }; Object.assign(V2_SOURCES, extraSources);
  const out = {};
  for (const [d, rows] of Object.entries(byDay)) { const v = dailySourceValue(rows)[source]; if (v !== undefined) out[d] = v; }
  for (const k of Object.keys(V2_SOURCES)) if (!(k in saved)) delete V2_SOURCES[k];
  Object.assign(V2_SOURCES, saved);
  return out;
}

function v2Series(rows, mutate) {
  const saved = { ...V2_SOURCES };
  mutate(V2_SOURCES);
  const out = window28.map((d) => compositeFromVotes(votesFor(d, rows)).raw);
  for (const k of Object.keys(V2_SOURCES)) delete V2_SOURCES[k];
  Object.assign(V2_SOURCES, saved);
  return out;
}
const ch = (a) => a.slice(1).map((x, i) => x - a[i]);
const baseline = v2Series(baseRows, () => {});

const results = [];
for (const t of TRIALS) {
  const rows = trialRows.filter((r) => r.source === t.source);
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const live = new Set(rows.filter((r) => !r.metadata?.backfilled).map((r) => r.date)).size;
  const recent = rows.filter((r) => r.date >= window28[0]);
  const cats = {};
  for (const r of recent) (cats[r.category] ||= new Set()).add(String(r.normalized_value));
  const frozen = Object.entries(cats).filter(([, v]) => v.size <= 1).map(([c]) => c);
  const atCap = recent.filter((r) => r.metadata?.at_cap).length;

  const mine = seriesOf(t.source, { [t.source]: t.pillar });
  let worst = { r: 0, n: 0, against: null };
  for (const src of Object.keys(V2_SOURCES)) {
    if (src === t.replaces) continue;
    const { r, n } = pearson(mine, seriesOf(src));
    if (r != null && Math.abs(r) > Math.abs(worst.r)) worst = { r, n, against: src };
  }

  // The gate's check 3 (Ruling, Krish, 2026-10-23): the comparison on 7-day
  // changes. Two series that both trend over the window correlate in levels
  // without sharing information; changes remove the shared trend.
  const weekly = (ser) => Object.fromEntries(Object.keys(ser).filter((d) => ser[addDays(d, -7)] !== undefined).map((d) => [d, ser[d] - ser[addDays(d, -7)]]));
  let worstChange = { r: 0, n: 0, against: null };
  for (const src of Object.keys(V2_SOURCES)) {
    if (src === t.replaces) continue;
    const { r, n } = pearson(weekly(mine), weekly(seriesOf(src)));
    if (r != null && Math.abs(r) > Math.abs(worstChange.r)) worstChange = { r, n, against: src };
  }

  let impact = null;
  if (dates.length) {
    const withIt = v2Series([...baseRows, ...trialRows], (S) => { S[t.source] = t.pillar; if (t.replaces) delete S[t.replaces]; });
    const diff = withIt.map((x, i) => x - baseline[i]);
    impact = {
      mean_shift: Math.round(mean(diff) * 10) / 10,
      max_abs_shift: Math.round(Math.max(...diff.map(Math.abs)) * 10) / 10,
      sd_daily_change_before: Math.round(sd(ch(baseline)) * 10) / 10,
      sd_daily_change_after: Math.round(sd(ch(withIt)) * 10) / 10,
    };
  }

  const gate = {
    '1 dated provenance': dates.length >= 28,
    '2 it moves': recent.length > 0 && frozen.length === 0 && atCap === 0,
    '3 adds information': worstChange.against == null ? null : Math.abs(worstChange.r) < 0.8,
    '4 not an anchor': true,
    '5 impact measured': impact != null,
    '6 Krish rules': null,
  };
  results.push({ source: t.source, pillar: t.pillar, replaces: t.replaces ?? null, what: t.what,
    days: dates.length, live_days: live, first: dates[0] ?? null, last: dates.at(-1) ?? null,
    frozen_categories: frozen, at_cap_rows: atCap,
    max_r: worst.against ? { r: Math.round(worst.r * 100) / 100, n: worst.n, against: worst.against } : null,
    max_r_weekly_change: worstChange.against ? { r: Math.round(worstChange.r * 100) / 100, n: worstChange.n, against: worstChange.against } : null,
    impact, gate, ready_for_ruling: Object.entries(gate).filter(([k]) => !k.startsWith('6')).every(([, v]) => v === true) });
}

if (JSON_MODE) { console.log(JSON.stringify({ as_of: latest, note: officialNote, results }, null, 2)); process.exit(0); }
console.log(`TRIAL LANE — gate as of ${latest}. Read-only; nothing here changes the index.\n${officialNote}\n`);
const mark = (v) => (v === true ? 'pass' : v === false ? 'FAIL' : 'open');
for (const r of results) {
  console.log(`${r.source}  (${r.pillar}${r.replaces ? `, would replace ${r.replaces}` : ', would be added'})`);
  console.log(`  ${r.what}`);
  console.log(`  days ${r.days} (${r.live_days} collected live)${r.first ? `, ${r.first} .. ${r.last}` : ''}`);
  console.log(`  gate: ${Object.entries(r.gate).map(([k, v]) => `${k} ${mark(v)}`).join(' · ')}`);
  if (r.frozen_categories.length || r.at_cap_rows) console.log(`  frozen: ${r.frozen_categories.join(', ') || 'none'}; rows at cap: ${r.at_cap_rows}`);
  if (r.max_r_weekly_change) console.log(`  highest |r| on 7-day changes (check 3): ${r.max_r_weekly_change.r} vs ${r.max_r_weekly_change.against} (n = ${r.max_r_weekly_change.n})`);
  if (r.max_r) console.log(`  same on levels (information): ${r.max_r.r} vs ${r.max_r.against} (n = ${r.max_r.n})`);
  if (r.impact) console.log(`  impact over the last 28 days: mean shift ${r.impact.mean_shift >= 0 ? '+' : ''}${r.impact.mean_shift}, max ${r.impact.max_abs_shift}; sd of daily change ${r.impact.sd_daily_change_before} -> ${r.impact.sd_daily_change_after}`);
  console.log(`  ${r.ready_for_ruling ? 'READY for a ruling' : 'not ready'}\n`);
}
