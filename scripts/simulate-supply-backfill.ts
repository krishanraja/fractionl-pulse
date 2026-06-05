/**
 * Fill historical fwi_scores.supply_score gaps with auditable simulated data.
 *
 * This is intentionally an operator script, not daily pipeline behavior. It only
 * updates rows where supply_score is null, keeps measured rows untouched, and
 * records the simulation method in metadata.
 *
 * Dry run:
 *   npx tsx scripts/simulate-supply-backfill.ts
 *
 * Write:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/simulate-supply-backfill.ts --write
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dtlcprcpvdomrehbejhw.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bGNwcmNwdmRvbXJlaGJlamh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MTM3ODEsImV4cCI6MjA2OTM4OTc4MX0.bSvVAJb5Y2Tszq_AcvAHaNeJs5m--kFlRH4XZ2dfP_8';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const KEY = SERVICE_KEY || ANON_KEY;
const WRITE = process.argv.includes('--write');
const SINCE = argValue('--since') || '2026-02-01';
const TAG = 'simulated_supply_backfill_2026_06_05';

type ScoreRow = {
  date: string;
  overall_score: number;
  demand_score: number;
  supply_score: number | null;
  momentum_score: number | null;
  confidence: number | null;
  weights: Record<string, number> | null;
  notes: string | null;
  metadata: Record<string, any> | null;
};

function argValue(name: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function deterministicNoise(date: string, amplitude: number) {
  let hash = 0;
  for (const char of date) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return ((hash % 1000) / 1000 - 0.5) * 2 * amplitude;
}

function measuredNeighbor(rows: ScoreRow[], index: number, direction: -1 | 1): { row: ScoreRow; index: number } | null {
  for (let i = index + direction; i >= 0 && i < rows.length; i += direction) {
    if (rows[i].supply_score != null) return { row: rows[i], index: i };
  }
  return null;
}

function simulatedSupply(rows: ScoreRow[], index: number): number {
  const row = rows[index];
  const prev = measuredNeighbor(rows, index, -1);
  const next = measuredNeighbor(rows, index, 1);

  if (prev && next) {
    const span = Math.max(1, daysBetween(prev.row.date, next.row.date));
    const position = clamp(daysBetween(prev.row.date, row.date) / span, 0, 1);
    const interpolated = prev.row.supply_score! + (next.row.supply_score! - prev.row.supply_score!) * position;
    return round1(clamp(interpolated + deterministicNoise(row.date, 2.2), 35, 88));
  }

  if (next) {
    const daysAway = Math.max(0, daysBetween(row.date, next.row.date));
    const drift = Math.min(14, daysAway * 0.22);
    return round1(clamp(next.row.supply_score! - drift + deterministicNoise(row.date, 2.8), 32, 82));
  }

  if (prev) {
    const daysAway = Math.max(0, daysBetween(prev.row.date, row.date));
    const drift = Math.min(8, daysAway * 0.16);
    return round1(clamp(prev.row.supply_score! + drift + deterministicNoise(row.date, 2.8), 35, 88));
  }

  // Fallback should not normally run, but keeps the script deterministic.
  const demand = row.demand_score || 50;
  const culture = row.momentum_score ?? 45;
  return round1(clamp((demand * 0.45) + (culture * 0.25) + 18 + deterministicNoise(row.date, 3), 32, 82));
}

function recomputeOverall(row: ScoreRow, supply: number) {
  const demand = row.demand_score || 0;
  const culture = row.momentum_score ?? 0;
  const hasCulture = row.momentum_score != null;
  const weights = hasCulture
    ? { demand: 0.5, supply: 0.2, culture: 0.3 }
    : { demand: 0.7142857143, supply: 0.2857142857, culture: 0 };
  return {
    weights,
    overall: round1(demand * weights.demand + supply * weights.supply + culture * weights.culture),
  };
}

function patchedRow(row: ScoreRow, supply: number) {
  const { weights, overall } = recomputeOverall(row, supply);
  const metadata = row.metadata || {};
  const dataQuality = metadata.data_quality || {};

  return {
    supply_score: supply,
    overall_score: overall,
    weights,
    notes: `${row.notes || 'Historical FWI'} (supply simulated)`,
    metadata: {
      ...metadata,
      has_supply_data: true,
      display_weights: { demand: 0.5, supply: 0.2, culture: 0.3 },
      simulated_backfill: {
        tag: TAG,
        component: 'supply',
        method: 'deterministic interpolation/extrapolation from measured supply anchors',
        generated_at: new Date().toISOString(),
      },
      data_quality: {
        ...dataQuality,
        supply: 'simulated_estimate',
        supply_simulation_tag: TAG,
        original_supply_score: dataQuality.original_supply_score ?? row.supply_score,
        original_overall_score: dataQuality.original_overall_score ?? row.overall_score,
        original_weights: dataQuality.original_weights ?? row.weights,
      },
    },
  };
}

async function main() {
  const rows = await rest(
    `fwi_scores?select=date,overall_score,demand_score,supply_score,momentum_score,confidence,weights,notes,metadata&order=date.asc&date=gte.${SINCE}`,
  ) as ScoreRow[];

  const gaps = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.supply_score == null);

  console.log(`Supply backfill audit since ${SINCE}`);
  console.log(`  rows scanned: ${rows.length}`);
  console.log(`  null supply rows: ${gaps.length}`);
  console.log(`  mode: ${WRITE ? 'WRITE' : 'DRY RUN'}`);

  if (WRITE && !SERVICE_KEY) {
    throw new Error('Write mode requires SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY.');
  }

  for (const { row, index } of gaps) {
    const supply = simulatedSupply(rows, index);
    const patch = patchedRow(row, supply);
    console.log(
      `${row.date}: supply null -> ${supply}, overall ${row.overall_score} -> ${patch.overall_score}`,
    );

    if (WRITE) {
      await rest(`fwi_scores?date=eq.${row.date}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    }
  }

  console.log(WRITE ? 'Backfill written.' : 'Dry run complete. Re-run with --write to update Supabase.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
