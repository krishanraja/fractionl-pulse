import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { FWIData, Mover } from '@/lib/types';

/** Generate trailing N month labels as "YYYY-MM" strings relative to today */
function trailingMonths(count: number): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(d.toISOString().slice(0, 7));
  }
  return result;
}

// Placeholder baseline shown before the pipeline has ever run.
// All values are zero/empty to avoid presenting fabricated data as real.
const BASELINE: FWIData = {
  asOf: new Date().toISOString().slice(0, 10),
  weights: { demand: 0.5, supply: 0.2, culture: 0.3 },
  monthly: {
    months: trailingMonths(12),
    overall: [0,0,0,0,0,0,0,0,0,0,0,0],
    demand:  [0,0,0,0,0,0,0,0,0,0,0,0],
    supply:  [0,0,0,0,0,0,0,0,0,0,0,0],
    culture: [0,0,0,0,0,0,0,0,0,0,0,0]
  },
  today: {
    overall: 0,
    delta30d: 0,
    demand: { score: 0, delta30d: 0 },
    supply: { score: 50, delta30d: 0 },
    culture: { score: 0, delta30d: 0 }
  },
  movers: []
};

/** Maximum age (in ms) before live data is considered stale (48 hours) */
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

interface UseFWIDataReturn {
  data: FWIData;
  isLive: boolean;
  isLoading: boolean;
  isStale: boolean;
  lastUpdated: string | null;
  hasPipelineData: boolean;
  hasBackfilledData: boolean;
  totalWeeks: number;
  refresh: () => void;
}

export function useFWIData(): UseFWIDataReturn {
  const [data, setData] = useState<FWIData>(BASELINE);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [hasBackfilledData, setHasBackfilledData] = useState(false);
  const [totalWeeks, setTotalWeeks] = useState(0);

  const load = useCallback(async () => {
    try {
      // Fetch up to 26 FWI scores (6 months of weekly data) for historical depth
      const { data: scoresDesc, error: scoreError } = await supabase
        .from('fwi_scores')
        .select('date, overall_score, demand_score, supply_score, momentum_score, weights, metadata')
        .order('date', { ascending: false })
        .limit(26);

      if (scoreError || !scoresDesc || scoresDesc.length === 0) {
        setIsLoading(false);
        return; // Use baseline
      }

      const scores = [...scoresDesc].reverse(); // chronological order

      // Fetch today's movers
      const latestDate = scores[scores.length - 1].date;
      const { data: moversRaw } = await supabase
        .from('movers')
        .select('skill, signal_type, change_pct, note')
        .eq('date', latestDate)
        .order('change_pct', { ascending: false })
        .limit(5);

      const latest = scores[scores.length - 1];
      // Find the score closest to 30 days ago for an accurate 4-week delta
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const prev = scores.length >= 2
        ? (scores.find(s => s.date <= thirtyDaysAgo) || scores[0])
        : null;
      const prevIsRecent = prev && prev.date === latest.date; // same record = no real comparison

      const roundDelta = (a: number, b: number) =>
        Math.round((a - b) * 10) / 10;

      const delta30d = prev && !prevIsRecent
        ? roundDelta(latest.overall_score, prev.overall_score)
        : 0;

      const liveData: FWIData = {
        asOf: latestDate,
        weights: {
          demand: (latest.weights as any)?.demand ?? 0.5,
          supply: (latest.weights as any)?.supply ?? 0.2,
          culture: (latest.weights as any)?.culture ?? (latest.weights as any)?.momentum ?? 0.3,
        },
        monthly: {
          months: scores.map(s => s.date.slice(0, 7)),
          overall: scores.map(s => Math.round(s.overall_score * 10) / 10),
          demand:  scores.map(s => Math.round(s.demand_score * 10) / 10),
          supply:  scores.map(s => Math.round(s.supply_score * 10) / 10),
          culture: scores.map(s => Math.round(s.momentum_score * 10) / 10),
        },
        today: {
          overall: Math.round(latest.overall_score * 10) / 10,
          delta30d,
          demand: {
            score: Math.round(latest.demand_score * 10) / 10,
            delta30d: prev && !prevIsRecent ? roundDelta(latest.demand_score, prev.demand_score) : 0,
          },
          supply: {
            score: Math.round(latest.supply_score * 10) / 10,
            delta30d: prev && !prevIsRecent ? roundDelta(latest.supply_score, prev.supply_score) : 0,
          },
          culture: {
            score: Math.round(latest.momentum_score * 10) / 10,
            delta30d: prev && !prevIsRecent ? roundDelta(latest.momentum_score, prev.momentum_score) : 0,
          },
        },
        movers: (moversRaw || []).map(m => ({
          skill: m.skill,
          type: (m.signal_type === 'momentum' ? 'culture' : m.signal_type) as Mover['type'],
          change_pct: m.change_pct || 0,
          note: m.note || '',
        })),
      };

      // Detect staleness: data older than threshold (append T00:00:00Z to avoid local-timezone parsing)
      const dataAge = Date.now() - new Date(latestDate + 'T00:00:00Z').getTime();
      setIsStale(dataAge > STALE_THRESHOLD_MS);

      setData(liveData);
      setIsLive(true);
      setLastUpdated(latestDate);
      setTotalWeeks(scores.length);
      setHasBackfilledData(scores.some((s: any) => s.metadata?.backfilled));
    } catch (e) {
      console.error('FWI fetch error:', e);
      // Silently fall back to baseline
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Refresh every 12 hours
    const interval = setInterval(load, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return {
    data,
    isLive,
    isLoading,
    isStale,
    lastUpdated,
    hasPipelineData: isLive,
    hasBackfilledData,
    totalWeeks,
    refresh: load,
  };
}
