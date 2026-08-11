// fwi-roles: per-role demand indices for the 6 fractional C-suite roles.
//
// Each role's demand index is the mean of its normalized demand signals (Adzuna
// job postings + DataForSEO Google Jobs cross-check) over a trailing 7-day window,
// on the same 0-100 scale as the FWI demand pillar. Honest framing: this is the
// DEMAND reading for the role, set in the context of the overall weekly FWI.
// No auth.
//
// Why a 7-day window and not a single date: the collectors do not all land on
// the same calendar day (Adzuna and DataForSEO Google Jobs run on different
// cadences and each skips days when a provider is rate limited). The previous
// implementation pinned every role to the single latest date that had ANY
// per-role row, so five of the six roles returned null on most days even though
// the underlying data existed. A trailing 7-day window matches the product's
// weekly settle and returns a real reading for every role that has been
// collected in the last week.
//
// Per-source averaging before the cross-source mean stops a source that
// reported on 5 of 7 days from outweighing one that reported on 2.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
const supabase = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

const ROLES: Record<string, string> = { cfo: 'Fractional CFO', cmo: 'Fractional CMO', cto: 'Fractional CTO', coo: 'Fractional COO', cro: 'Fractional CRO', ceo: 'Interim CEO' };
const WINDOW_DAYS = 7;

function band(s: number) { if (s >= 75) return 'Surging'; if (s >= 60) return 'Growing'; if (s >= 45) return 'Stable'; if (s >= 30) return 'Cooling'; return 'Contracting'; }
function round1(n: number) { return Math.round(n * 10) / 10; }

// Display convention, shared with src/lib/format.ts: an index LEVEL is a whole
// number (one decimal on a multi-source blend is false precision, and the band
// boundaries are integers), while a CHANGE keeps one decimal because a move of a
// few tenths is real signal. `demand` keeps the precise value for callers that
// want it; `demandDisplay` is the number every human surface shows, and `band` is
// computed from THAT so the label and the number can never disagree.
function displayLevel(n: number) { return Math.round(n); }
function shiftDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Row { date: string; source: string; category: string; raw_value: number | string | null; normalized_value: number | string | null }

/** Mean of per-source means, so an over-reporting source cannot dominate. */
function windowScore(rows: Row[]): { score: number | null; sources: string[]; observations: number } {
  const bySource = new Map<string, number[]>();
  for (const r of rows) {
    const v = Number(r.normalized_value);
    if (!isFinite(v)) continue;
    const arr = bySource.get(r.source) ?? [];
    arr.push(v);
    bySource.set(r.source, arr);
  }
  if (bySource.size === 0) return { score: null, sources: [], observations: 0 };
  let total = 0;
  let observations = 0;
  for (const values of bySource.values()) {
    total += values.reduce((a, b) => a + b, 0) / values.length;
    observations += values.length;
  }
  return { score: round1(total / bySource.size), sources: [...bySource.keys()].sort(), observations };
}

/** Most recent raw count per source inside the window: the concrete "what we counted". */
function latestPostings(rows: Row[]) {
  const seen = new Map<string, { source: string; count: number; date: string }>();
  for (const r of rows) {
    if (seen.has(r.source)) continue; // rows arrive newest first
    const n = Number(r.raw_value);
    if (!isFinite(n)) continue;
    seen.set(r.source, { source: r.source, count: n, date: r.date });
  }
  return [...seen.values()].sort((a, b) => b.count - a.count);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const { data: latest } = await supabase
    .from('fwi_scores')
    .select('date, overall_score, demand_score, supply_score, momentum_score, confidence')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const overallScore = latest?.overall_score != null ? round1(Number(latest.overall_score)) : null;

  // Newest first. 6 roles x 2 sources x 14 days is at most 168 rows, so 500
  // comfortably covers both windows even with extra sources or backfilled days.
  const { data: dRows } = await supabase
    .from('signals')
    .select('date, source, category, raw_value, normalized_value')
    .eq('signal_type', 'demand')
    .in('category', Object.keys(ROLES))
    .order('date', { ascending: false })
    .limit(500);

  const rows = (dRows || []) as Row[];
  const asOf = rows.length ? rows[0].date : latest?.date ?? null;

  // Current window is the 7 days ending on asOf; the prior window is the 7 days
  // before that, which is what the week-over-week change compares against.
  const curFrom = asOf ? shiftDays(asOf, -(WINDOW_DAYS - 1)) : null;
  const prevFrom = asOf ? shiftDays(asOf, -(WINDOW_DAYS * 2 - 1)) : null;
  const prevTo = asOf ? shiftDays(asOf, -WINDOW_DAYS) : null;

  const roles = Object.keys(ROLES).map((key) => {
    const mine = rows.filter((r) => r.category === key);
    const cur = curFrom && asOf ? mine.filter((r) => r.date >= curFrom && r.date <= asOf) : [];
    const prev = prevFrom && prevTo ? mine.filter((r) => r.date >= prevFrom && r.date <= prevTo) : [];

    const { score: demand, sources, observations } = windowScore(cur);
    const { score: prevDemand } = windowScore(prev);
    const change7d = demand != null && prevDemand != null ? round1(demand - prevDemand) : null;

    return {
      role: key,
      label: ROLES[key],
      slug: `fractional-${key}`,
      demand,
      demandDisplay: demand != null ? displayLevel(demand) : null,
      band: demand != null ? band(displayLevel(demand)) : null,
      prevDemand,
      change7d,
      direction: change7d == null ? null : change7d > 0.5 ? 'rising' : change7d < -0.5 ? 'falling' : 'flat',
      sources,
      observations,
      postings: latestPostings(cur),
      rank: null as number | null,
      vsRoleAverage: null as number | null,
    };
  });

  // Relative standing across the six roles, computed only from roles that have a
  // reading this window. Never rank a role we could not measure.
  const measured = roles.filter((r) => r.demand != null);
  const roleAverage = measured.length ? round1(measured.reduce((a, r) => a + (r.demand as number), 0) / measured.length) : null;
  [...measured].sort((a, b) => (b.demand as number) - (a.demand as number)).forEach((r, i) => { r.rank = i + 1; });
  if (roleAverage != null) for (const r of measured) r.vsRoleAverage = round1((r.demand as number) - roleAverage);

  return new Response(JSON.stringify({
    asOf,
    windowDays: WINDOW_DAYS,
    window: curFrom && asOf ? { from: curFrom, to: asOf } : null,
    priorWindow: prevFrom && prevTo ? { from: prevFrom, to: prevTo } : null,
    overall: {
      score: overallScore,
      scoreDisplay: overallScore != null ? displayLevel(overallScore) : null,
      band: overallScore != null ? band(displayLevel(overallScore)) : null,
      demand: latest?.demand_score != null ? round1(Number(latest.demand_score)) : null,
      supply: latest?.supply_score != null ? round1(Number(latest.supply_score)) : null,
      culture: latest?.momentum_score != null ? round1(Number(latest.momentum_score)) : null,
      confidence: latest?.confidence != null ? Number(latest.confidence) : null,
      asOf: latest?.date ?? null,
    },
    rolesMeasured: measured.length,
    roleAverage,
    roleAverageDisplay: roleAverage != null ? displayLevel(roleAverage) : null,
    note: 'Per-role demand index (0-100) from Adzuna + DataForSEO Google Jobs over a trailing 7-day window, in the context of the overall weekly FWI. Form D filings provide financing context; their relationship to future fractional demand has not been validated.',
    method: 'For each role, each demand source is averaged across the trailing 7 days, then the sources are averaged together. change7d compares that window to the 7 days before it. Supply is not published per role because the supply sources are not role-differentiated once normalized.',
    display: 'Levels (demand, roleAverage, overall.score) carry full precision here; the *Display fields are the whole numbers every human surface shows, and band is computed from the display value so a label can never contradict the number beside it. Changes (change7d, vsRoleAverage) keep one decimal.',
    roles,
  }, null, 2), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } });
});
