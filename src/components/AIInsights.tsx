import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase, SUPABASE_FUNCTIONS_URL } from '@/lib/supabase';
import { staggerContainer, fadeInUp } from '@/lib/motion';
import type { AIInsight } from '@/lib/types';

/** Normalize confidence to 0-100 regardless of whether source uses 0-1 or 0-100 */
function normalizeConfidence(value: number | undefined): number {
  if (value == null) return 80;
  // If value is between 0 and 1 (exclusive), treat as fraction
  if (value > 0 && value <= 1) return Math.round(value * 100);
  // Already on 0-100 scale
  return Math.round(Math.min(100, Math.max(0, value)));
}

// Empty fallback - no fabricated insights before the pipeline has run
const FALLBACK_INSIGHTS: AIInsight[] = [];

const getInsightIcon = (type: AIInsight['type']) => {
  switch (type) {
    case 'summary': return Sparkles;
    case 'prediction': return TrendingUp;
    case 'alert': return AlertTriangle;
    case 'opportunity': return Lightbulb;
  }
};

const getInsightColor = (type: AIInsight['type']) => {
  switch (type) {
    case 'summary': return 'text-primary bg-primary/10 border-primary/20';
    case 'prediction': return 'text-accent bg-accent/10 border-accent/20';
    case 'alert': return 'text-warning bg-warning/10 border-warning/20';
    case 'opportunity': return 'text-success bg-success/10 border-success/20';
  }
};

interface AIInsightsProps {
  compact?: boolean;
}

const AIInsights = ({ compact = false }: AIInsightsProps) => {
  const [insights, setInsights] = useState<AIInsight[]>(FALLBACK_INSIGHTS);
  const [isLive, setIsLive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // Try cached insights first
      const { data } = await supabase
        .from('cached_insights')
        .select('insights_json, generated_at, valid_until')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Skip expired cached insights: treat as stale and fall back to defaults
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
      }
    };

    load();
  }, []);

  const handleRefresh = async () => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/generate-pulse-insights`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token ?? ''}`,
            'Content-Type': 'application/json',
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
      console.error('Insights refresh failed:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const displayInsights = compact ? insights.slice(0, 2) : insights;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-primary" />
          <h2 className="text-xl font-semibold">AI Insights</h2>
          {isLive && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Live</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {lastUpdated
              ? new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : 'Sample data'}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isGenerating}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Refresh insights"
          >
            <RefreshCw size={14} className={`text-muted-foreground ${isGenerating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {displayInsights.length === 0 && (
        <div className="glass-card p-6 text-center space-y-2">
          <Sparkles size={24} className="mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            AI insights will appear after the first data pipeline run. They are generated from real FWI scores and market signals, not pre-written.
          </p>
        </div>
      )}

      <div className={compact ? "space-y-3" : "grid gap-4 md:grid-cols-2"}>
        {displayInsights.map((insight) => {
          const Icon = getInsightIcon(insight.type);
          const colorClass = getInsightColor(insight.type);

          return (
            <motion.div
              key={insight.id}
              variants={fadeInUp}
              className="glass-card p-4 space-y-3 cursor-pointer hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border ${colorClass}`}>
                    <Icon size={14} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {insight.type}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground" title="How complete the underlying data was when this insight was generated">
                  {insight.confidence}% data completeness
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-foreground leading-tight">{insight.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{insight.body}</p>
              </div>

              {insight.relatedSignals.length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex flex-wrap gap-1.5">
                    {insight.relatedSignals.map((signal) => (
                      <span key={signal} className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                        {signal}
                      </span>
                    ))}
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {compact && (
        <button className="w-full text-center text-sm text-primary font-medium py-2 hover:underline">
          View all insights →
        </button>
      )}
    </motion.div>
  );
};

export default AIInsights;
