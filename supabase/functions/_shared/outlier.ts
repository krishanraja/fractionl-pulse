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
