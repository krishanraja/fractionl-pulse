// The trial lane (docs/CITABILITY.md, "Rebuild plan"). Candidate inputs are
// collected daily and stored as signal_type 'candidate', which nothing that
// computes or publishes the index reads: v1 averages only demand, supply and
// momentum rows, and v2 votes only the sources in V2_SOURCES. A trial earns its
// way into the composite through the six-check entry gate and a ruling by
// Krish, measured by `npm run trial` (scripts/trial-evaluate.mjs).
//
// Pure definitions here; collection is in supabase/functions/collect-trials.

import type { Pillar } from './fwi-method.ts';

export interface TrialDef {
  source: string;
  pillar: Pillar;          // the pillar it would vote in if promoted
  replaces?: string;       // the input it would replace, if any
  what: string;
  backfill: 'archive' | 'stored' | 'none';
}

export const TRIALS: TrialDef[] = [
  { source: 'trial_google_jobs', pillar: 'demand', replaces: 'serpapi_jobs', backfill: 'none',
    what: 'Google Jobs results for six roles at depth 100. Production asks for 10, and CFO, CMO, COO and CTO read exactly 10 every day to 2026-10-23.' },
  { source: 'trial_podchaser_flow', pillar: 'culture', backfill: 'stored',
    what: 'New podcasts matching "fractional executive" per 7 days: the change in Podchaser\'s total, which as a stock sat at the normalizer ceiling.' },
  { source: 'trial_gdelt', pillar: 'culture', backfill: 'archive',
    what: 'GDELT count of news articles naming fractional C-suite roles over 7 days.' },
  { source: 'trial_wikipedia', pillar: 'culture', replaces: 'wikipedia_pageviews', backfill: 'archive',
    what: 'Wikipedia daily views of articles about interim and fractional executive work only, without the generic C-suite articles or "Fractional ownership".' },
  { source: 'trial_hn_wide', pillar: 'culture', replaces: 'hn', backfill: 'archive',
    what: 'Hacker News stories and comments naming fractional or interim C-suite roles over 30 days (production counts stories matching "fractional" only).' },
];

export const TRIAL_SOURCES = TRIALS.map((t) => t.source);
export const isTrial = (source: string) => source.startsWith('trial_');

// Log scale: `full` maps to 100, 0 maps to 0, clamped. Every trial count uses
// this so that no trial can sit at a floor or ceiling the way the retired
// inputs did without the audit seeing it.
export const logScale = (count: number, full: number) =>
  Math.max(0, Math.min(100, Math.round((Math.log10(Math.max(0, count) + 1) / Math.log10(full + 1)) * 100)));

export const SCALE_FULL = {
  trial_google_jobs: 200,     // same anchor as production job counts (200 postings = 100)
  trial_podchaser_flow: 200,  // new matching podcasts per week; ~25-60 observed
  trial_gdelt: 2000,          // articles per 7 days
  trial_wikipedia: 2000,      // mean daily views
  trial_hn_wide: 500,         // stories + comments per 30 days
} as const;

// A weekly flow from a cumulative total is only a reading when the total moved
// forward by a plausible amount. Podchaser's total fell by 588 and then rose by
// 475 within two weeks in July 2026: index rebuilds, not podcasts.
export function plausibleFlow(flow: number, priorFlows: number[]): boolean {
  if (!Number.isFinite(flow) || flow < 0) return false;
  if (priorFlows.length < 4) return true;
  const s = [...priorFlows].sort((a, b) => a - b);
  const med = s[Math.floor(s.length / 2)];
  return med <= 0 ? flow < 50 : flow <= 3 * med;
}

export const WIKI_TRIAL_PAGES = ['Interim_management', 'Fractional_executive', 'Fractional_CFO', 'Interim_executive'];
export const HN_TRIAL_PHRASES = ['fractional cfo', 'fractional cto', 'fractional cmo', 'fractional coo', 'fractional executive', 'interim cto', 'interim cfo'];
export const GDELT_TRIAL_QUERY = '("fractional cfo" OR "fractional cto" OR "fractional cmo" OR "fractional coo" OR "fractional executive")';
