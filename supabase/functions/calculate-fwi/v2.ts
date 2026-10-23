// FWI method v2, for target dates on or after METHOD_V2_EFFECTIVE (2026-10-26).
// Days before the seam are computed by index.ts exactly as before; this file
// never touches them. Method and rulings: ../_shared/fwi-method.ts and
// docs/CITABILITY.md "Rulings".
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  LINK_WINDOW_DAYS, METHOD_V2_EFFECTIVE, METHOD_V2_ID, PILLAR_WEIGHTS, RETIRED_AT_V2,
  addDays, band, compositeFromVotes, linkOffset, officialScore, votesFor, yoy,
  type SignalRow,
} from '../_shared/fwi-method.ts';
import { RELEASE_DAY, fetchOfficialSupply } from '../_shared/official-supply.ts';

// Completeness weights from the seam. The nine retired inputs leave; the two
// official supply series take the retired supply sources' share, so supply
// keeps 0.17 of the denominator. Context inputs still count, as in v1.
export const COMPLETENESS_WEIGHTS_V2: Record<string, number> = {
  adzuna: 0.12, serpapi_jobs: 0.07, sec_edgar: 0.09,
  serpapi_linkedin: 0.06, census_bfs_pbs: 0.06, bls_incorporated: 0.05,
  newsapi: 0.04, hn: 0.01, wikipedia_pageviews: 0.06,
  bls: 0.04, fred: 0.01, census_acs: 0.01, openalex: 0.02,
};

const label = (score: number) =>
  score >= 75 ? 'Surging' : score >= 60 ? 'Growing' : score >= 45 ? 'Stable' : score >= 30 ? 'Cooling' : 'Contracting';

async function signalsBetween(supabase: SupabaseClient, from: string, to: string): Promise<SignalRow[]> {
  const out: SignalRow[] = [];
  for (let o = 0; ; o += 1000) {
    const { data, error } = await supabase.from('signals')
      .select('date, source, signal_type, category, raw_value, normalized_value')
      .gte('date', from).lte('date', to).order('date').range(o, o + 999);
    if (error) throw error;
    out.push(...(data as SignalRow[]));
    if (!data || data.length < 1000) return out;
  }
}

// Official supply rows for each day in [from, to] that has none stored. The
// stored row (written by ingest-signals from the seam) wins when present; the
// rebuilt one is what the seam's link window needs, read from the files'
// release record as known on each day.
async function officialRows(stored: SignalRow[], from: string, to: string): Promise<{ rows: SignalRow[]; via: Record<string, string> | null; error?: string }> {
  try {
    const off = await fetchOfficialSupply();
    const blsYoy = yoy(off.bls_incorporated);
    const have = new Set(stored.filter((r) => r.source === 'census_bfs_pbs' || r.source === 'bls_incorporated').map((r) => `${r.date}|${r.source}`));
    const rows: SignalRow[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const c = officialScore(off.census_bfs_pbs, d, RELEASE_DAY.census_bfs_pbs);
      if (c && !have.has(`${d}|census_bfs_pbs`)) rows.push({ date: d, source: 'census_bfs_pbs', category: 'naics54_applications', raw_value: c.value, normalized_value: c.score });
      const b = officialScore(blsYoy, d, RELEASE_DAY.bls_incorporated);
      if (b && !have.has(`${d}|bls_incorporated`)) rows.push({ date: d, source: 'bls_incorporated', category: 'incorporated_self_employed_yoy', raw_value: b.value, normalized_value: b.score });
    }
    return { rows, via: off.via };
  } catch (e) {
    return { rows: [], via: null, error: (e as Error).message };
  }
}

interface SeamRecord { id: string; effective: string; link_offset: number; link_window: { first: string; last: string; n: number }; computed_at: string }

// The link offset is measured once, on the first v2 run, over the 28 published
// days before the seam, and then read back from the seam day's row forever.
async function seamRecord(supabase: SupabaseClient, rows: SignalRow[]): Promise<SeamRecord> {
  // The earliest v2 row holds the record: normally the seam day itself, or the
  // first day after it if the seam day's run failed.
  const { data: first } = await supabase.from('fwi_scores').select('metadata')
    .gte('date', METHOD_V2_EFFECTIVE).order('date').limit(1).maybeSingle();
  const existing = (first?.metadata as { method?: SeamRecord } | null)?.method;
  if (existing?.id === METHOD_V2_ID && typeof existing.link_offset === 'number') return existing;

  const { data: prior, error } = await supabase.from('fwi_scores').select('date, overall_score')
    .lt('date', METHOD_V2_EFFECTIVE).order('date', { ascending: false }).limit(LINK_WINDOW_DAYS);
  if (error) throw error;
  const published = Object.fromEntries((prior || []).map((r) => [r.date, Number(r.overall_score)]));
  const v2raw: Record<string, number> = {};
  for (const d of Object.keys(published)) v2raw[d] = compositeFromVotes(votesFor(d, rows)).raw;
  const { offset, n } = linkOffset(published, v2raw);
  if (n < LINK_WINDOW_DAYS - 3) throw new Error(`seam link window has ${n} usable days, needs ${LINK_WINDOW_DAYS - 3}`);
  const days = Object.keys(published).sort();
  return { id: METHOD_V2_ID, effective: METHOD_V2_EFFECTIVE, link_offset: offset, link_window: { first: days[0], last: days.at(-1)!, n }, computed_at: new Date().toISOString() };
}

export async function calculateV2(supabase: SupabaseClient, targetDate: string, opts: { dryRun?: boolean } = {}) {
  const linkFrom = addDays(METHOD_V2_EFFECTIVE, -(LINK_WINDOW_DAYS + 3));
  const from = addDays(linkFrom < addDays(targetDate, -14) ? linkFrom : addDays(targetDate, -14), -14);
  const stored = await signalsBetween(supabase, from, targetDate);
  const official = await officialRows(stored, from, targetDate);
  const rows = [...stored, ...official.rows];

  const todays = stored.filter((r) => r.date === targetDate);
  if (todays.length === 0) return { status: 404, body: { error: 'No signals found', date: targetDate, method: METHOD_V2_ID } };

  const seam = await seamRecord(supabase, rows);
  const votes = votesFor(targetDate, rows);
  const c = compositeFromVotes(votes);
  const linked = Math.round((c.raw + seam.link_offset) * 10) / 10;
  const overall = Math.round(linked);
  const b = band(votes, seam.link_offset, targetDate);
  const round = (x: number | null) => (x == null ? null : Math.round(x));

  const arrived = [...new Set(todays.map((r) => r.source))];
  const totalW = Object.values(COMPLETENESS_WEIGHTS_V2).reduce((a, x) => a + x, 0);
  const gotW = arrived.reduce((s, src) => s + (COMPLETENESS_WEIGHTS_V2[src] || 0), 0)
    + (official.rows.some((r) => r.date === targetDate && r.source === 'census_bfs_pbs') && !arrived.includes('census_bfs_pbs') ? COMPLETENESS_WEIGHTS_V2.census_bfs_pbs : 0)
    + (official.rows.some((r) => r.date === targetDate && r.source === 'bls_incorporated') && !arrived.includes('bls_incorporated') ? COMPLETENESS_WEIGHTS_V2.bls_incorporated : 0);
  const confidence = Math.round((gotW / totalW) * 100) / 100;
  const count = (p: string) => votes.filter((v) => v.pillar === p).length;

  const record = {
    date: targetDate,
    overall_score: overall,
    demand_score: round(c.pillars.demand),
    supply_score: round(c.pillars.supply),
    momentum_score: round(c.pillars.culture),
    weights: c.weights,
    confidence,
    notes: `${label(overall)} - ${votes.length} source votes (method ${METHOD_V2_ID})`,
    metadata: {
      method: seam,
      band: { low: b.low, high: b.high, method: 'interquartile range of 500 seeded draws resampling each pillar\'s source votes' },
      raw_composite: c.raw,
      linked_composite: linked,
      pillars_unrounded: c.pillars,
      display_weights: PILLAR_WEIGHTS,
      votes: votes.map((v) => ({ source: v.source, pillar: v.pillar, value: Math.round(v.value * 10) / 10, as_of: v.asOf, carried: v.carried })),
      sources: arrived,
      retired_at_seam: RETIRED_AT_V2,
      official_supply_via: official.via,
      official_supply_error: official.error ?? null,
      has_supply_data: c.pillars.supply != null,
      data_quality: {
        supply: c.pillars.supply != null ? 'measured' : 'unmeasured',
        demand_signal_count: count('demand'),
        supply_signal_count: count('supply'),
        culture_signal_count: count('culture'),
        carried_votes: votes.filter((v) => v.carried).map((v) => v.source),
      },
    },
  };

  if (!opts.dryRun) {
    const { error } = await supabase.from('fwi_scores').upsert(record, { onConflict: 'date' });
    if (error) throw error;
    // Role movers, as v1 computes them: each Adzuna role against the role mean.
    const roleNames: Record<string, string> = { cfo: 'Fractional CFO', cmo: 'Fractional CMO', cto: 'Fractional CTO', coo: 'Fractional COO', cro: 'Fractional CRO', ceo: 'Interim CEO' };
    const roles = todays.filter((r) => r.source === 'adzuna' && r.category in roleNames);
    if (roles.length) {
      const avg = roles.reduce((s, r) => s + Number(r.normalized_value), 0) / roles.length;
      const movers = roles.map((r) => ({
        date: targetDate, skill: roleNames[r.category], signal_type: 'demand',
        change_pct: avg > 0 ? Math.round(((Number(r.normalized_value) - avg) / avg) * 100) : 0,
        note: `${r.raw_value} jobs - ${Number(r.normalized_value) > avg ? 'above' : 'below'} market average`, rank: 0,
      })).sort((a, b2) => Math.abs(b2.change_pct) - Math.abs(a.change_pct)).slice(0, 5).map((m, i) => ({ ...m, rank: i + 1 }));
      await supabase.from('movers').delete().eq('date', targetDate);
      const { error: mErr } = await supabase.from('movers').insert(movers);
      if (mErr) console.error('[FWI v2] movers insert failed:', mErr.message);
    }
  }

  return {
    status: 200,
    body: {
      success: true, dry_run: !!opts.dryRun, date: targetDate, method: METHOD_V2_ID,
      overall_score: overall, band: { low: b.low, high: b.high }, label: label(overall),
      demand_score: record.demand_score, supply_score: record.supply_score, momentum_score: record.momentum_score,
      confidence, link_offset: seam.link_offset, link_window: seam.link_window,
      votes: record.metadata.votes, official_supply_via: official.via, official_supply_error: official.error ?? null,
    },
  };
}
