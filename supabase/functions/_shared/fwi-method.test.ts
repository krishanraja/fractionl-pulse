import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RETIRED_AT_V2, V2_SOURCES, addDays, band, compositeFromVotes, dailySourceValue,
  formatReading, linkOffset, officialScore, votesFor, yoy, type SignalRow,
} from './fwi-method.ts';
import { parseBlsApi, parseCensusBfs, parseFredCsv } from './official-supply.ts';

const row = (date: string, source: string, normalized_value: number, category = 'x', raw_value: number | null = 1): SignalRow =>
  ({ date, source, category, normalized_value, raw_value });

test('no retired source is a v2 composite input', () => {
  for (const s of RETIRED_AT_V2) assert.equal(s in V2_SOURCES, false, s);
});

test('a source with six role rows gets one vote, not six', () => {
  const rows = [
    ...['cfo', 'cmo', 'cto', 'coo', 'cro', 'ceo'].map((c) => row('2026-10-26', 'adzuna', 80, c)),
    row('2026-10-26', 'sec_edgar', 20, 'vc_pipeline'),
  ];
  const c = compositeFromVotes(votesFor('2026-10-26', rows));
  assert.equal(c.pillars.demand, 50); // (80 + 20) / 2, not (6*80 + 20) / 7
});

test('an aggregate row is not counted on top of the role rows it summarises', () => {
  const v = dailySourceValue([row('d', 'adzuna', 40, 'cfo'), row('d', 'adzuna', 60, 'cmo'), row('d', 'adzuna', 99, 'aggregate')]);
  assert.equal(v.adzuna, 50);
});

test('a retired source in the rows changes nothing (negative control)', () => {
  const base = [row('2026-10-26', 'newsapi', 40, 'media_coverage'), row('2026-10-26', 'hn', 60, 'community_discourse')];
  const withRetired = [...base, row('2026-10-26', 'mediastack', 0, 'media_coverage'), row('2026-10-26', 'guardian', 5, 'prestige_media')];
  assert.deepEqual(compositeFromVotes(votesFor('2026-10-26', withRetired)), compositeFromVotes(votesFor('2026-10-26', base)));
});

test('a missing source holds its last vote for up to 7 days, then drops out', () => {
  const rows = [row('2026-10-20', 'newsapi', 70, 'media_coverage'), row('2026-10-26', 'hn', 30, 'community_discourse')];
  const six = votesFor('2026-10-26', rows).find((v) => v.source === 'newsapi');
  assert.deepEqual([six?.value, six?.carried, six?.asOf], [70, true, '2026-10-20']);
  const eight = votesFor('2026-10-27', [row('2026-10-20', 'newsapi', 70, 'media_coverage')]);
  assert.equal(eight.find((v) => v.source === 'newsapi'), undefined);
});

test('the LinkedIn proxy votes the median of its last 14 days, so one flip does not move supply', () => {
  const rows = [10, 11, 12, 13].map((d) => row(`2026-10-${d + 10}`, 'serpapi_linkedin', 45, 'cfo', 50));
  rows.push(row('2026-10-24', 'serpapi_linkedin', 100, 'cfo', 125000));
  const v = votesFor('2026-10-24', rows).find((x) => x.source === 'serpapi_linkedin');
  assert.equal(v?.value, 45);
});

test('an empty supply reading is not a vote', () => {
  const v = dailySourceValue([row('d', 'serpapi_linkedin', 10, 'cfo', 0)]);
  assert.equal('serpapi_linkedin' in v, false);
});

test('a negative year-over-year official reading is still a vote', () => {
  const v = dailySourceValue([row('d', 'bls_incorporated', 45, 'incorporated_self_employed_yoy', -3.7)]);
  assert.equal(v.bls_incorporated, 45);
});

test('no supply vote redistributes supply weight to demand and culture', () => {
  const c = compositeFromVotes([
    { source: 'adzuna', pillar: 'demand', value: 60, asOf: 'd', carried: false },
    { source: 'hn', pillar: 'culture', value: 40, asOf: 'd', carried: false },
  ]);
  assert.equal(c.pillars.supply, null);
  assert.equal(c.weights.supply, 0);
  assert.equal(c.raw, Math.round((60 * 0.625 + 40 * 0.375) * 10) / 10);
});

test('the link offset is the mean gap over the days both series have', () => {
  assert.deepEqual(linkOffset({ a: 50, b: 52, c: 48 }, { a: 55, b: 57 }), { offset: -5, n: 2 });
});

test('the band is deterministic for a date and brackets the reading', () => {
  const votes = [
    { source: 'adzuna', pillar: 'demand' as const, value: 70, asOf: 'd', carried: false },
    { source: 'sec_edgar', pillar: 'demand' as const, value: 40, asOf: 'd', carried: false },
    { source: 'serpapi_jobs', pillar: 'demand' as const, value: 55, asOf: 'd', carried: false },
    { source: 'hn', pillar: 'culture' as const, value: 30, asOf: 'd', carried: false },
    { source: 'newsapi', pillar: 'culture' as const, value: 50, asOf: 'd', carried: false },
  ];
  const a = band(votes, -4, '2026-10-26'), b = band(votes, -4, '2026-10-26');
  assert.deepEqual(a, b);
  const reading = compositeFromVotes(votes).raw - 4;
  assert.ok(a.low <= reading + 0.5 && reading - 0.5 <= a.high, `${JSON.stringify(a)} vs ${reading}`);
  assert.ok(a.low < a.high);
});

test('identical votes give a zero-width band (negative control)', () => {
  const votes = ['adzuna', 'sec_edgar'].map((s) => ({ source: s, pillar: 'demand' as const, value: 50, asOf: 'd', carried: false }));
  assert.deepEqual(band(votes, 0, '2026-10-26'), { low: 50, high: 50 });
});

const monthly = (from: number, n: number, f: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => {
    const y = from + Math.floor(i / 12), m = (i % 12) + 1;
    return { period: `${y}-${String(m).padStart(2, '0')}`, value: f(i) };
  });

test('an official period is not used before its release day', () => {
  const s = monthly(2023, 45, (i) => 100 + (i % 3)); // 2023-01 .. 2026-09
  assert.equal(officialScore(s, '2026-10-19', 20)?.period, '2026-08');
  assert.equal(officialScore(s, '2026-10-20', 20)?.period, '2026-09');
});

test('a value at its trailing mean scores 50; two sd above scores 70', () => {
  const flat = monthly(2023, 44, (i) => (i % 2 ? 90 : 110)); // mean 100, sd 10
  flat.push({ period: '2026-09', value: 100 });
  assert.equal(officialScore(flat, '2026-12-01', 20)?.score, 50);
  flat[flat.length - 1] = { period: '2026-09', value: 120 };
  assert.equal(officialScore(flat, '2026-12-01', 20)?.score, 70);
});

test('a constant official series yields no score rather than a fake 50', () => {
  assert.equal(officialScore(monthly(2023, 45, () => 7), '2026-12-01', 20), null);
});

test('yoy compares each month with the same month a year earlier', () => {
  const y = yoy([{ period: '2025-03', value: 100 }, { period: '2026-03', value: 110 }]);
  assert.equal(y.length, 1);
  assert.equal(y[0].period, '2026-03');
  assert.ok(Math.abs(y[0].value - 10) < 1e-9);
});

test('parsers read the agencies\' published layouts', () => {
  const census = 'sa,naics_sector,series,geo,year,jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec\n'
    + 'U,NAICS54,BA_BA,US,2026,1,2,3,4,5,6,7,8,9,,,\n'
    + 'A,NAICS54,BA_BA,US,2026,72189,75187,77066,79203,82254,83092,80751,80272,78937,,,\n'
    + 'A,NAICS54,BA_HBA,US,2026,1,1,1,1,1,1,1,1,1,,,';
  const p = parseCensusBfs(census);
  assert.equal(p.length, 9);
  assert.deepEqual(p.at(-1), { period: '2026-09', value: 78937 });
  assert.deepEqual(parseFredCsv('observation_date,LNU02048984\n2026-08-01,6856\n2026-09-01,.\n'), [{ period: '2026-08', value: 6856 }]);
});

test('the BLS API parser keeps monthly periods and refuses a failed request', () => {
  const ok = { status: 'REQUEST_SUCCEEDED', Results: { series: [{ data: [
    { year: '2026', period: 'M09', value: '6897' }, { year: '2025', period: 'M13', value: '1' }, { year: '2026', period: 'M08', value: '6856' },
  ] }] } };
  assert.deepEqual(parseBlsApi(ok), [{ period: '2026-08', value: 6856 }, { period: '2026-09', value: 6897 }]);
  assert.throws(() => parseBlsApi({ status: 'REQUEST_NOT_PROCESSED', message: ['daily threshold'] }), /daily threshold/);
});

test('formatReading publishes a whole number with its band', () => {
  assert.equal(formatReading(47.6, { low: 45, high: 51 }), '48 (45 to 51)');
  assert.equal(addDays('2026-10-26', -28), '2026-09-28');
});
