// Core types for the Fractional Working Index application

export interface FWIContext {
  overallContext: string;
  demandContext: string;
  cultureContext: string;
  trendSummary: string;
}

export interface FWIData {
  asOf: string;
  weights: { demand: number; supply: number; culture: number };
  monthly: MonthlyData;
  today: TodayData;
  movers: Mover[];
  context?: FWIContext;
}

export interface MonthlyData {
  months: string[];
  /** Full ISO dates (yyyy-MM-dd) aligned to every series, so charts can plot on a
   *  real time axis instead of treating irregular readings as evenly-spaced months. */
  dates: string[];
  /** Per-reading pipeline confidence (0-1), aligned to the series, for honest styling. */
  confidence: number[];
  overall: number[];
  demand: number[];
  /** null = talent availability was not reliably measured that day (gap, not a crash). */
  supply: (number | null)[];
  culture: number[];
}

export interface TodayData {
  overall: number;
  delta30d: number;
  /** delta30d is null when there is no meaningful reading ~30 days ago to compare
   *  against, so the UI shows "new" instead of a from-zero artifact (e.g. +54.6
   *  against a near-zero backfill point, or +0.0 against an unmeasured pillar). */
  demand: { score: number; delta30d: number | null };
  /** score is null when supply has no reliable reading. */
  supply: { score: number | null; delta30d: number | null };
  culture: { score: number; delta30d: number | null };
}

export interface Mover {
  skill: string;
  type: 'demand' | 'supply' | 'culture';
  change_pct: number;
  note: string;
}

export interface AIInsight {
  id: string;
  type: 'summary' | 'prediction' | 'alert' | 'opportunity';
  title: string;
  body: string;
  confidence: number;
  generatedAt: string;
  relatedSignals: string[];
}

export interface DataSourceStatus {
  name: string;
  lastFetched: string | null;
  coverage: number;
  status: 'active' | 'stale' | 'error';
}

export interface AlertItem {
  label: string;
  score: number;
  delta: number;
  direction: 'up' | 'down';
}

// Composite calculator
export function calcComposite(
  data: TodayData, 
  weights: { demand: number; supply: number; culture: number }
): number {
  // When supply has no reliable reading, redistribute its weight across the
  // measured components so the composite reflects only real data (never a 0/50 stand-in).
  const hasSupply = data.supply.score != null;
  const w = hasSupply
    ? weights
    : (() => {
        const remaining = weights.demand + weights.culture;
        return { demand: weights.demand / remaining, supply: 0, culture: weights.culture / remaining };
      })();
  return Math.round(
    ((data.demand.score * w.demand) +
     ((data.supply.score ?? 0) * w.supply) +
     (data.culture.score * w.culture)) * 10
  ) / 10;
}
