import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { onDataChange } from '@/lib/realtime';

export interface SignalContext {
  demand: string | null;
  supply: string | null;
  culture: string | null;
  sources: string[];
}

const EMPTY_CONTEXT: SignalContext = { demand: null, supply: null, culture: null, sources: [] };

async function fetchSignalContext(): Promise<SignalContext> {
  const { data: latestRow } = await supabase
    .from('signals')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRow) return EMPTY_CONTEXT;

  const date = latestRow.date;

  const { data: signals } = await supabase
    .from('signals')
    .select('source, signal_type, category, raw_value, normalized_value, metadata')
    .eq('date', date);

  if (!signals || signals.length === 0) return EMPTY_CONTEXT;

  const find = (source: string, category?: string) =>
    signals.find(s => s.source === source && (!category || s.category === category));

  const activeSources = [...new Set(signals.map(s => s.source))];

  // --- Demand ---
  const demandParts: string[] = [];
  const adzunaAgg = find('adzuna', 'aggregate');
  const serpJobsAgg = find('serpapi_jobs', 'aggregate');
  const secEdgar = find('sec_edgar');

  if (adzunaAgg?.raw_value) demandParts.push(`${Math.round(adzunaAgg.raw_value)} Adzuna listings`);
  if (serpJobsAgg?.raw_value) demandParts.push(`${Math.round(serpJobsAgg.raw_value)} Google Jobs`);
  if (secEdgar?.raw_value) demandParts.push(`${Math.round(secEdgar.raw_value)} VC filings (90d)`);

  // --- Supply ---
  const supplyParts: string[] = [];
  const pdlAgg = find('people_data_labs', 'aggregate');
  const serpLinkedInAgg = find('serpapi_linkedin', 'aggregate');
  const goFractional = find('gofractional');
  const supplyTrends = find('supply_trends') || find('serpapi_supply_trends');

  if (pdlAgg?.raw_value) supplyParts.push(`${Math.round(pdlAgg.raw_value).toLocaleString()} PDL profiles`);
  if (serpLinkedInAgg?.raw_value) supplyParts.push(`~${Math.round(serpLinkedInAgg.raw_value).toLocaleString()} LinkedIn`);
  if (goFractional?.raw_value) {
    const rate = goFractional.metadata?.median_hourly_rate;
    supplyParts.push(
      `${Math.round(goFractional.raw_value)} GoFractional listings${rate ? ` ($${rate}/hr median)` : ''}`
    );
  }
  if (supplyTrends?.raw_value != null) supplyParts.push(`Supply intent: ${Math.round(supplyTrends.raw_value)}/100`);

  // --- Culture / Momentum ---
  const cultureParts: string[] = [];
  const trends = find('serpapi_trends') || find('google_trends');
  const news = find('newsapi');
  const mediastack = find('mediastack');
  const guardian = find('guardian');
  const nyt = find('nyt');
  const podchaser = find('podchaser');
  const reddit = find('reddit');
  const hn = find('hn');
  const braveNews = find('brave_news');
  const braveWeb = find('brave_web');

  if (trends?.raw_value != null) cultureParts.push(`Search interest: ${Math.round(trends.raw_value)}/100`);

  const totalArticles = (news?.raw_value || 0) + (mediastack?.raw_value || 0) + (braveNews?.raw_value || 0);
  if (totalArticles > 0) cultureParts.push(`${Math.round(totalArticles)} news articles`);

  const prestigeCount = (guardian?.raw_value || 0) + (nyt?.raw_value || 0);
  if (prestigeCount > 0) cultureParts.push(`${prestigeCount} prestige media hits`);

  if (podchaser?.raw_value) cultureParts.push(`${Math.round(podchaser.raw_value)} podcasts`);

  const communityPosts = (reddit?.raw_value || 0) + (hn?.raw_value || 0);
  if (communityPosts > 0) cultureParts.push(`${communityPosts} community posts`);

  if (braveWeb?.raw_value) cultureParts.push(`~${Math.round(braveWeb.raw_value).toLocaleString()} web mentions`);

  return {
    demand: demandParts.length > 0 ? demandParts.join(' + ') : null,
    supply: supplyParts.length > 0 ? supplyParts.join(', ') : null,
    culture: cultureParts.length > 0 ? cultureParts.join(', ') : null,
    sources: activeSources,
  };
}

export function useSignalContext() {
  const queryClient = useQueryClient();

  const { data: context = EMPTY_CONTEXT } = useQuery({
    queryKey: ['signal-context'],
    queryFn: fetchSignalContext,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    const unsub = onDataChange((payload) => {
      if (payload.table === 'signals') {
        queryClient.invalidateQueries({ queryKey: ['signal-context'] });
      }
    });
    return unsub;
  }, [queryClient]);

  return context;
}
