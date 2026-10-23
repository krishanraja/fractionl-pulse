// Preview of the 2026-10-26 seam (FWI method v2) on production data. Read-only.
// Uses the same module calculate-fwi runs (supabase/functions/_shared/fwi-method.ts),
// so what this prints is what the pipeline would publish, not an approximation.
//
// For each of the 28 published days ending --through (default: latest), it
// rebuilds v2 from stored signals plus the two official supply series as known
// on that day, measures the chain-link offset, and prints the linked reading,
// its band, and how the v2 series moves day to day against the published one.
//
// Run:  node scripts/seam-v2-preview.mjs [--through=YYYY-MM-DD] [--exclude=source,...] [--add=trial:pillar,...] [--json]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  LINK_WINDOW_DAYS, V2_SOURCES, addDays, band, compositeFromVotes, linkOffset, officialScore, votesFor, yoy,
} from '../supabase/functions/_shared/fwi-method.ts';
import { RELEASE_DAY, fetchOfficialSupply } from '../supabase/functions/_shared/official-supply.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const JSON_MODE = process.argv.includes('--json');
// --exclude=a,b measures a proposed further retirement without editing the method.
for (const src of (arg('exclude') || '').split(',').filter(Boolean)) delete V2_SOURCES[src];
// --add=trial_source:pillar,...  measures adding a trial (its stored candidate
// rows are read like any other source's) without editing the method.
for (const pair of (arg('add') || '').split(',').filter(Boolean)) { const [src, pillar] = pair.split(':'); V2_SOURCES[src] = pillar; }
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

const scores = await restAll('fwi_scores?select=date,overall_score&order=date.desc');
const through = arg('through') || scores[0].date;
const window = scores.filter((r) => r.date <= through).slice(0, LINK_WINDOW_DAYS).map((r) => r.date).sort();
const published = Object.fromEntries(scores.filter((r) => window.includes(r.date)).map((r) => [r.date, Number(r.overall_score)]));
const signals = await restAll(`signals?select=date,source,category,signal_type,raw_value,normalized_value&date=gte.${addDays(window[0], -14)}&date=lte.${through}`);
const official = await fetchOfficialSupply();
const blsYoy = yoy(official.bls_incorporated);

function officialRows(date) {
  const out = [];
  const c = officialScore(official.census_bfs_pbs, date, RELEASE_DAY.census_bfs_pbs);
  if (c) out.push({ date, source: 'census_bfs_pbs', category: 'naics54_applications', raw_value: c.value, normalized_value: c.score, meta: c });
  const b = officialScore(blsYoy, date, RELEASE_DAY.bls_incorporated);
  if (b) out.push({ date, source: 'bls_incorporated', category: 'incorporated_self_employed_yoy', raw_value: b.value, normalized_value: b.score, meta: b });
  return out;
}

const rows = [...signals];
for (let d = addDays(window[0], -14); d <= through; d = addDays(d, 1)) rows.push(...officialRows(d));

const v2 = {};
for (const d of window) {
  const votes = votesFor(d, rows);
  v2[d] = { votes, ...compositeFromVotes(votes) };
}
const v2raw = Object.fromEntries(window.map((d) => [d, v2[d].raw]));
const { offset, n } = linkOffset(published, v2raw);
const last = window.at(-1);
const linked = v2[last].raw + offset;
const b = band(v2[last].votes, offset, last);
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
const ch = (a) => a.slice(1).map((x, i) => x - a[i]);
const result = {
  window: { first: window[0], last, n },
  link_offset: offset,
  latest: { date: last, published: published[last], v2_raw: v2[last].raw, v2_linked: Math.round(linked * 10) / 10, publishes_as: Math.round(linked), band: b, pillars: v2[last].pillars, weights: v2[last].weights },
  official: officialRows(last).map((r) => ({ source: r.source, period: r.meta.period, value: r.meta.value, z: r.meta.z, score: r.meta.score })),
  votes_latest: v2[last].votes.map((v) => ({ source: v.source, pillar: v.pillar, value: Math.round(v.value * 10) / 10, asOf: v.asOf, carried: v.carried })),
  sd_daily_change: { published: Math.round(sd(ch(window.map((d) => published[d]))) * 10) / 10, v2_linked: Math.round(sd(ch(window.map((d) => v2raw[d]))) * 10) / 10 },
  daily: window.map((d) => ({ date: d, published: published[d], v2_linked: Math.round((v2raw[d] + offset) * 10) / 10 })),
};
if (JSON_MODE) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }
console.log(`SEAM PREVIEW, FWI v2 — link window ${window[0]} .. ${last} (n = ${n} published days). Nothing is written.\n`);
console.log(`Chain-link offset          ${offset >= 0 ? '+' : ''}${offset}`);
console.log(`Latest ${last}          published ${published[last]}  ->  v2 raw ${v2[last].raw}, linked ${result.latest.v2_linked}, publishes as ${result.latest.publishes_as} (${b.low} to ${b.high})`);
console.log(`Pillars (v2, unlinked)     demand ${v2[last].pillars.demand}  supply ${v2[last].pillars.supply}  culture ${v2[last].pillars.culture}`);
console.log(`sd of daily change         published ${result.sd_daily_change.published}  v2 ${result.sd_daily_change.v2_linked}`);
console.log('\nOfficial supply as known on the latest day');
for (const o of result.official) console.log(`  ${o.source.padEnd(18)} period ${o.period}  value ${Math.round(o.value * 100) / 100}  z ${o.z}  score ${o.score}`);
console.log('\nVotes on the latest day');
for (const v of result.votes_latest) console.log(`  ${v.pillar.padEnd(8)} ${v.source.padEnd(20)} ${String(v.value).padStart(5)}  ${v.carried ? `carried from ${v.asOf}` : 'today'}`);
