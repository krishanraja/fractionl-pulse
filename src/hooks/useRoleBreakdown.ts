import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface RoleSignal {
  category: string;
  label: string;
  rawValue: number;
  score: number;
  prevScore: number | null;
  wowChange: number | null;
}

const ROLE_LABELS: Record<string, string> = {
  cfo: 'Fractional CFO',
  cmo: 'Fractional CMO',
  cto: 'Fractional CTO',
  coo: 'Fractional COO',
  cro: 'Fractional CRO',
  ceo: 'Interim CEO',
};

export function useRoleBreakdown() {
  const [roles, setRoles] = useState<RoleSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Get the two most recent dates that have adzuna signals
        const { data: dates } = await supabase
          .from('signals')
          .select('date')
          .eq('source', 'adzuna')
          .neq('category', 'aggregate')
          .order('date', { ascending: false })
          .limit(12); // 6 roles x 2 dates

        if (!dates || dates.length === 0) {
          setIsLoading(false);
          return;
        }

        const uniqueDates = [...new Set(dates.map(d => d.date))].sort().reverse();
        const latestDate = uniqueDates[0];
        const prevDate = uniqueDates.length >= 2 ? uniqueDates[1] : null;

        // Fetch latest role signals
        const { data: latest } = await supabase
          .from('signals')
          .select('category, raw_value, normalized_value')
          .eq('source', 'adzuna')
          .eq('date', latestDate)
          .neq('category', 'aggregate');

        // Fetch previous week for WoW comparison
        let prevMap: Record<string, number> = {};
        if (prevDate) {
          const { data: prev } = await supabase
            .from('signals')
            .select('category, normalized_value')
            .eq('source', 'adzuna')
            .eq('date', prevDate)
            .neq('category', 'aggregate');

          if (prev) {
            for (const s of prev) {
              prevMap[s.category] = s.normalized_value;
            }
          }
        }

        if (latest && latest.length > 0) {
          const mapped: RoleSignal[] = latest
            .filter(s => ROLE_LABELS[s.category])
            .map(s => {
              const prevScore = prevMap[s.category] ?? null;
              return {
                category: s.category,
                label: ROLE_LABELS[s.category],
                rawValue: s.raw_value || 0,
                score: s.normalized_value || 0,
                prevScore,
                wowChange: prevScore !== null
                  ? Math.round((s.normalized_value - prevScore) * 10) / 10
                  : null,
              };
            })
            .sort((a, b) => b.rawValue - a.rawValue);

          setRoles(mapped);
          setAsOf(latestDate);
        }
      } catch (e) {
        console.error('Role breakdown fetch error:', e);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  return { roles, isLoading, asOf };
}
