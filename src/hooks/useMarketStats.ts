import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface MarketStat {
  label: string;
  value: string;
  note: string;
  source: 'computed' | 'industry-estimate';
  citation?: string;
}

/**
 * Fetches computable market stats from the pipeline and falls back to
 * clearly-cited industry estimates where real data isn't available.
 */
export function useMarketStats() {
  const [stats, setStats] = useState<MarketStat[]>(getDefaultStats());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Fetch latest signals to compute "hottest roles" from Adzuna data
        const { data: signals } = await supabase
          .from('signals')
          .select('category, raw_value, date')
          .eq('source', 'adzuna')
          .in('category', ['cfo', 'cmo', 'cto', 'coo', 'cro', 'ceo'])
          .order('date', { ascending: false })
          .limit(12); // latest batch (6 roles × ~2 weeks)

        // Fetch FWI scores for YoY comparison
        const { data: scores } = await supabase
          .from('fwi_scores')
          .select('date, overall_score')
          .order('date', { ascending: false })
          .limit(52); // up to 1 year of weekly data

        const computed = getDefaultStats();

        // Compute "Hottest roles" from real Adzuna data
        if (signals && signals.length > 0) {
          const latestDate = signals[0].date;
          const latestSignals = signals.filter(s => s.date === latestDate);
          const roleNames: Record<string, string> = {
            cfo: 'CFO', cmo: 'CMO', cto: 'CTO', coo: 'COO', cro: 'CRO', ceo: 'CEO'
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

        // Compute YoY change from real FWI scores
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

        setStats(computed);
      } catch (e) {
        console.error('Market stats fetch error:', e);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  return { stats, isLoading };
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
