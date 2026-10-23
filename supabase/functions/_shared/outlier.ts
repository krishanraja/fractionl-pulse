// Ratio outlier guard for provider result counts.
//
// Some collectors store a search engine's estimated result count. That estimate
// is not stable: the same query reads ~40,000 one day and ~50 the next. A
// z-score guard cannot catch this once the history holds both modes, and the
// count is published as a market reading, so a reading far outside the
// source's own recent level is treated as missing rather than as a value.

export const RATIO_OUTLIER_FACTOR = 10;
export const RATIO_OUTLIER_MIN_HISTORY = 5;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * True when `value` is more than `factor` times above, or below 1/factor of,
 * the median of `history`. With too little history, or a non-positive median,
 * there is nothing to judge against and the value is accepted.
 */
export function isRatioOutlier(
  value: number,
  history: number[],
  factor: number = RATIO_OUTLIER_FACTOR,
  minHistory: number = RATIO_OUTLIER_MIN_HISTORY,
): boolean {
  const usable = history.filter((v) => Number.isFinite(v) && v > 0);
  if (usable.length < minHistory || !Number.isFinite(value) || value <= 0) return false;
  const m = median(usable);
  if (m <= 0) return false;
  const ratio = value / m;
  return ratio > factor || ratio < 1 / factor;
}

// Anomaly guard, hold-then-confirm (FWI method v2, Ruling, Krish, 2026-10-23).
//
// The v1 guard rejected any reading more than 3 standard deviations from the
// source's recent stored readings, and never stored what it rejected. A real
// level change therefore kept being compared with the old level and rejected
// day after day: NewsAPI fell from about 21 to about 12 articles on 2026-10-13
// and was rejected for nine days. Now an outlier is held for one day (stored
// visibly, never scored). If the next reading sits at the held level, the
// change is real and is accepted; a one-off spike is still dropped.

export const ANOMALY_Z = 3;
export const ANOMALY_MIN_HISTORY = 3;
export const ANOMALY_MIN_SD = 1;

export type AnomalyDecision =
  | { action: 'accept'; reason: 'no-history' | 'low-variance' | 'in-range' }
  | { action: 'confirm'; z: number; held: number }
  | { action: 'hold'; z: number; mean: number; sd: number };

export function anomalyDecision(value: number, history: number[], heldYesterday: number | null = null): AnomalyDecision {
  const h = history.filter((v) => Number.isFinite(v));
  if (h.length < ANOMALY_MIN_HISTORY) return { action: 'accept', reason: 'no-history' };
  const mean = h.reduce((a, b) => a + b, 0) / h.length;
  const sd = Math.sqrt(h.reduce((s, v) => s + (v - mean) ** 2, 0) / h.length);
  if (sd < ANOMALY_MIN_SD) return { action: 'accept', reason: 'low-variance' };
  const z = Math.abs(value - mean) / sd;
  if (z <= ANOMALY_Z) return { action: 'accept', reason: 'in-range' };
  // Same tolerance as the guard itself: the new reading confirms the held one
  // when it is within ANOMALY_Z of the old spread from it.
  if (heldYesterday != null && Math.abs(value - heldYesterday) <= ANOMALY_Z * sd) {
    return { action: 'confirm', z: Math.round(z * 10) / 10, held: heldYesterday };
  }
  return { action: 'hold', z: Math.round(z * 10) / 10, mean: Math.round(mean * 10) / 10, sd: Math.round(sd * 10) / 10 };
}
