import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { onDataChange } from '@/lib/realtime';

export interface MarketStat {
  label: string;
  value: string;
  note: string;
  source: 'computed' | 'industry-estimate';
  citation?: string;
}

function getDefaultStats(): MarketStat[] {
  return [
    {
      label: 'YoY index change',
      value: 'N/A',
      note: 'Requires 12+ months of pipeline data to compute',
      source: 'computed',
    },
    {
      label: 'Top industries',
      value: 'Tech, Healthcare, Finance',
      note: 'Highest fractional hiring activity by sector',
      source: 'industry-estimate',
      citation: 'A-Team/Staffing Industry Analysts, 2024',
    },
    {
      label: 'Avg engagement',
      value: '6-12 months',
      note: 'Typical fractional C-suite engagement length',
      source: 'industry-estimate',
      citation: 'Fractional Executive Alliance survey, 2024',
    },
    {
      label: 'Cost vs full-time',
      value: '40-60% less',
      note: 'Compared to full-time C-suite hire (salary + equity + benefits)',
      source: 'industry-estimate',
      citation: 'Harvard Business Review, 2023',
    },
    {
      label: 'Demand driver',
      value: 'Series A-C',
      note: 'Primary demand comes from venture-backed startups scaling fast',
      source: 'industry-estimate',
      citation: 'Based on SEC Form D filing analysis',
    },
    {
      label: 'Hottest roles',
      value: 'CFO, CMO, CTO',
      note: 'Default ranking - will update when pipeline data is available',
      source: 'industry-estimate',
    },
  ];
}

async function fetchMarketStats(): Promise<MarketStat[]> {
  const { data: signals } = await supabase
    .from('signals')
    .select('category, raw_value, date')
    .eq('source', 'adzuna')
    .in('category', ['cfo', 'cmo', 'cto', 'coo', 'cro', 'ceo'])
    .order('date', { ascending: false })
    .limit(12);

  const { data: scores } = await supabase
    .from('fwi_scores')
    .select('date, overall_score')
    .order('date', { ascending: false })
    .limit(52);

  const computed = getDefaultStats();

  if (signals && signals.length > 0) {
    const latestDate = signals[0].date;
    const latestSignals = signals.filter(s => s.date === latestDate);
    const roleNames: Record<string, string> = {
      cfo: 'CFO', cmo: 'CMO', cto: 'CTO', coo: 'COO', cro: 'CRO', ceo: 'CEO',
    };

    const sorted = [...latestSignals].sort((a, b) => (b.raw_value || 0) - (a.raw_value || 0));
    const top3 = sorted.slice(0, 3).map(s => roleNames[s.category] || s.category);

    if (top3.length > 0) {
      const hottestIdx = computed.findIndex(s => s.label === 'Hottest roles');
      if (hottestIdx >= 0) {
        computed[hottestIdx] = {
          label: 'Hottest roles',
          value: top3.join(', '),
          note: `Ranked by live Adzuna job posting volume as of ${latestDate}`,
          source: 'computed',
        };
      }
    }
  }

  if (scores && scores.length >= 2) {
    const latest = scores[0];
    const oneYearAgo = new Date(latest.date);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const yearAgoStr = oneYearAgo.toISOString().slice(0, 10);

    const baseline = scores.find(s => s.date <= yearAgoStr);
    if (baseline && baseline.overall_score > 0) {
      const pctChange = Math.round(((latest.overall_score - baseline.overall_score) / baseline.overall_score) * 100);
      const yoyIdx = computed.findIndex(s => s.label === 'YoY index change');
      if (yoyIdx >= 0) {
        computed[yoyIdx] = {
          label: 'YoY index change',
          value: `${pctChange >= 0 ? '+' : ''}${pctChange}%`,
          note: `FWI score change from ${baseline.date} to ${latest.date}`,
          source: 'computed',
        };
      }
    }
  }

  return computed;
}

export function useMarketStats() {
  const queryClient = useQueryClient();

  const { data: stats = getDefaultStats(), isLoading } = useQuery({
    queryKey: ['market-stats'],
    queryFn: fetchMarketStats,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    const unsub = onDataChange((payload) => {
      if (payload.table === 'fwi_scores' || payload.table === 'signals') {
        queryClient.invalidateQueries({ queryKey: ['market-stats'] });
      }
    });
    return unsub;
  }, [queryClient]);

  return { stats, isLoading };
}
