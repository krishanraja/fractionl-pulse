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
        const supplySignals = signals.filter(s => s.signal_type === 'supply');
        let supplyCtx: string | null = null;
        if (supplySignals.length > 0 && supplySignals.some(s => s.source !== 'baseline')) {
          const total = supplySignals.reduce((sum, s) => sum + (s.raw_value || 0), 0);
          supplyCtx = `${Math.round(total)} active profiles found`;
        }

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
