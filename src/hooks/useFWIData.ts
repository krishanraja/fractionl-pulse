import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { onDataChange } from '@/lib/realtime';
import type { FWIData, FWIContext, Mover } from '@/lib/types';

function trailingMonths(count: number): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(d.toISOString().slice(0, 7));
  }
  return result;
}

const BASELINE: FWIData = {
  asOf: new Date().toISOString().slice(0, 10),
  weights: { demand: 0.5, supply: 0.2, culture: 0.3 },
  monthly: {
    months: trailingMonths(12),
    dates: trailingMonths(12).map(m => `${m}-01`),
    confidence: [0,0,0,0,0,0,0,0,0,0,0,0],
    overall: [0,0,0,0,0,0,0,0,0,0,0,0],
    demand:  [0,0,0,0,0,0,0,0,0,0,0,0],
    supply:  [null,null,null,null,null,null,null,null,null,null,null,null],
    culture: [0,0,0,0,0,0,0,0,0,0,0,0],
  },
  today: {
    overall: 0,
    delta30d: 0,
    demand: { score: 0, delta30d: 0 },
    supply: { score: 0, delta30d: 0 },
    culture: { score: 0, delta30d: 0 },
  },
  movers: [],
};

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const HISTORY_MONTHS = 12;

function buildContext(monthly: FWIData['monthly'], today: FWIData['today']): FWIContext {
  const overall = monthly.overall;
  const maxScore = Math.max(...overall);
  const minScore = Math.min(...overall);
  const isAtHigh = today.overall >= maxScore - 0.5;
  const isAtLow = today.overall <= minScore + 0.5;
  const monthsTracked = overall.length;

  const highMonth = monthly.months[overall.indexOf(maxScore)];
  const highLabel = highMonth ? new Date(highMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';

  const overallContext = isAtHigh
    ? `Highest reading in the last ${monthsTracked} months`
    : isAtLow
    ? `Lowest reading in the last ${monthsTracked} months`
    : today.delta30d > 0
    ? `Up ${today.delta30d.toFixed(1)} pts in 30 days. Peak was ${maxScore} in ${highLabel}`
    : `Down ${Math.abs(today.delta30d).toFixed(1)} pts in 30 days. Peak was ${maxScore} in ${highLabel}`;

  const demandDelta = today.demand.delta30d;
  const demandContext = demandDelta > 3
    ? 'Strong upward momentum; hiring activity accelerating'
    : demandDelta > 0
    ? 'Modest growth in fractional job postings'
    : demandDelta > -3
    ? 'Demand holding steady with slight softening'
    : 'Demand cooling. Fewer new fractional postings';

  const cultureDelta = today.culture.delta30d;
  const cultureContext = cultureDelta > 3
    ? 'Rising media coverage and search interest'
    : cultureDelta > 0
    ? 'Steady cultural awareness of fractional work'
    : 'Media attention tapering off this period';

  let streak = 0;
  for (let i = overall.length - 1; i > 0; i--) {
    if (overall[i] > overall[i - 1]) streak++;
    else break;
  }
  const trendSummary = streak >= 3
    ? `${streak} consecutive months of growth`
    : streak > 0
    ? `Trending up over the last ${streak} month${streak > 1 ? 's' : ''}`
    : 'Growth has stalled. Watch for recovery signals';

  return { overallContext, demandContext, cultureContext, trendSummary };
}

interface FWIResult {
  data: FWIData;
  isLive: boolean;
  isStale: boolean;
  lastUpdated: string | null;
  hasBackfilledData: boolean;
  hasLiveSupply: boolean;
  totalWeeks: number;
}

async function fetchFWIData(): Promise<FWIResult> {
  const historyStart = new Date();
  historyStart.setMonth(historyStart.getMonth() - HISTORY_MONTHS);

  const { data: scoresDesc, error: scoreError } = await supabase
    .from('fwi_scores')
    .select('date, overall_score, demand_score, supply_score, momentum_score, weights, confidence, metadata')
    .gte('date', historyStart.toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(370);

  if (scoreError || !scoresDesc || scoresDesc.length === 0) {
    return { data: { ...BASELINE, context: buildContext(BASELINE.monthly, BASELINE.today) }, isLive: false, isStale: false, lastUpdated: null, hasBackfilledData: false, hasLiveSupply: false, totalWeeks: 0 };
  }

  const allScores = [...scoresDesc].reverse();
  const scores = allScores.filter(s =>
    s.overall_score > 0 || s.demand_score > 0 || s.momentum_score > 0
  );

  if (scores.length === 0) {
    return { data: { ...BASELINE, context: buildContext(BASELINE.monthly, BASELINE.today) }, isLive: false, isStale: false, lastUpdated: null, hasBackfilledData: false, hasLiveSupply: false, totalWeeks: 0 };
  }

  const latestDate = scores[scores.length - 1].date;
  const { data: moversRaw } = await supabase
    .from('movers')
    .select('skill, signal_type, change_pct, note')
    .eq('date', latestDate)
    .order('change_pct', { ascending: false })
    .limit(5);

  // A non-null supply_score is now the source of truth for "we have a real reading"
  // (placeholder/floor values were nulled out in cleanup and are never written going forward).
  const hasRealSupply = scores.some(s => s.supply_score != null);

  // Frame the *charted* series to the most recent unbroken run of real talent-supply
  // readings. The supply sources have stretches where nothing was collected
  // (supply_score = null); rather than bridge those gaps with invented points, we display
  // the recent continuous window so the chart is gapless using only measured data. The
  // headline scores and 30-day deltas below still use the full history (`scores`), so a
  // genuine delta that reaches back past the displayed window is preserved.
  const supplyWindowStart = (() => {
    if (scores[scores.length - 1].supply_score == null) return 0; // latest unmeasured → don't trim
    let start = scores.length - 1;
    while (start > 0 && scores[start - 1].supply_score != null) start--;
    return start;
  })();
  const hasInteriorGap = scores.slice(0, supplyWindowStart).some(s => s.supply_score == null);
  // Only trim when it removes a real gap and still leaves a usable window.
  const displayScores = hasInteriorGap && scores.length - supplyWindowStart >= 3
    ? scores.slice(supplyWindowStart)
    : scores;

  const latest = scores[scores.length - 1];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const prev = scores.length >= 2
    ? (scores.find(s => s.date <= thirtyDaysAgo) || scores[0])
    : null;
  const prevIsRecent = prev && prev.date === latest.date;

  const roundDelta = (a: number, b: number) => Math.round((a - b) * 10) / 10;

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
      // displayScores = trailing continuous run of real supply readings (see above), so the
      // charted lines are gapless using only measured data — never fabricated bridge points.
      months: displayScores.map(s => s.date.slice(0, 7)),
      dates: displayScores.map(s => s.date),
      confidence: displayScores.map(s => typeof s.confidence === 'number' ? s.confidence : 0),
      overall: displayScores.map(s => Math.round(s.overall_score * 10) / 10),
      demand:  displayScores.map(s => Math.round(s.demand_score * 10) / 10),
      // null supply_score = unmeasured → kept as null so the chart shows a gap, not a crash to 0.
      supply:  displayScores.map(s => s.supply_score == null ? null : Math.round(s.supply_score * 10) / 10),
      culture: displayScores.map(s => Math.round(s.momentum_score * 10) / 10),
    },
    today: {
      overall: Math.round(latest.overall_score * 10) / 10,
      delta30d,
      demand: {
        score: Math.round(latest.demand_score * 10) / 10,
        delta30d: prev && !prevIsRecent ? roundDelta(latest.demand_score, prev.demand_score) : 0,
      },
      supply: {
        score: latest.supply_score == null ? null : Math.round(latest.supply_score * 10) / 10,
        // delta only meaningful when both endpoints are real readings.
        delta30d: prev && !prevIsRecent && latest.supply_score != null && prev.supply_score != null
          ? roundDelta(latest.supply_score, prev.supply_score)
          : 0,
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

  liveData.context = buildContext(liveData.monthly, liveData.today);

  const dataAge = Date.now() - new Date(latestDate + 'T00:00:00Z').getTime();
  const isStale = dataAge > STALE_THRESHOLD_MS;

  return {
    data: liveData,
    isLive: true,
    isStale,
    lastUpdated: latestDate,
    hasBackfilledData: scores.some((s: any) => s.metadata?.backfilled),
    hasLiveSupply: hasRealSupply,
    totalWeeks: scores.length,
  };
}

interface UseFWIDataReturn {
  data: FWIData;
  isLive: boolean;
  isLoading: boolean;
  isStale: boolean;
  lastUpdated: string | null;
  hasPipelineData: boolean;
  hasBackfilledData: boolean;
  hasLiveSupply: boolean;
  totalWeeks: number;
  refresh: () => void;
}

export function useFWIData(): UseFWIDataReturn {
  const queryClient = useQueryClient();

  const { data: result, isLoading } = useQuery({
    queryKey: ['fwi-data'],
    queryFn: fetchFWIData,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    const unsub = onDataChange((payload) => {
      if (payload.table === 'fwi_scores' || payload.table === 'signals') {
        queryClient.invalidateQueries({ queryKey: ['fwi-data'] });
      }
    });
    return unsub;
  }, [queryClient]);

  const fallback: FWIResult = {
    data: { ...BASELINE, context: buildContext(BASELINE.monthly, BASELINE.today) },
    isLive: false, isStale: false, lastUpdated: null,
    hasBackfilledData: false, hasLiveSupply: false, totalWeeks: 0,
  };

  const r = result ?? fallback;

  return {
    data: r.data,
    isLive: r.isLive,
    isLoading,
    isStale: r.isStale,
    lastUpdated: r.lastUpdated,
    hasPipelineData: r.isLive,
    hasBackfilledData: r.hasBackfilledData,
    hasLiveSupply: r.hasLiveSupply,
    totalWeeks: r.totalWeeks,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['fwi-data'] }),
  };
}
