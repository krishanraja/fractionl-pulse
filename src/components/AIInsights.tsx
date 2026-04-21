import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, TrendingUp, AlertTriangle, Lightbulb, Target, RefreshCw, Sparkles } from 'lucide-react';
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { staggerContainer, fadeInUp } from '@/lib/motion';
import type { AIInsight } from '@/lib/types';

function normalizeConfidence(value: number | undefined): number {
  if (value == null) return 80;
  if (value > 0 && value <= 1) return Math.round(value * 100);
  return Math.round(Math.min(100, Math.max(0, value)));
}

const FALLBACK_INSIGHTS: AIInsight[] = [];

const INSIGHT_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  summary: { icon: BrainCircuit, label: 'Market Summary', color: 'text-primary bg-primary/10 border-primary/20' },
  prediction: { icon: TrendingUp, label: 'Prediction', color: 'text-accent bg-accent/10 border-accent/20' },
  trend: { icon: Target, label: 'Trend to Watch', color: 'text-secondary bg-secondary/10 border-secondary/20' },
  alert: { icon: AlertTriangle, label: 'Alert', color: 'text-warning bg-warning/10 border-warning/20' },
  opportunity: { icon: Lightbulb, label: 'Opportunity', color: 'text-success bg-success/10 border-success/20' },
  recommendation: { icon: Sparkles, label: 'Recommendation', color: 'text-primary bg-primary/10 border-primary/20' },
};

interface AIInsightsProps {
  compact?: boolean;
}

const AIInsights = ({ compact = false }: AIInsightsProps) => {
  const [insights, setInsights] = useState<AIInsight[]>(FALLBACK_INSIGHTS);
  const [isLive, setIsLive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const autoGenerateAttempted = useRef(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || SUPABASE_ANON_KEY;
      const res = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/generate-pulse-insights`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
          },
        }
      );
      const data = await res.json();
      if (data.insights && Array.isArray(data.insights)) {
        const mapped: AIInsight[] = data.insights.map((ins: any, i: number) => ({
          id: String(i + 1),
          type: ins.type || 'summary',
          title: ins.title || 'Insight',
          body: ins.body || '',
          confidence: normalizeConfidence(ins.confidence),
          generatedAt: new Date().toISOString(),
          relatedSignals: ins.relatedSignals || [],
        }));
        setInsights(mapped);
        setIsLive(true);
        setLastUpdated(new Date().toISOString());
      }
    } catch (e) {
      console.error('Insights generation failed:', e);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('cached_insights')
        .select('insights_json, generated_at, valid_until')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const isExpired = data?.valid_until && new Date(data.valid_until).getTime() < Date.now();

      if (data?.insights_json && Array.isArray(data.insights_json) && data.insights_json.length > 0 && !isExpired) {
        const mapped: AIInsight[] = (data.insights_json as any[]).map((ins: any, i: number) => ({
          id: String(i + 1),
          type: ins.type || 'summary',
          title: ins.title || 'Insight',
          body: ins.body || '',
          confidence: normalizeConfidence(ins.confidence),
          generatedAt: data.generated_at,
          relatedSignals: ins.relatedSignals || [],
        }));
        setInsights(mapped);
        setIsLive(true);
        setLastUpdated(data.generated_at);
      } else if (!autoGenerateAttempted.current) {
        autoGenerateAttempted.current = true;
        generate();
      }
    };

    load();
  }, [generate]);

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
              Generated from {isLive ? '21 live data sources' : 'available data'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="data-badge bg-emerald-500/10 text-emerald-500">Live</span>
          )}
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <button
            onClick={generate}
            disabled={isGenerating}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Regenerate insights"
          >
            <RefreshCw size={14} className={`text-muted-foreground ${isGenerating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {displayInsights.length === 0 && (
        <div className="glass-card p-8 text-center space-y-3">
          {isGenerating ? (
            <>
              <div className="relative mx-auto w-10 h-10">
                <RefreshCw size={20} className="absolute inset-0 m-auto text-primary animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">
                Analyzing 21 data sources to generate insights...
              </p>
            </>
          ) : (
            <>
              <BrainCircuit size={24} className="mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No insights yet. Tap refresh to generate from the latest market signals.
              </p>
            </>
          )}
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
