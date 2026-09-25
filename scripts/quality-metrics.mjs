// Information content of the FWI's inputs. Read-only, dependency-free, no secrets.
//
// WHY THIS EXISTS
// ---------------
// docs/DATA_QUALITY_STRATEGY.md §2 and §3. Pulse describes its evidence base
// with a count — "20 tracked inputs" — and a count says nothing about how much
// information is in it. Four news APIs that move together are one signal with
// four names, and the weight table cannot tell you which case you are in.
//
// serpapi_supply_trends is why this exists rather than being a nice idea. It was
// never a broken collector: it ran, reported success, and measured a
// search-volume floor with no variance for months, moving the headline by -1.08
// on half of all days. Nothing that counts sources can catch that. Something
// that measures each source's contribution catches it in week one.
//
// Two numbers come out:
//
//   EFFECTIVE INPUTS — the participation ratio of the correlation matrix's
//   eigenvalues, (Σλ)² / Σλ². Twenty independent inputs give 20; twenty
//   identical inputs give 1. This is the honest version of "20 tracked inputs",
//   and publishing it is a stronger credibility move than the count is, because
//   it is the kind of number a competitor will not volunteer about themselves.
//
//   SCORE DISPERSION — a bootstrap over which sources happened to arrive. A day
//   at 0.90 completeness where the present sources agree and one where they
//   disagree are different days, and completeness alone reports them
//   identically. This says how much the answer would have moved on a different
//   draw of the same day's sources.
//
// Both are pure arithmetic over rows already in the table: no provider, no cost,
// no new collection. Run weekly by the Thursday ratchet session.
//
// Run:  node scripts/quality-metrics.mjs             (human report)
//       node scripts/quality-metrics.mjs --json      (machine report)
//       node scripts/quality-metrics.mjs --since=YYYY-MM-DD
//
// Exit: 0 always unless the script itself could not run (2). This measures; it
// does not judge. The judging is §5 of the strategy and it needs a person.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const JSON_MODE = process.argv.includes('--json');

// The daily era. Before 2026-06-01 the history is a weekly/biweekly backfill,
// and correlating a daily series against a weekly one measures the sampling
// difference rather than the sources. Never widen this without saying so.
const DAILY_ERA_START = '2026-06-01';
const SINCE = (process.argv.find((a) => a.startsWith('--since=')) || '').split('=')[1] || DAILY_ERA_START;

// Redundancy threshold from the strategy's floor rule (§5).
const REDUNDANT_AT = 0.8;
const BOOTSTRAP_DRAWS = 500;

const PILLAR_WEIGHTS = { demand: 0.5, supply: 0.2, culture: 0.3 };
// calculate-fwi stores the culture pillar under the signal_type 'momentum'.
const TYPE_TO_PILLAR = { demand: 'demand', supply: 'supply', momentum: 'culture' };

function supabaseConfig() {
  const src = read('src/lib/supabase.ts');
  const url = src.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/);
  const key = src.match(/(eyJ[A-Za-z0-9._-]+)/);
  if (!url || !key) throw new Error('Could not read Supabase URL/anon key from src/lib/supabase.ts');
  // Taken as a pair, for the reason documented in scripts/pipeline-audit.mjs.
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

// ---------------------------------------------------------------- correlation

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Pairwise-complete Pearson. Sources come online at different dates and miss
// different days, so restricting to rows complete across all sources would throw
// away most of the history and bias toward the oldest sources.
function pearson(a, b) {
  const pairs = [];
  for (const d of Object.keys(a)) if (b[d] !== undefined) pairs.push([a[d], b[d]]);
  if (pairs.length < 10) return { r: null, n: pairs.length };
  const xs = pairs.map((p) => p[0]), ys = pairs.map((p) => p[1]);
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a1 = xs[i] - mx, b1 = ys[i] - my;
    num += a1 * b1; dx += a1 * a1; dy += b1 * b1;
  }
  if (dx === 0 || dy === 0) return { r: null, n: pairs.length, degenerate: true };
  return { r: num / Math.sqrt(dx * dy), n: pairs.length };
}

// Jacobi eigenvalue iteration for a real symmetric matrix. Implemented here
// rather than pulled from a library so this script stays dependency-free and can
// run in CI with no install step — the same reason pipeline-audit.mjs is.
function eigenvalues(M) {
  const n = M.length;
  const A = M.map((row) => row.slice());
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-12) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-14) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
      }
    }
  }
  return A.map((row, i) => row[i]).sort((a, b) => b - a);
}

// ----------------------------------------------------------- marginal contribution

// Weighted composite from a {pillar: [values]} map — the same arithmetic
// calculate-fwi applies, with no resampling. Used both for "the composite as
// actually observed" and for "the composite with one source's rows removed".
function compositeOf(byPillar) {
  let composite = 0, weightUsed = 0;
  for (const [pillar, weight] of Object.entries(PILLAR_WEIGHTS)) {
    const vals = byPillar[pillar];
    if (!vals || vals.length === 0) continue;
    composite += (mean(vals)) * weight;
    weightUsed += weight;
  }
  return weightUsed > 0 ? composite / weightUsed : null;
}

// docs/DATA_QUALITY_STRATEGY.md §5, the floor rule: an input whose removal
// "changes the composite by less than the published error band" is not
// evidence, it is decoration with a running cost. §2 (redundancy) and §3
// (the band) were both built; nothing computed the one number the rule
// actually tests against. This is that number: for every day a source
// contributed, recompute the composite with that source's rows pulled out of
// its pillar, and average the swing. A source whose mean swing sits under the
// band moves the number less than resampling noise already does.
function marginalContribution(daySourcePillar, sources) {
  const bySource = {};
  for (const s of sources) bySource[s] = { deltas: [], days: 0 };

  for (const pillars of Object.values(daySourcePillar)) {
    const all = {};
    for (const [pillar, entries] of Object.entries(pillars)) all[pillar] = entries.map((e) => e.v);
    const withAll = compositeOf(all);
    if (withAll == null) continue;

    const touchedBySource = new Map();
    for (const [pillar, entries] of Object.entries(pillars)) {
      for (const e of entries) {
        if (!bySource[e.source]) continue;
        (touchedBySource.get(e.source) ?? touchedBySource.set(e.source, new Set()).get(e.source)).add(pillar);
      }
    }

    for (const [source, pillarsTouched] of touchedBySource) {
      const without = {};
      for (const [pillar, entries] of Object.entries(pillars)) {
        without[pillar] = pillarsTouched.has(pillar)
          ? entries.filter((e) => e.source !== source).map((e) => e.v)
          : entries.map((e) => e.v);
      }
      const withoutSource = compositeOf(without);
      if (withoutSource == null) continue;
      bySource[source].deltas.push(withAll - withoutSource);
      bySource[source].days += 1;
    }
  }

  return sources.map((s) => {
    const { deltas, days } = bySource[s];
    const meanAbsDelta = deltas.length ? mean(deltas.map(Math.abs)) : null;
    return { source: s, days, meanAbsDelta };
  });
}

// ------------------------------------------------------------------ bootstrap

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Resample WHICH SOURCES ARRIVED, with replacement, within each pillar, and
// recompute the composite. This asks the reader's real question — how much does
// the score depend on the particular draw of sources that showed up — which
// completeness cannot answer. Seeded so the same day always reports the same
// band; an error bar that moves when nothing moved is worse than none.
function bootstrapDay(byPillar, seed) {
  const rand = mulberry32(seed);
  const draws = [];
  for (let i = 0; i < BOOTSTRAP_DRAWS; i++) {
    let composite = 0, weightUsed = 0;
    for (const [pillar, weight] of Object.entries(PILLAR_WEIGHTS)) {
      const vals = byPillar[pillar];
      if (!vals || vals.length === 0) continue;
      let sum = 0;
      for (let k = 0; k < vals.length; k++) sum += vals[Math.floor(rand() * vals.length)];
      composite += (sum / vals.length) * weight;
      weightUsed += weight;
    }
    if (weightUsed > 0) draws.push(composite / weightUsed);
  }
  if (draws.length === 0) return null;
  draws.sort((a, b) => a - b);
  const at = (q) => draws[Math.min(draws.length - 1, Math.floor(q * draws.length))];
  return { p05: at(0.05), p25: at(0.25), median: at(0.5), p75: at(0.75), p95: at(0.95) };
}

// ----------------------------------------------------------------------- main

async function run() {
  const weightsSrc = read('supabase/functions/ingest-signals/index.ts');
  const block = weightsSrc.match(/SOURCE_CONFIDENCE_WEIGHTS[^=]*=\s*\{([\s\S]*?)\n\};/);
  const weights = {};
  for (const [, k, v] of block[1].matchAll(/^\s*([a-z0-9_]+)\s*:\s*([0-9.]+)/gim)) weights[k] = Number(v);

  const rows = await restAll(
    `signals?select=date,source,signal_type,normalized_value,raw_value&date=gte.${SINCE}&order=date.asc`,
  );

  // One series per source per day: the mean of its normalized values that day,
  // so a source emitting six role rows does not outvote one emitting a single
  // aggregate. Context signals are excluded — they are not in the composite.
  const series = {}, pillarOf = {};
  const dayPillar = {}, daySourcePillar = {};
  for (const r of rows) {
    const pillar = TYPE_TO_PILLAR[r.signal_type];
    if (!pillar) continue;
    if (pillar === 'supply' && (r.raw_value == null || r.raw_value <= 0)) continue;
    const v = Number(r.normalized_value);
    if (!Number.isFinite(v)) continue;
    const d = r.date.slice(0, 10);
    (series[r.source] ||= {});
    (series[r.source][d] ||= []).push(v);
    pillarOf[r.source] = pillar;
    ((dayPillar[d] ||= {})[pillar] ||= []).push(v);
    (((daySourcePillar[d] ||= {})[pillar] ||= [])).push({ source: r.source, v });
  }
  for (const src of Object.keys(series)) {
    for (const d of Object.keys(series[src])) series[src][d] = mean(series[src][d]);
  }

  // Only sources the index currently intends to collect, with enough overlap to
  // correlate. A retired source still has rows in the window and must not be
  // counted as part of today's evidence base.
  const sources = Object.keys(series)
    .filter((s) => weights[s] !== undefined)
    .filter((s) => Object.keys(series[s]).length >= 10)
    .sort();

  const n = sources.length;
  const R = Array.from({ length: n }, () => new Array(n).fill(0));
  const pairs = [];
  for (let i = 0; i < n; i++) {
    R[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const { r, n: overlap } = pearson(series[sources[i]], series[sources[j]]);
      const val = r == null ? 0 : r;
      R[i][j] = R[j][i] = val;
      if (r != null) pairs.push({ a: sources[i], b: sources[j], r, n: overlap });
    }
  }

  const lambdas = eigenvalues(R);
  const sum = lambdas.reduce((a, b) => a + b, 0);
  const sumSq = lambdas.reduce((a, b) => a + b * b, 0);
  const effective = (sum * sum) / sumSq;

  const redundant = pairs
    .filter((p) => Math.abs(p.r) >= REDUNDANT_AT)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  // Mean |r| against every other input: a source's overall redundancy.
  const redundancyOf = sources.map((s) => {
    const rs = pairs.filter((p) => p.a === s || p.b === s).map((p) => Math.abs(p.r));
    return { source: s, weight: weights[s], pillar: pillarOf[s] || 'unknown',
             meanAbsR: rs.length ? mean(rs) : null, days: Object.keys(series[s]).length };
  }).sort((a, b) => (b.meanAbsR ?? -1) - (a.meanAbsR ?? -1));

  const days = Object.keys(dayPillar).sort();
  const recent = days.slice(-28);
  const bands = recent.map((d, i) => {
    const b = bootstrapDay(dayPillar[d], 20260921 + i);
    return b && { date: d, ...b, iqr: b.p75 - b.p25, span90: b.p95 - b.p05 };
  }).filter(Boolean);
  const band = bands.length ? mean(bands.map((b) => b.iqr)) : null;

  const marginal = marginalContribution(daySourcePillar, sources)
    .map((m) => ({ ...m, meanAbsDelta: m.meanAbsDelta == null ? null : Math.round(m.meanAbsDelta * 1000) / 1000,
                   belowFloor: band != null && m.meanAbsDelta != null ? m.meanAbsDelta < band : null }))
    .sort((a, b) => (a.meanAbsDelta ?? Infinity) - (b.meanAbsDelta ?? Infinity));

  return {
    window: { since: SINCE, days: days.length, sources: n },
    effectiveInputs: effective,
    trackedInputs: Object.keys(weights).length,
    eigenvalues: lambdas.map((l) => Math.round(l * 1000) / 1000),
    redundantPairs: redundant.map((p) => ({ ...p, r: Math.round(p.r * 1000) / 1000 })),
    redundancy: redundancyOf.map((r) => ({ ...r, meanAbsR: r.meanAbsR == null ? null : Math.round(r.meanAbsR * 1000) / 1000 })),
    dispersion: bands.map((b) => ({
      date: b.date,
      median: Math.round(b.median * 10) / 10,
      iqr: Math.round(b.iqr * 10) / 10,
      span90: Math.round(b.span90 * 10) / 10,
    })),
    band: band == null ? null : Math.round(band * 100) / 100,
    marginalContribution: marginal,
  };
}

function report(x) {
  const out = [];
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  out.push(`INPUT INFORMATION — ${x.window.since} to today · ${x.window.days} days · ${x.window.sources} sources with enough history`);
  out.push('');
  out.push(`Effective inputs   ${x.effectiveInputs.toFixed(1)} of ${x.trackedInputs} tracked (${pct(x.effectiveInputs / x.trackedInputs)} of the count)`);
  out.push(`                   The honest version of "${x.trackedInputs} tracked inputs".`);
  out.push('');

  if (x.redundantPairs.length) {
    out.push(`REDUNDANT PAIRS (|r| >= ${REDUNDANT_AT}) — one signal wearing two names`);
    for (const p of x.redundantPairs.slice(0, 12)) {
      out.push(`  ${p.r >= 0 ? ' ' : ''}${p.r.toFixed(2)}  ${p.a} ~ ${p.b}  (n=${p.n})`);
    }
    if (x.redundantPairs.length > 12) out.push(`  ... and ${x.redundantPairs.length - 12} more`);
  } else {
    out.push(`No pair of inputs correlates at |r| >= ${REDUNDANT_AT}.`);
  }
  out.push('');

  out.push('MOST REDUNDANT INPUTS — mean |r| against every other input');
  for (const r of x.redundancy.slice(0, 8)) {
    out.push(`  ${r.meanAbsR == null ? ' n/a' : r.meanAbsR.toFixed(2)}  ${r.source.padEnd(22)} weight ${r.weight}  ${r.pillar}  (${r.days}d)`);
  }
  out.push('');

  if (x.dispersion.length) {
    const last = x.dispersion[x.dispersion.length - 1];
    const avgIqr = x.dispersion.reduce((a, b) => a + b.iqr, 0) / x.dispersion.length;
    const widest = x.dispersion.reduce((a, b) => (b.span90 > a.span90 ? b : a));
    out.push('SCORE DISPERSION — bootstrap over which sources arrived, 500 draws/day');
    out.push(`  Latest ${last.date}   median ${last.median}  IQR ±${(last.iqr / 2).toFixed(1)}  90% span ${last.span90}`);
    out.push(`  Last ${x.dispersion.length} days      mean IQR ${avgIqr.toFixed(1)} points`);
    out.push(`  Widest day          ${widest.date}  90% span ${widest.span90} points`);
    out.push('  A day where the sources agree and a day where they disagree can have the');
    out.push('  same completeness. This is the difference completeness cannot report.');
  }
  out.push('');

  if (x.marginalContribution.length && x.band != null) {
    out.push(`MARGINAL CONTRIBUTION — leave-one-out swing vs the ${x.band.toFixed(2)}pt band (§5 floor rule)`);
    out.push('  Mean |Δ composite| on days the source contributed, if it were dropped that day.');
    for (const m of x.marginalContribution) {
      const flag = m.belowFloor ? '  BELOW FLOOR' : '';
      out.push(`  ${m.meanAbsDelta == null ? ' n/a' : m.meanAbsDelta.toFixed(3).padStart(6)}  ${m.source.padEnd(22)} (${m.days}d)${flag}`);
    }
    out.push('  Below floor once is not a retirement case — §5 requires four consecutive');
    out.push('  weekly reads below the band before a source is proposed for retirement.');
  }
  return out.join('\n');
}

try {
  const result = await run();
  console.log(JSON_MODE ? JSON.stringify(result, null, 2) : report(result));
} catch (err) {
  console.error(`Quality metrics could not run: ${err.message}`);
  process.exit(2);
}
