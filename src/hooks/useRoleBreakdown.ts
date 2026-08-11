import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { onDataChange } from '@/lib/realtime';

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

interface RoleResult {
  roles: RoleSignal[];
  asOf: string | null;
}

async function fetchRoleBreakdown(): Promise<RoleResult> {
  const { data: dates } = await supabase
    .from('signals')
    .select('date')
    .eq('source', 'adzuna')
    .neq('category', 'aggregate')
    .order('date', { ascending: false })
    .limit(12);

  if (!dates || dates.length === 0) return { roles: [], asOf: null };

  const uniqueDates = [...new Set(dates.map(d => d.date))].sort().reverse();
  const latestDate = uniqueDates[0];
  const prevDate = uniqueDates.length >= 2 ? uniqueDates[1] : null;

  const { data: latest } = await supabase
    .from('signals')
    .select('category, raw_value, normalized_value')
    .eq('source', 'adzuna')
    .eq('date', latestDate)
    .neq('category', 'aggregate');

  const prevMap: Record<string, number> = {};
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

  if (!latest || latest.length === 0) return { roles: [], asOf: null };

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

  return { roles: mapped, asOf: latestDate };
}

export function useRoleBreakdown() {
  const queryClient = useQueryClient();

  const { data: result, isLoading } = useQuery({
    queryKey: ['role-breakdown'],
    queryFn: fetchRoleBreakdown,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    const unsub = onDataChange((payload) => {
      if (payload.table === 'signals') {
        queryClient.invalidateQueries({ queryKey: ['role-breakdown'] });
      }
    });
    return unsub;
  }, [queryClient]);

  return {
    roles: result?.roles ?? [],
    isLoading,
    asOf: result?.asOf ?? null,
  };
}
