import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, BrainCircuit, Lightbulb, Sparkles, Target, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { onDataChange } from '@/lib/realtime';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import type { AIInsight } from '@/lib/types';

function normalizeConfidence(value: number | undefined): number {
  if (value == null) return 80;
  if (value > 0 && value <= 1) return Math.round(value * 100);
  return Math.round(Math.min(100, Math.max(0, value)));
}

const FALLBACK_INSIGHTS: AIInsight[] = [];
const INSIGHT_CONFIG: Record<AIInsight['type'], { icon: LucideIcon; label: string; tone: string }> = {
  summary: { icon: BrainCircuit, label: 'Market read', tone: 'is-summary' },
  prediction: { icon: TrendingUp, label: 'Directional read', tone: 'is-prediction' },
  trend: { icon: Target, label: 'Pattern to watch', tone: 'is-trend' },
  alert: { icon: AlertTriangle, label: 'Watch closely', tone: 'is-alert' },
  opportunity: { icon: Lightbulb, label: 'Possible opening', tone: 'is-opportunity' },
  recommendation: { icon: Sparkles, label: 'What to consider', tone: 'is-recommendation' },
};

interface AIInsightsProps {
  compact?: boolean;
}

function parseInsight(value: unknown, index: number, generatedAt: string): AIInsight {
  const record = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const validTypes: AIInsight['type'][] = ['summary', 'prediction', 'alert', 'opportunity', 'trend', 'recommendation'];
  const type = typeof record.type === 'string' && validTypes.includes(record.type as AIInsight['type'])
    ? record.type as AIInsight['type']
    : 'summary';
  const relatedSignals = Array.isArray(record.relatedSignals)
    ? record.relatedSignals.filter((signal): signal is string => typeof signal === 'string')
    : [];

  return {
    id: String(index + 1),
    type,
    title: typeof record.title === 'string' ? record.title : 'Insight',
    body: typeof record.body === 'string' ? record.body : '',
    confidence: normalizeConfidence(typeof record.confidence === 'number' ? record.confidence : undefined),
    generatedAt,
    relatedSignals,
  };
}

async function fetchCachedInsights(): Promise<{ insights: AIInsight[]; isLive: boolean; lastUpdated: string | null }> {
  const { data } = await supabase
    .from('cached_insights')
    .select('insights_json, generated_at, valid_until')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isExpired = Boolean(data?.valid_until && new Date(data.valid_until).getTime() < Date.now());
  if (data?.insights_json && Array.isArray(data.insights_json) && data.insights_json.length > 0 && !isExpired) {
    return {
      insights: data.insights_json.map((insight, index) => parseInsight(insight, index, data.generated_at)),
      isLive: true,
      lastUpdated: data.generated_at,
    };
  }
  return { insights: [], isLive: false, lastUpdated: null };
}

const AIInsights = ({ compact = false }: AIInsightsProps) => {
  const queryClient = useQueryClient();
  const { data: cached } = useQuery({
    queryKey: ['cached-insights'],
    queryFn: fetchCachedInsights,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const insights = cached?.insights ?? FALLBACK_INSIGHTS;
  const isLive = cached?.isLive ?? false;
  const lastUpdated = cached?.lastUpdated ?? null;

  useEffect(() => {
    const unsub = onDataChange((payload) => {
      if (payload.table === 'cached_insights') {
        queryClient.invalidateQueries({ queryKey: ['cached-insights'] });
      }
    });
    return unsub;
  }, [queryClient]);

  const displayInsights = compact ? insights.slice(0, 2) : insights;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="pulse-insight-register">
      <header className="pulse-register-header">
        <span className="pulse-register-icon" aria-hidden="true"><BrainCircuit /></span>
        <div>
          <h2>Latest interpretation</h2>
          <p>AI explanation based on the latest validated source inputs.</p>
        </div>
        <strong className={`pulse-register-count ${isLive ? 'is-current' : ''}`}>
          {isLive ? 'Current' : 'Waiting for data'}
        </strong>
      </header>

      {lastUpdated && (
        <p className="pulse-register-updated">
          Updated {new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      )}

      {displayInsights.length === 0 && (
        <div className="pulse-register-empty">
          <BrainCircuit aria-hidden="true" />
          <p>Interpretation is unavailable until the next validated pipeline run.</p>
        </div>
      )}

      <div className={`pulse-insights-grid ${compact ? 'is-compact' : ''}`}>
        {displayInsights.map((insight) => {
          const config = INSIGHT_CONFIG[insight.type] || INSIGHT_CONFIG.summary;
          const Icon = config.icon;
          return (
            <motion.article key={insight.id} variants={fadeInUp} className={`pulse-insight-card ${config.tone}`}>
              <header>
                <span className="pulse-insight-icon" aria-hidden="true"><Icon /></span>
                <span className="pulse-insight-kind">{config.label}</span>
                <span className="pulse-insight-confidence" title="Data coverage when this interpretation was generated">
                  {insight.confidence}% coverage
                </span>
              </header>
              <h3>{insight.title}</h3>
              <p>{insight.body}</p>
              {insight.relatedSignals.length > 0 && (
                <footer aria-label="Related signals">
                  {insight.relatedSignals.map((signal) => <span key={signal}>{signal}</span>)}
                </footer>
              )}
            </motion.article>
          );
        })}
      </div>

      {compact && insights.length > 2 && (
        <button className="pulse-register-more">View all {insights.length} interpretations</button>
      )}
    </motion.div>
  );
};

export default AIInsights;
