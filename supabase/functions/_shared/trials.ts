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
  // A text match (a search phrase or keyword) must pass gate check 0: a dated,
  // recorded sample of what it matched (docs/trial-relevance.json).
  textMatch: boolean;
  // Exempt from the one-publisher rule because the query is confined to a
  // single site by design (Reddit, Hacker News).
  singleSite?: boolean;
}

export const TRIALS: TrialDef[] = [
  { source: 'trial_google_jobs', pillar: 'demand', replaces: 'serpapi_jobs', backfill: 'none', textMatch: true,
    what: 'Google Jobs results for six roles at depth 100. Production asks for 10, and CFO, CMO, COO and CTO read exactly 10 every day to 2026-10-23.' },
  { source: 'trial_podchaser_relevant', pillar: 'culture', backfill: 'archive', textMatch: true, singleSite: true,
    what: 'New podcasts in the last 90 days whose title or description names fractional executive work, from the 100 newest Podchaser matches for each of four role terms. Replaces trial_podchaser_flow, whose fuzzy search made about 3 of 50 matches relevant.' },
  { source: 'trial_brave_news', pillar: 'culture', backfill: 'none', textMatch: true,
    what: 'Distinct sites publishing on the role terms in Brave News over the past week. Counting results let one SEO publisher supply 16 of 22 on 2026-10-23 (Ruling, Krish, 2026-10-23: count distinct sites).' },
  { source: 'trial_brave_web', pillar: 'culture', backfill: 'none', textMatch: true,
    what: 'Brave web results over the past week for each role term, paged until Brave reports no more: "fractional CFO" returned 10 with none left on 2026-10-23.' },
  { source: 'trial_reddit', pillar: 'culture', backfill: 'none', textMatch: true, singleSite: true,
    what: 'Reddit results via Brave over the past month, paged until none are left. Past week and past day both returned 0 on 2026-10-23.' },
];

// Not repairable, on test (2026-10-23): LinkedIn talent via Brave returns 0
// for any time filter, so the page-capped count cannot become a flow; the
// DataForSEO LinkedIn count remains the LinkedIn input. GoFractional is a
// published marketing figure, not a measurement.

// Dropped (Ruling, Krish, 2026-10-23): trial_gdelt. GDELT counted only 3 to 7
// matching articles a week and its timeline had a gap from 14 September to
// 20 October 2026, so it failed the provenance check. Its 23 stored candidate
// rows are kept as the record of why.
// Dropped (Ruling, Krish, 2026-10-23), on a relevance sample (diagnose=guardian
// and diagnose=relevance): trial_guardian, all 7 "fractional" matches over 90
// days unrelated (cricket, F1, fractional jet ownership) and its "interim CEO"
// matches mentions of named executives; trial_mediastack, about 1 in 21
// "fractional" matches on topic. The original inputs' retirement was right.
// trial_podchaser_flow failed gate check 0 the same day: Podchaser's search is
// fuzzy, so its weekly total counted mostly unrelated new podcasts ("Sex, Death
// & Olive Oil", "AI and Autism"); replaced by trial_podchaser_relevant.
export const DROPPED_TRIALS = ['trial_gdelt', 'trial_guardian', 'trial_mediastack', 'trial_podchaser_flow'];

export const PODCHASER_TERMS = ['fractional executive', 'fractional CFO', 'fractional CMO', 'fractional CTO'];
export const FRACTIONAL_WORK = /\bfractional\s+(c[a-z]os?|chief|executives?|execs?|leaders?|leadership)\b/i;

// Promoted into the composite at the 2026-10-26 seam (Ruling, Krish,
// 2026-10-23) after passing the gate; collect-trials keeps collecting them,
// now for the score, and writes their health rows.
export const PROMOTED = ['trial_wikipedia', 'trial_hn_wide', 'trial_trends'];

export const TRIAL_SOURCES = TRIALS.map((t) => t.source);
export const isTrial = (source: string) => source.startsWith('trial_');

// Log scale: `full` maps to 100, 0 maps to 0, clamped. Every trial count uses
// this so that no trial can sit at a floor or ceiling the way the retired
// inputs did without the audit seeing it.
export const logScale = (count: number, full: number) =>
  Math.max(0, Math.min(100, Math.round((Math.log10(Math.max(0, count) + 1) / Math.log10(full + 1)) * 100)));

export const SCALE_FULL = {
  trial_google_jobs: 200,     // same anchor as production job counts (200 postings = 100)
  trial_podchaser_relevant: 50, // relevant new podcasts per 90 days; ~4-5 a month observed
  trial_wikipedia: 2000,      // mean daily views
  trial_hn_wide: 500,         // stories + comments per 30 days
  trial_brave_news: 50,       // distinct sites per week
  trial_brave_web: 200,       // results per week across the role terms
  trial_reddit: 100,          // results per month
} as const;

export const BRAVE_ROLE_TERMS = ['"fractional CFO"', '"fractional CMO"', '"fractional CTO"', '"fractional executive"'];
// Kept only for collect-trials ?diagnose=guardian, the test that dropped it.
export const GUARDIAN_TRIAL_QUERY = '"interim chief executive" OR "interim CEO" OR "interim finance director" OR "interim chief financial officer" OR "fractional"';

// Trends rescored against its own recent history: 50 + 10z over the trailing
// window, clamped. A raw series moving inside a narrow band still moves.
export function trailingZScore(value: number, trailing: number[]): number | null {
  const t = trailing.filter((x) => Number.isFinite(x));
  if (t.length < 7) return null;
  const m = t.reduce((a, b) => a + b, 0) / t.length;
  const sd = Math.sqrt(t.reduce((a, b) => a + (b - m) ** 2, 0) / t.length);
  if (!sd) return null;
  return Math.max(0, Math.min(100, Math.round(50 + 10 * ((value - m) / sd))));
}

export const WIKI_TRIAL_PAGES = ['Interim_management', 'Fractional_executive', 'Fractional_CFO', 'Interim_executive'];
export const HN_TRIAL_PHRASES = ['fractional cfo', 'fractional cto', 'fractional cmo', 'fractional coo', 'fractional executive', 'interim cto', 'interim cfo'];
