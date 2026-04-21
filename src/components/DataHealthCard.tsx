import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Database, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { onDataChange } from '@/lib/realtime';
import { fadeInUp, staggerContainer } from '@/lib/motion';

interface SourceHealth {
  source: string;
  status: string;
  last_checked: string | null;
  metadata: any;
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
  serpapi_jobs: { label: 'Google Jobs (SerpAPI)', category: 'Demand' },
  sec_edgar: { label: 'SEC EDGAR Filings', category: 'Demand' },
  people_data_labs: { label: 'People Data Labs', category: 'Supply' },
  serpapi_linkedin: { label: 'LinkedIn Profiles (SerpAPI)', category: 'Supply' },
  gofractional: { label: 'GoFractional Marketplace', category: 'Supply' },
  supply_trends: { label: 'Supply Search Trends', category: 'Supply' },
  serpapi_supply_trends: { label: 'Supply Intent (SerpAPI)', category: 'Supply' },
  google_trends: { label: 'Google Trends', category: 'Culture' },
  serpapi_trends: { label: 'Google Trends (SerpAPI)', category: 'Culture' },
  newsapi: { label: 'NewsAPI', category: 'Culture' },
  mediastack: { label: 'Mediastack News', category: 'Culture' },
  guardian: { label: 'The Guardian', category: 'Culture' },
  nyt: { label: 'New York Times', category: 'Culture' },
  podchaser: { label: 'Podchaser Podcasts', category: 'Culture' },
  reddit: { label: 'Reddit Communities', category: 'Culture' },
  hn: { label: 'Hacker News', category: 'Culture' },
  brave_news: { label: 'Brave News Search', category: 'Culture' },
  brave_web: { label: 'Brave Web Search', category: 'Culture' },
  fred: { label: 'FRED Macro Data', category: 'Context' },
  census_acs: { label: 'Census Bureau ACS', category: 'Context' },
};

const CATEGORY_ORDER = ['Demand', 'Supply', 'Culture', 'Context'];

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

  const getStatusIcon = (status: string) => {
    if (status === 'healthy' || status === 'ok') return <CheckCircle2 size={12} className="text-emerald-500" />;
    if (status === 'degraded' || status === 'stale') return <Clock size={12} className="text-yellow-500" />;
    if (status === 'error' || status === 'down') return <AlertCircle size={12} className="text-red-500" />;
    return <Clock size={12} className="text-muted-foreground/40" />;
  };

  const grouped = CATEGORY_ORDER.map(category => ({
    category,
    items: sources
      .filter(s => SOURCE_DISPLAY[s.source]?.category === category)
      .map(s => ({
        ...s,
        display: SOURCE_DISPLAY[s.source] || { label: s.source, category: 'Other' },
      })),
  })).filter(g => g.items.length > 0);

  const healthyCount = sources.filter(s => s.status === 'healthy' || s.status === 'ok').length;
  const totalTracked = Object.keys(SOURCE_DISPLAY).length;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Database size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground">Data Pipeline</h2>
            <p className="text-[10px] text-muted-foreground">
              {healthyCount > 0 ? `${healthyCount} of ${totalTracked}` : totalTracked} sources tracked
            </p>
          </div>
        </div>
        <span className="data-badge bg-primary/10 text-primary">
          {totalTracked} sources
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <motion.div key={group.category} variants={fadeInUp} className="space-y-2">
              <div className="section-label">{group.category}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items.map(item => (
                  <div
                    key={item.source}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/60 hover:border-primary/20 transition-colors"
                  >
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-foreground truncate block">
                        {item.display.label}
                      </span>
                      {item.last_checked && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {new Date(item.last_checked).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          {sources.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <Database size={24} className="mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Source health data will appear after the first pipeline run.
              </p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default DataHealthCard;
