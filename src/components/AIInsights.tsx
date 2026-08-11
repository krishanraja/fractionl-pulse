import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BrainCircuit, TrendingUp, AlertTriangle, Lightbulb, Target, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { onDataChange } from '@/lib/realtime';
import { staggerContainer, fadeInUp } from '@/lib/motion';
import type { AIInsight } from '@/lib/types';

function normalizeConfidence(value: number | undefined): number {
  if (value == null) return 80;
  if (value > 0 && value <= 1) return Math.round(value * 100);
  return Math.round(Math.min(100, Math.max(0, value)));
}

const FALLBACK_INSIGHTS: AIInsight[] = [];

const INSIGHT_CONFIG: Record<AIInsight['type'], { icon: LucideIcon; label: string; color: string }> = {
  summary: { icon: BrainCircuit, label: 'Market Summary', color: 'text-primary bg-primary/10 border-primary/20' },
  prediction: { icon: TrendingUp, label: 'Directional read', color: 'text-accent-foreground bg-accent/20 border-accent/30' },
  trend: { icon: Target, label: 'Trend to Watch', color: 'text-secondary bg-secondary/10 border-secondary/20' },
  alert: { icon: AlertTriangle, label: 'Alert', color: 'text-warning bg-warning/10 border-warning/20' },
  opportunity: { icon: Lightbulb, label: 'Opportunity', color: 'text-success bg-success/10 border-success/20' },
  recommendation: { icon: Sparkles, label: 'Recommendation', color: 'text-primary bg-primary/10 border-primary/20' },
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

async function fetchCachedInsights(): Promise<{ insights: AIInsight[]; isLive: boolean; lastUpdated: string | null; isExpired: boolean }> {
  const { data } = await supabase
    .from('cached_insights')
    .select('insights_json, generated_at, valid_until')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isExpired = !!(data?.valid_until && new Date(data.valid_until).getTime() < Date.now());

  if (data?.insights_json && Array.isArray(data.insights_json) && data.insights_json.length > 0 && !isExpired) {
    const mapped = data.insights_json.map((insight, index) => parseInsight(insight, index, data.generated_at));
    return { insights: mapped, isLive: true, lastUpdated: data.generated_at, isExpired: false };
  }

  return { insights: [], isLive: false, lastUpdated: null, isExpired };
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
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <BrainCircuit size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground">AI Analysis</h2>
            <p className="text-[10px] text-muted-foreground">
              Generated from the latest tracked source inputs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="data-badge bg-emerald-500/10 text-emerald-700">Current</span>
          )}
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {displayInsights.length === 0 && (
        <div className="glass-card p-8 text-center space-y-3">
          <>
            <BrainCircuit size={24} className="mx-auto text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              Analysis is unavailable until the next validated pipeline run.
            </p>
          </>
        </div>
      )}

      <div className={compact ? "space-y-3" : "grid gap-4 md:grid-cols-2"}>
        {displayInsights.map((insight) => {
          const config = INSIGHT_CONFIG[insight.type] || INSIGHT_CONFIG.summary;
          const Icon = config.icon;

          return (
            <motion.div
              key={insight.id}
              variants={fadeInUp}
              className="glass-card p-4 space-y-3 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border ${config.color}`}>
                    <Icon size={13} />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {config.label}
                  </span>
                </div>
                <span className="data-badge bg-muted text-muted-foreground" title="Data completeness when insight was generated">
                  {insight.confidence}%
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="font-semibold text-foreground text-sm leading-tight">{insight.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{insight.body}</p>
              </div>

              {insight.relatedSignals.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                  {insight.relatedSignals.map((signal) => (
                    <span key={signal} className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                      {signal}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {compact && insights.length > 2 && (
        <button className="w-full text-center text-xs text-primary font-medium py-2 hover:underline">
          View all {insights.length} insights
        </button>
      )}
    </motion.div>
  );
};

export default AIInsights;
