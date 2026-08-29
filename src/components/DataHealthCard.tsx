import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Clock, Database } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { onDataChange } from '@/lib/realtime';
import { fadeInUp, staggerContainer } from '@/lib/motion';

interface SourceHealth {
  source: string;
  status: string;
  last_checked: string | null;
  metadata: Record<string, unknown> | null;
}

async function fetchSourceHealth(): Promise<SourceHealth[]> {
  const { data } = await supabase
    .from('data_source_health')
    .select('source, status, last_checked, metadata')
    .order('source');
  return data ?? [];
}

const SOURCE_DISPLAY: Record<string, { label: string; category: string }> = {
  adzuna: { label: 'Adzuna Jobs', category: 'Demand' },
  serpapi_jobs: { label: 'Google Jobs (DataForSEO)', category: 'Demand' },
  sec_edgar: { label: 'SEC EDGAR Filings', category: 'Demand' },
  serpapi_linkedin: { label: 'LinkedIn Profiles (DataForSEO)', category: 'Supply' },
  brave_talent: { label: 'LinkedIn Profiles (Brave)', category: 'Supply' },
  gofractional: { label: 'GoFractional Marketplace', category: 'Supply' },
  serpapi_supply_trends: { label: 'Supply Intent (DataForSEO)', category: 'Supply' },
  serpapi_trends: { label: 'Search Trends (DataForSEO)', category: 'Culture' },
  newsapi: { label: 'NewsAPI', category: 'Culture' },
  mediastack: { label: 'Mediastack News', category: 'Culture' },
  guardian: { label: 'The Guardian', category: 'Culture' },
  podchaser: { label: 'Podchaser Podcasts', category: 'Culture' },
  reddit: { label: 'Reddit Communities', category: 'Culture' },
  hn: { label: 'Hacker News', category: 'Culture' },
  brave_news: { label: 'Brave News Search', category: 'Culture' },
  brave_web: { label: 'Brave Web Search', category: 'Culture' },
  wikipedia_pageviews: { label: 'Wikipedia Pageviews', category: 'Culture' },
  fred: { label: 'FRED Macro Data', category: 'Context' },
  census_acs: { label: 'Census Bureau ACS', category: 'Context' },
  bls: { label: 'BLS (JOLTS / wages)', category: 'Context' },
  openalex: { label: 'OpenAlex Research', category: 'Context' },
};

const CATEGORY_ORDER = ['Demand', 'Supply', 'Culture', 'Context'];
const CATEGORY_LABELS: Record<string, string> = {
  Demand: 'Hiring demand',
  Supply: 'Executive availability',
  Culture: 'Market interest',
  Context: 'Economic context',
};

const statusDisplay = (status: string): { label: string; tone: string; Icon: LucideIcon } => {
  if (status === 'healthy' || status === 'ok') return { label: 'Healthy', tone: 'is-healthy', Icon: CheckCircle2 };
  if (status === 'degraded' || status === 'stale') return { label: 'Needs attention', tone: 'is-stale', Icon: Clock };
  if (status === 'error' || status === 'down' || status === 'failed') return { label: 'Unavailable', tone: 'is-unavailable', Icon: AlertCircle };
  return { label: 'Status unknown', tone: 'is-unknown', Icon: Clock };
};

const DataHealthCard = () => {
  const queryClient = useQueryClient();
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['data-source-health'],
    queryFn: fetchSourceHealth,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    const unsub = onDataChange((payload) => {
      if (payload.table === 'data_source_health') {
        queryClient.invalidateQueries({ queryKey: ['data-source-health'] });
      }
    });
    return unsub;
  }, [queryClient]);

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: sources
      .filter((source) => SOURCE_DISPLAY[source.source]?.category === category)
      .map((source) => ({
        ...source,
        display: SOURCE_DISPLAY[source.source] || { label: source.source, category: 'Other' },
      })),
  })).filter((group) => group.items.length > 0);

  const healthyCount = sources.filter(
    (source) => SOURCE_DISPLAY[source.source] && (source.status === 'healthy' || source.status === 'ok'),
  ).length;
  const totalTracked = Object.keys(SOURCE_DISPLAY).length;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="pulse-source-register">
      <header className="pulse-register-header">
        <span className="pulse-register-icon" aria-hidden="true"><Database /></span>
        <div>
          <h2>Live source health</h2>
          <p>{healthyCount > 0 ? `${healthyCount} of ${totalTracked} reporting normally` : `${totalTracked} inputs tracked`}</p>
        </div>
        <strong className="pulse-register-count">{totalTracked} inputs</strong>
      </header>

      {isLoading ? (
        <div className="pulse-source-loading" role="status" aria-live="polite" aria-label="Loading source health">
          {[1, 2, 3].map((item) => <span key={item} />)}
        </div>
      ) : (
        <div className="pulse-source-groups">
          {grouped.map((group) => (
            <motion.section key={group.category} variants={fadeInUp} className="pulse-source-group">
              <h3>{CATEGORY_LABELS[group.category] ?? group.category}</h3>
              <div className="pulse-source-grid">
                {group.items.map((item) => {
                  const status = statusDisplay(item.status);
                  const StatusIcon = status.Icon;
                  return (
                    <article key={item.source} className={`pulse-source-row ${status.tone}`}>
                      <span className="pulse-source-status-icon" aria-hidden="true"><StatusIcon /></span>
                      <div>
                        <strong>{item.display.label}</strong>
                        <span>
                          {status.label}{item.last_checked ? ` · checked ${new Date(item.last_checked).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </motion.section>
          ))}

          {sources.length === 0 && (
            <div className="pulse-register-empty">
              <Database aria-hidden="true" />
              <p>Source health will appear after the next validated pipeline run.</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default DataHealthCard;
