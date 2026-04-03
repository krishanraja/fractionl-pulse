import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface SignalContext {
  demand: string | null;
  supply: string | null;
  culture: string | null;
}

/**
 * Fetches the latest raw signal values and returns human-readable context
 * strings for each sub-index (e.g., "121 total fractional job listings").
 */
export function useSignalContext() {
  const [context, setContext] = useState<SignalContext>({
    demand: null,
    supply: null,
    culture: null,
  });

  useEffect(() => {
    async function load() {
      try {
        // Get the latest date with signals
        const { data: latestRow } = await supabase
          .from('signals')
          .select('date')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latestRow) return;

        const date = latestRow.date;

        // Fetch all signals for that date
        const { data: signals } = await supabase
          .from('signals')
          .select('source, signal_type, category, raw_value, normalized_value')
          .eq('date', date);

        if (!signals || signals.length === 0) return;

        // Build demand context
        const adzunaAggregate = signals.find(
          s => s.source === 'adzuna' && s.category === 'aggregate'
        );
        const secEdgar = signals.find(
          s => s.source === 'sec_edgar'
        );

        let demandParts: string[] = [];
        if (adzunaAggregate?.raw_value) {
          demandParts.push(`${Math.round(adzunaAggregate.raw_value)} job listings`);
        }
        if (secEdgar?.raw_value) {
          demandParts.push(`${Math.round(secEdgar.raw_value)} VC filings (90d)`);
        }

        // Build supply context
        const pdlAggregate = signals.find(
          s => s.source === 'people_data_labs' && s.category === 'aggregate'
        );
        const supplyTrends = signals.find(
          s => s.source === 'supply_trends'
        );

        let supplyParts: string[] = [];
        if (pdlAggregate?.raw_value) {
          supplyParts.push(`${Math.round(pdlAggregate.raw_value).toLocaleString()} profiles`);
        }
        if (supplyTrends?.raw_value != null) {
          supplyParts.push(`Supply intent: ${Math.round(supplyTrends.raw_value)}/100`);
        }
        const supplyCtx = supplyParts.length > 0 ? supplyParts.join(', ') : null;

        // Build culture/momentum context
        const trends = signals.find(s => s.source === 'google_trends');
        const news = signals.find(s => s.source === 'newsapi');

        let cultureParts: string[] = [];
        if (trends?.raw_value != null) {
          cultureParts.push(`Search interest: ${Math.round(trends.raw_value)}/100`);
        }
        if (news?.raw_value != null) {
          cultureParts.push(`${Math.round(news.raw_value)} articles (28d)`);
        }

        setContext({
          demand: demandParts.length > 0 ? demandParts.join(' + ') : null,
          supply: supplyCtx,
          culture: cultureParts.length > 0 ? cultureParts.join(', ') : null,
        });
      } catch (e) {
        console.error('Signal context fetch error:', e);
      }
    }

    load();
  }, []);

  return context;
}
