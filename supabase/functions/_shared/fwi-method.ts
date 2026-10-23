// FWI method v2, effective 2026-10-26. Pure functions, no I/O, so the same
// arithmetic runs in calculate-fwi, in node:test and in scripts/seam-impact.mjs.
//
// Rulings (Krish, 2026-10-23), docs/CITABILITY.md "Rulings":
//   1. Nine inputs that never moved leave the composite (RETIRED_AT_V2).
//   2. One vote per source; a missing source holds its last vote up to 7 days.
//   3. Supply = two official monthly series + the LinkedIn proxy on a 14-day median.
//   4. Chain-linked at the seam with a fixed additive offset measured over the
//      28 published days before it; every surface shows a whole number + band.
// Days before METHOD_V2_EFFECTIVE are never recomputed with this method.

export const METHOD_V2_EFFECTIVE = '2026-10-26';
export const METHOD_V2_ID = 'fwi-v2-2026-10-26';

export const PILLAR_WEIGHTS = { demand: 0.5, supply: 0.2, culture: 0.3 } as const;
export type Pillar = keyof typeof PILLAR_WEIGHTS;

// serpapi_trends joined the list later the same day: the audit gate added in
// this change found its normalized vote fixed at the normalizer floor of 5 since
// 2026-08-14 (raw 2.6 to 5.3). Ruling (Krish, 2026-10-23): retire it at the same seam.
export const RETIRED_AT_V2 = [
  'brave_news', 'brave_web', 'reddit', 'brave_talent',
  'guardian', 'mediastack', 'podchaser', 'gofractional', 'serpapi_trends',
] as const;

// The composite inputs from the seam, and the pillar each one votes in. A source
// not listed here never enters the composite, whatever its signal_type says.
export const V2_SOURCES: Record<string, Pillar> = {
  adzuna: 'demand',
  serpapi_jobs: 'demand',
  sec_edgar: 'demand',
  serpapi_linkedin: 'supply',
  census_bfs_pbs: 'supply',
  bls_incorporated: 'supply',
  newsapi: 'culture',
  // Folded into the seam the same day (Ruling, Krish, 2026-10-23), each having
  // passed the trial lane's gate (docs/CITABILITY.md): corrected or rescored
  // versions collected by collect-trials, under their trial ids so their
  // backfilled history stays attached.
  trial_hn_wide: 'culture',        // replaces hn
  trial_wikipedia: 'culture',      // replaces wikipedia_pageviews
  trial_trends: 'culture',         // Google Trends rescored on its own history
};

// Inputs that leave the composite at the seam because a corrected version
// replaces them (not retired as uninformative; see RETIRED_AT_V2).
export const REPLACED_AT_V2 = ['hn', 'wikipedia_pageviews'] as const;

export const CARRY_FORWARD_DAYS = 7;
export const MEDIAN_VOTE_SOURCES: Record<string, number> = { serpapi_linkedin: 14 };
export const LINK_WINDOW_DAYS = 28;
export const BOOTSTRAP_DRAWS = 500;

export interface SignalRow {
  date: string;
  source: string;
  category: string;
  signal_type?: string;
  raw_value: number | null;
  normalized_value: number | null;
}

export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const DAY = 86400000;
export const addDays = (iso: string, n: number) =>
  new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);

// One value per source per day: the mean of its rows that day. Role rows win
// over an 'aggregate' row the same source also writes, so the aggregate is not
// counted on top of the roles it summarises. An empty reading from a count
// proxy (raw <= 0) carries no information and is dropped, as in v1; this does
// not apply to a series whose raw value is a change and can be negative.
export const EMPTY_MEANS_MISSING = ['serpapi_linkedin'];

export function dailySourceValue(rows: SignalRow[]): Record<string, number> {
  const by: Record<string, { roles: number[]; agg: number[] }> = {};
  for (const r of rows) {
    if (!(r.source in V2_SOURCES)) continue;
    if (EMPTY_MEANS_MISSING.includes(r.source) && (r.raw_value == null || r.raw_value <= 0)) continue;
    const v = Number(r.normalized_value);
    if (!Number.isFinite(v)) continue;
    const b = (by[r.source] ||= { roles: [], agg: [] });
    (r.category === 'aggregate' ? b.agg : b.roles).push(v);
  }
  const out: Record<string, number> = {};
  for (const [src, b] of Object.entries(by)) {
    const vals = b.roles.length ? b.roles : b.agg;
    if (vals.length) out[src] = mean(vals);
  }
  return out;
}

export interface SourceVote { source: string; pillar: Pillar; value: number; asOf: string; carried: boolean }

// Votes for `date`, from rows covering at least the 14 days before it.
export function votesFor(date: string, rows: SignalRow[]): SourceVote[] {
  const byDay: Record<string, SignalRow[]> = {};
  for (const r of rows) if (r.date <= date) (byDay[r.date.slice(0, 10)] ||= []).push(r);
  const daily: Record<string, Record<string, number>> = {};
  for (const [d, rs] of Object.entries(byDay)) daily[d] = dailySourceValue(rs);
  const votes: SourceVote[] = [];
  for (const [source, pillar] of Object.entries(V2_SOURCES)) {
    const window = MEDIAN_VOTE_SOURCES[source];
    if (window) {
      const vals: number[] = []; let last: string | null = null;
      for (let i = 0; i < window; i++) {
        const d = addDays(date, -i); const v = daily[d]?.[source];
        if (v !== undefined) { vals.push(v); last ||= d; }
      }
      if (vals.length) votes.push({ source, pillar, value: median(vals), asOf: last!, carried: last !== date });
      continue;
    }
    for (let i = 0; i < CARRY_FORWARD_DAYS; i++) {
      const d = addDays(date, -i); const v = daily[d]?.[source];
      if (v !== undefined) { votes.push({ source, pillar, value: v, asOf: d, carried: i > 0 }); break; }
    }
  }
  return votes;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export interface Composite {
  raw: number;                       // unlinked composite, 0.1 precision
  pillars: Record<Pillar, number | null>;
  weights: Record<Pillar, number>;   // effective weights (supply redistributed if absent)
}

export function compositeFromVotes(votes: SourceVote[]): Composite {
  const byPillar: Record<Pillar, number[]> = { demand: [], supply: [], culture: [] };
  for (const v of votes) byPillar[v.pillar].push(v.value);
  const pillars = {
    demand: byPillar.demand.length ? r1(mean(byPillar.demand)) : null,
    supply: byPillar.supply.length ? r1(mean(byPillar.supply)) : null,
    culture: byPillar.culture.length ? r1(mean(byPillar.culture)) : null,
  };
  const present = (Object.keys(PILLAR_WEIGHTS) as Pillar[]).filter((p) => pillars[p] != null);
  const total = present.reduce((s, p) => s + PILLAR_WEIGHTS[p], 0);
  const weights = { demand: 0, supply: 0, culture: 0 } as Record<Pillar, number>;
  for (const p of present) weights[p] = PILLAR_WEIGHTS[p] / total;
  const raw = r1(present.reduce((s, p) => s + (pillars[p] as number) * weights[p], 0));
  return { raw, pillars, weights };
}

// The chain link: mean of (published - v2 raw) over the window. Additive and
// fixed once measured, so v2 differences carry through unscaled.
export function linkOffset(published: Record<string, number>, v2raw: Record<string, number>): { offset: number; n: number } {
  const gaps = Object.keys(published).filter((d) => d in v2raw).map((d) => published[d] - v2raw[d]);
  return { offset: gaps.length ? r1(mean(gaps)) : 0, n: gaps.length };
}

// Deterministic PRNG so a band never moves when nothing moved.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Band: interquartile range of the linked composite when each pillar's votes
// are resampled with replacement. It says how much the reading depends on which
// sources voted; it is not a confidence interval on the market.
export function band(votes: SourceVote[], offset: number, date: string, draws = BOOTSTRAP_DRAWS): { low: number; high: number } {
  const rand = mulberry32(Number(date.replaceAll('-', '')));
  const byPillar: Record<Pillar, SourceVote[]> = { demand: [], supply: [], culture: [] };
  for (const v of votes) byPillar[v.pillar].push(v);
  const out: number[] = [];
  for (let i = 0; i < draws; i++) {
    const sample: SourceVote[] = [];
    for (const vs of Object.values(byPillar)) for (let k = 0; k < vs.length; k++) sample.push(vs[Math.floor(rand() * vs.length)]);
    out.push(compositeFromVotes(sample).raw + offset);
  }
  out.sort((a, b) => a - b);
  return { low: Math.round(out[Math.floor(0.25 * draws)]), high: Math.round(out[Math.floor(0.75 * draws)]) };
}

// Monthly official series -> 0-100 score as known on `date`: the latest period
// released by then, as a z-score against its own trailing 36 periods,
// 50 + 10z, clamped. `releaseDay` is the day of the following month from which
// a period is treated as published (conservative versus the agencies'
// calendars, so a value is never used before it existed).
export function officialScore(
  series: Array<{ period: string; value: number }>, date: string, releaseDay: number,
): { score: number; period: string; value: number; z: number } | null {
  const known = series
    .filter((p) => {
      const [y, m] = p.period.split('-').map(Number);
      const rel = new Date(Date.UTC(y, m, releaseDay)).toISOString().slice(0, 10); // month m is 1-based: Date.UTC month m = next month
      return rel <= date && Number.isFinite(p.value);
    })
    .sort((a, b) => a.period.localeCompare(b.period));
  if (known.length < 13) return null;
  const latest = known.at(-1)!;
  const trail = known.slice(-37, -1).map((p) => p.value);
  const m = mean(trail);
  const sd = Math.sqrt(mean(trail.map((x) => (x - m) ** 2)));
  if (!sd) return null;
  const z = (latest.value - m) / sd;
  return { score: Math.max(0, Math.min(100, Math.round(50 + 10 * z))), period: latest.period, value: latest.value, z: Math.round(z * 100) / 100 };
}

// Year-over-year percentage change, for a series published unadjusted
// (seasonality in a level would read as supply moving with the calendar).
export function yoy(series: Array<{ period: string; value: number }>): Array<{ period: string; value: number }> {
  const by = Object.fromEntries(series.map((p) => [p.period, p.value]));
  return series.flatMap((p) => {
    const [y, m] = p.period.split('-');
    const prev = by[`${Number(y) - 1}-${m}`];
    return prev ? [{ period: p.period, value: ((p.value - prev) / prev) * 100 }] : [];
  });
}

export const formatReading = (overall: number, b?: { low: number; high: number } | null) =>
  b ? `${Math.round(overall)} (${b.low} to ${b.high})` : `${Math.round(overall)}`;
