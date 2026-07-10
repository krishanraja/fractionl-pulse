// Presentation helpers for the index, so every surface renders a score the same way.
//
// The FWI is a 0–100 gauge, so its *level* is shown as a whole number: one-decimal
// precision on a 21-source blend is false precision, and the band boundaries
// (30/45/60/75) are integers, so rounding here keeps the number and its band label
// in lockstep — a shown "45" is always in the band the "45" legend points to.
//
// A *change* keeps one decimal: a move of a few tenths of a point is real signal
// that whole-number rounding would erase.

/** Round an index level (0–100) to the whole number shown in the UI. */
export function displayScore(score: number): number {
  return Math.round(score);
}

/**
 * One-decimal delta string carrying its own sign, e.g. "2.3", "-1.4", "0.0".
 * Never returns "-0.0": a value that rounds to zero reads as a clean "0.0".
 */
export function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(1);
}
