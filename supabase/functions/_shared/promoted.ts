// The three trial inputs promoted into the composite at the 2026-10-26 seam
// (Ruling, Krish, 2026-10-23): trial_wikipedia, trial_hn_wide, trial_trends.
//
// They keep their trial_* names and 'candidate' rows, so the 60 days of history
// the chain link and the band read stay one series. Being scored, they get what
// every scored input gets: the hold-then-confirm anomaly guard and a health row.
// collect-trials owns trial_wikipedia and trial_hn_wide; ingest-signals owns
// trial_trends, because it is derived from the Trends reading ingest collects.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { addDays } from './fwi-method.ts';
import { anomalyDecision } from './outlier.ts';
import { PROMOTED, trailingZScore } from './trials.ts';

export interface PromotedRow {
  date: string; source: string; signal_type: 'candidate'; category: string;
  raw_value: number; normalized_value: number; metadata: Record<string, unknown>;
}

// Same rule as ingest-signals applies to its own inputs from the seam: a reading
// more than 3 sd from the source's last eight is held as a guard_held row and
// scored only if the next day confirms it.
export async function guardPromoted(supabase: SupabaseClient, rows: PromotedRow[], today: string): Promise<{ keep: PromotedRow[]; held: PromotedRow[] }> {
  const judged = rows.filter((r) => r.date === today && PROMOTED.includes(r.source));
  if (!judged.length) return { keep: rows, held: [] };
  const { data: hist } = await supabase.from('signals').select('date, source, category, normalized_value')
    .in('source', [...new Set(judged.map((r) => r.source))]).gte('date', addDays(today, -30)).lt('date', today)
    .order('date', { ascending: false });
  const history: Record<string, number[]> = {};
  for (const h of hist || []) {
    const key = `${h.source}_${h.category}`;
    if ((history[key] ||= []).length < 8) history[key].push(Number(h.normalized_value));
  }
  const { data: heldData } = await supabase.from('signals').select('category, normalized_value')
    .eq('source', 'guard_held').eq('date', addDays(today, -1));
  const heldYesterday: Record<string, number> = {};
  for (const h of heldData || []) heldYesterday[String(h.category)] = Number(h.normalized_value);

  const keep: PromotedRow[] = [], held: PromotedRow[] = [];
  for (const r of rows) {
    if (!judged.includes(r)) { keep.push(r); continue; }
    const key = `${r.source}_${r.category}`;
    const d = anomalyDecision(r.normalized_value, history[key] || [], heldYesterday[key] ?? null);
    if (d.action === 'hold') {
      console.warn(`[Anomaly Guard] HELD ${key}: ${r.normalized_value} is ${d.z} sd from ${d.mean} (sd ${d.sd})`);
      held.push({ date: today, source: 'guard_held', signal_type: 'candidate', category: key, raw_value: r.raw_value, normalized_value: r.normalized_value,
        metadata: { source: r.source, category: r.category, z: d.z, mean: d.mean, sd: d.sd } });
      continue;
    }
    if (d.action === 'confirm') r.metadata = { ...r.metadata, guard: 'confirmed_level_change', held_yesterday: d.held, z: d.z };
    keep.push(r);
  }
  return { keep, held };
}

// One health row per promoted source this run owns, attributed from what was
// persisted, as ingest-signals does for its own inputs.
export async function writePromotedHealth(supabase: SupabaseClient, owned: string[], persisted: string[], errors: Record<string, string | undefined>, collector = 'collect-trials') {
  const now = new Date().toISOString();
  const rows = owned.map((source) => persisted.includes(source)
    ? { source, pipeline: 'fwi', last_checked: now, last_success: now, status: 'healthy', error_count: 0, metadata: { last_error: null, collector }, updated_at: now }
    : { source, pipeline: 'fwi', last_checked: now, status: 'failed', error_count: 1, metadata: { last_error: errors[source] || 'no reading survived collection or the anomaly guard', collector }, updated_at: now });
  // Healthy and failed upsert separately so a failure keeps the prior last_success.
  for (const batch of [rows.filter((r) => r.status === 'healthy'), rows.filter((r) => r.status !== 'healthy')]) {
    if (!batch.length) continue;
    const { error } = await supabase.from('data_source_health').upsert(batch, { onConflict: 'source' });
    if (error) console.warn('[Health] promoted-source health write failed:', error.message);
  }
}

// trial_trends for one day: that day's Trends reading scored against its own
// trailing 28 stored readings (the serpapi_trends rows before the seam, the
// trial_trends_raw rows from it). Null when there is too little history.
export async function trendsRowFor(supabase: SupabaseClient, date: string, rawToday: number): Promise<PromotedRow | null> {
  const raw: Record<string, number> = {};
  for (const src of ['serpapi_trends', 'trial_trends_raw']) {
    const { data } = await supabase.from('signals').select('date, raw_value').eq('source', src).gte('date', addDays(date, -40)).lt('date', date);
    for (const r of data || []) if (Number.isFinite(Number(r.raw_value)) && Number(r.raw_value) > 0) raw[r.date] = Number(r.raw_value);
  }
  const trailing = Array.from({ length: 28 }, (_, i) => raw[addDays(date, -(i + 1))]).filter((x) => x !== undefined);
  const score = trailingZScore(rawToday, trailing);
  return score == null ? null : { date, source: 'trial_trends', signal_type: 'candidate', category: 'search_interest_z', raw_value: rawToday, normalized_value: score, metadata: { trailing_days: trailing.length, backfilled: false } };
}
