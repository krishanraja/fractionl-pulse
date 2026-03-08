import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { FWIData, Mover } from '@/lib/types';

// Pulse Supabase — public read only (anon key)
const supabase = createClient(
  'https://dtlcprcpvdomrehbejhw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bGNwcmNwdmRvbXJlaGJlamh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MTM3ODEsImV4cCI6MjA2OTM4OTc4MX0.bSvVAJb5Y2Tszq_AcvAHaNeJs5m--kFlRH4XZ2dfP_8'
);

// Fallback baseline data shown before real pipeline runs
const BASELINE: FWIData = {
  asOf: "2026-01-12",
  weights: { demand: 0.5, supply: 0.3, culture: 0.2 },
  monthly: {
    months: ["2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01"],
    overall: [52,54,56,57,59,61,62,63,65,66,67,68],
    demand:  [55,57,58,60,62,64,64,66,68,70,71,72],
    supply:  [49,51,54,55,57,58,60,61,63,64,64,65],
    culture: [44,46,47,49,50,53,54,54,56,56,57,58]
  },
  today: {
    overall: 68.4,
    delta30d: 4.2,
    demand: { score: 72, delta30d: 6.0 },
    supply: { score: 65, delta30d: 3.0 },
    culture: { score: 58, delta30d: 5.0 }
  },
  movers: [
    { skill: "Fractional CMO", type: "demand", change_pct: 12, note: "Enterprise RFP surge" },
    { skill: "AI Strategy Consultant", type: "supply", change_pct: 9, note: "Marketplace listings up" },
    { skill: "Fractional CFO", type: "demand", change_pct: 8, note: "Series A/B hiring cycle" },
    { skill: "Fractional CRO", type: "culture", change_pct: 7, note: "Search interest rising" },
    { skill: "Interim Ops Director", type: "demand", change_pct: 6, note: "Project-based hiring up" }
  ]
};

interface UseFWIDataReturn {
  data: FWIData;
  isLive: boolean;
  isLoading: boolean;
  lastUpdated: string | null;
  hasPipelineData: boolean;
}

export function useFWIData(): UseFWIDataReturn {
  const [data, setData] = useState<FWIData>(BASELINE);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
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
        const today = scores[scores.length - 1].date;
        const { data: moversRaw } = await supabase
          .from('movers')
          .select('role, signal_type, change_pct, note')
          .eq('date', today)
          .order('rank', { ascending: true })
          .limit(5);

        const latest = scores[scores.length - 1];
        const prev30 = scores.length >= 2 ? scores[Math.max(0, scores.length - 31)] : null;

        const delta30d = prev30
          ? Math.round((latest.overall_score - prev30.overall_score) * 10) / 10
          : 0;

        const liveData: FWIData = {
          asOf: today,
          weights: { demand: (latest.weights as any)?.demand ?? 0.5, supply: (latest.weights as any)?.supply ?? 0.3, culture: (latest.weights as any)?.culture ?? (latest.weights as any)?.momentum ?? 0.2 },
          monthly: {
            months: scores.map(s => s.date.slice(0, 7)),
            overall: scores.map(s => Math.round(s.overall_score * 10) / 10),
            demand:  scores.map(s => Math.round(s.demand_score * 10) / 10),
            supply:  scores.map(s => Math.round(s.supply_score * 10) / 10),
            culture: scores.map(s => Math.round(s.momentum_score * 10) / 10), // "Momentum" displayed as "Culture" in UI until component rename
          },
          today: {
            overall: Math.round(latest.overall_score * 10) / 10,
            delta30d,
            demand: {
              score: Math.round(latest.demand_score * 10) / 10,
              delta30d: prev30 ? Math.round((latest.demand_score - prev30.demand_score) * 10) / 10 : 0,
            },
            supply: {
              score: Math.round(latest.supply_score * 10) / 10,
              delta30d: prev30 ? Math.round((latest.supply_score - prev30.supply_score) * 10) / 10 : 0,
            },
            culture: {
              score: Math.round(latest.momentum_score * 10) / 10,
              delta30d: prev30 ? Math.round((latest.momentum_score - prev30.momentum_score) * 10) / 10 : 0,
            },
          },
          movers: (moversRaw || []).map(m => ({
            skill: m.role,
            type: (m.signal_type === 'momentum' ? 'culture' : m.signal_type) as Mover['type'],
            change_pct: m.change_pct || 0,
            note: m.note || '',
          })),
        };

        setData(liveData);
        setIsLive(true);
        setLastUpdated(today);
      } catch (e) {
        console.error('FWI fetch error:', e);
        // Silently fall back to baseline
      } finally {
        setIsLoading(false);
      }
    };

    load();

    // Refresh every 12 hours
    const interval = setInterval(load, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    data,
    isLive,
    isLoading,
    lastUpdated,
    hasPipelineData: isLive,
  };
}
