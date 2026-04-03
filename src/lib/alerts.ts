import type { FWIData, AlertItem } from './types';

/**
 * Checks FWI data against user alert threshold and returns any triggered alerts.
 * Pure function - no side effects, no storage.
 */
export function checkAlerts(data: FWIData, threshold: number): AlertItem[] {
  if (threshold <= 0) return [];

  const checks = [
    { label: 'Overall FWI', score: data.today.overall, delta: data.today.delta30d },
    { label: 'Hiring activity', score: data.today.demand.score, delta: data.today.demand.delta30d },
    { label: 'Talent availability', score: data.today.supply.score, delta: data.today.supply.delta30d },
    { label: 'Market buzz', score: data.today.culture.score, delta: data.today.culture.delta30d },
  ];

  return checks
    .filter(c => Math.abs(c.delta) >= threshold)
    .map(c => ({
      label: c.label,
      score: c.score,
      delta: c.delta,
      direction: c.delta >= 0 ? 'up' as const : 'down' as const,
    }));
}
