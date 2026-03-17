import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { FWIData, Mover } from '@/lib/types';

// Fallback baseline data shown before real pipeline runs
const BASELINE: FWIData = {
  asOf: "2026-03-16",
  weights: { demand: 0.5, supply: 0.3, culture: 0.2 },
  monthly: {
    months: ["2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03"],
    overall: [56,57,59,61,62,63,65,66,67,68,69,71],
    demand:  [58,60,62,64,64,66,68,70,71,72,74,75],
    supply:  [54,55,57,58,60,61,63,64,64,65,66,67],
    culture: [47,49,50,53,54,54,56,56,57,58,59,61]
  },
  today: {
    overall: 71.0,
    delta30d: 2.0,
    demand: { score: 75, delta30d: 3.0 },
    supply: { score: 67, delta30d: 2.0 },
    culture: { score: 61, delta30d: 3.0 }
  },
  movers: [
    { skill: "Fractional CMO", type: "demand", change_pct: 12, note: "Enterprise RFP surge" },
    { skill: "AI Strategy Consultant", type: "supply", change_pct: 9, note: "Marketplace listings up" },
    { skill: "Fractional CFO", type: "demand", change_pct: 8, note: "Series A/B hiring cycle" },
    { skill: "Fractional CRO", type: "culture", change_pct: 7, note: "Search interest rising" },
    { skill: "Interim Ops Director", type: "demand", change_pct: 6, note: "Project-based hiring up" }
  ]
};

/** Maximum age (in ms) before live data is considered stale — 48 hours */
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

interface UseFWIDataReturn {
  data: FWIData;
  isLive: boolean;
  isLoading: boolean;
  isStale: boolean;
  lastUpdated: string | null;
  hasPipelineData: boolean;
  refresh: () => void;
}

export function useFWIData(): UseFWIDataReturn {
  const [data, setData] = useState<FWIData>(BASELINE);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Fetch last 12 FWI scores
      const { data: scores, error: scoreError } = await supabase
        .from('fwi_scores')
        .select('date, overall_score, demand_score, supply_score, momentum_score, weights')
        .order('date', { ascending: true })
        .limit(12);

      if (scoreError || !scores || scores.length === 0) {
        setIsLoading(false);
        return; // Use baseline
      }

      // Fetch today's movers
      const latestDate = scores[scores.length - 1].date;
      const { data: moversRaw } = await supabase
        .from('movers')
        .select('skill, signal_type, change_pct, note')
        .eq('date', latestDate)
        .order('change_pct', { ascending: false })
        .limit(5);

      const latest = scores[scores.length - 1];
      // Use the second-to-last score as the 30-day comparison (each record ≈ 1 month)
      const prev = scores.length >= 2 ? scores[scores.length - 2] : null;

      const delta30d = prev
        ? Math.round((latest.overall_score - prev.overall_score) * 10) / 10
        : 0;

      const liveData: FWIData = {
        asOf: latestDate,
        weights: {
          demand: (latest.weights as any)?.demand ?? 0.5,
          supply: (latest.weights as any)?.supply ?? 0.3,
          culture: (latest.weights as any)?.culture ?? (latest.weights as any)?.momentum ?? 0.2,
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
            delta30d: prev ? Math.round((latest.demand_score - prev.demand_score) * 10) / 10 : 0,
          },
          supply: {
            score: Math.round(latest.supply_score * 10) / 10,
            delta30d: prev ? Math.round((latest.supply_score - prev.supply_score) * 10) / 10 : 0,
          },
          culture: {
            score: Math.round(latest.momentum_score * 10) / 10,
            delta30d: prev ? Math.round((latest.momentum_score - prev.momentum_score) * 10) / 10 : 0,
          },
        },
        movers: (moversRaw || []).map(m => ({
          skill: m.skill,
          type: (m.signal_type === 'momentum' ? 'culture' : m.signal_type) as Mover['type'],
          change_pct: m.change_pct || 0,
          note: m.note || '',
        })),
      };

      // Detect staleness — data older than threshold
      const dataAge = Date.now() - new Date(latestDate).getTime();
      setIsStale(dataAge > STALE_THRESHOLD_MS);

      setData(liveData);
      setIsLive(true);
      setLastUpdated(latestDate);
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
    refresh: load,
  };
}
