import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Briefcase, Users, Megaphone } from 'lucide-react';
import SparklineChart from './SparklineChart';
import RoleBreakdown from './RoleBreakdown';
import { useSignalContext } from '@/hooks/useSignalContext';
import { displayScore, formatDelta } from '@/lib/format';
import type { FWIData } from '@/lib/types';

interface SubIndexCardsProps {
  data: FWIData;
  compact?: boolean;
}

const SOURCE_COUNTS: Record<string, { count: number; examples: string }> = {
  demand: { count: 3, examples: 'Adzuna, DataForSEO Jobs, SEC EDGAR' },
  supply: { count: 4, examples: 'LinkedIn proxy (DataForSEO), Brave talent, GoFractional, Supply Intent' },
  culture: { count: 10, examples: 'DataForSEO Trends, NewsAPI, Guardian, Podchaser, Reddit, HN, Wikipedia...' },
};

const SubIndexCards = ({ data, compact = false }: SubIndexCardsProps) => {
  const signalContext = useSignalContext();

  // Shared y-domain across the three sub-index sparklines so they sit on one
  // comparable scale instead of each auto-scaling to its own min/max (which made
  // a flat-but-high series look as dramatic as a volatile low one). Padded ±5 and
  // clamped to 0-100 to keep some breathing room while staying honest.
  const allSparkValues = [
    ...data.monthly.demand,
    ...data.monthly.supply,
    ...data.monthly.culture,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const sparkMin = allSparkValues.length
    ? Math.max(0, Math.floor(Math.min(...allSparkValues)) - 5)
    : 0;
  const sparkMax = allSparkValues.length
    ? Math.min(100, Math.ceil(Math.max(...allSparkValues)) + 5)
    : 100;

  const indices = [
    {
      key: 'demand',
      title: 'Hiring Activity',
      icon: Briefcase,
      weight: data.weights.demand,
      score: data.today.demand.score,
      delta: data.today.demand.delta30d,
      description: 'Active fractional job postings plus startup-financing context. The financing relationship is not a validated forecast.',
      rawContext: signalContext.demand,
      context: data.context?.demandContext,
      sparklineData: data.monthly.demand,
      accentColor: 'hsl(var(--primary))',
      dotClass: 'bg-primary',
      colorName: 'primary',
      showRoleBreakdown: true,
    },
    {
      key: 'supply',
      title: 'Talent Availability',
      icon: Users,
      weight: data.weights.supply,
      score: data.today.supply.score,
      delta: data.today.supply.delta30d,
      description: 'Fractional executive talent pool size from professional profiles, marketplace listings, and supply-side search intent.',
      rawContext: signalContext.supply,
      context: undefined,
      sparklineData: data.monthly.supply,
      accentColor: 'hsl(var(--accent))',
      dotClass: 'bg-accent',
      colorName: 'accent',
      showRoleBreakdown: false,
    },
    {
      key: 'culture',
      title: 'Market Buzz',
      icon: Megaphone,
      weight: data.weights.culture,
      score: data.today.culture.score,
      delta: data.today.culture.delta30d,
      description: 'Media coverage, search interest, podcast mentions, and community discourse around fractional work.',
      rawContext: signalContext.culture,
      context: data.context?.cultureContext,
      sparklineData: data.monthly.culture,
      accentColor: 'hsl(var(--secondary))',
      dotClass: 'bg-secondary',
      colorName: 'secondary',
      showRoleBreakdown: false,
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {indices.map((index, i) => {
        const hasDelta = index.delta != null;
        const isPositive = hasDelta && (index.delta as number) >= 0;
        const Icon = index.icon;
        const sourceInfo = SOURCE_COUNTS[index.key];

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card index-card p-4 sm:p-5 pl-5 sm:pl-6 hover-lift"
            style={{ ['--accent-rail' as string]: index.accentColor }}
          >
            {/* Header with icon */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${index.accentColor}15` }}>
                  <Icon size={14} style={{ color: index.accentColor }} />
                </div>
                <h3 className="font-semibold text-foreground text-[13px] tracking-tight">{index.title}</h3>
              </div>
              <span className="section-label tabular-nums">
                {Math.round(index.weight * 100)}% weight
              </span>
            </div>

            {/* Score + delta row */}
            <div className="flex items-end justify-between mb-1">
              <div className="score-medium text-foreground">
                {index.score == null ? <span className="text-muted-foreground/60">—</span> : displayScore(index.score)}
              </div>
              {index.score == null ? (
                <div className="text-[11px] font-medium text-muted-foreground/70">No reliable reading</div>
              ) : !hasDelta ? (
                <div className="text-[11px] font-medium text-muted-foreground/60">new</div>
              ) : (
                <div className={`flex items-center gap-1 text-sm font-bold tabular-nums ${
                  isPositive ? 'stat-up' : 'stat-down'
                }`}>
                  {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {isPositive ? '+' : ''}{formatDelta(index.delta as number)}
                </div>
              )}
            </div>

            {/* Raw context from live signals */}
            {index.rawContext && (
              <p className="text-[10px] text-muted-foreground/60 mb-3 leading-relaxed line-clamp-2">
                {index.rawContext}
              </p>
            )}
            {!index.rawContext && <div className="mb-3" />}

            {/* Sparkline */}
            {!compact && (
              <div className="h-10 mb-3">
                <SparklineChart
                  data={index.sparklineData}
                  months={data.monthly.months}
                  color={index.colorName}
                  yMin={sparkMin}
                  yMax={sparkMax}
                />
              </div>
            )}

            {/* Source count badge */}
            {sourceInfo && (
              <div className="flex items-center gap-1.5 mb-3">
                <span className="data-badge bg-muted text-muted-foreground">
                  {sourceInfo.count} sources
                </span>
              </div>
            )}

            {/* Role breakdown (demand card only) */}
            {!compact && index.showRoleBreakdown && (
              <div className="pt-3 border-t border-border">
                <RoleBreakdown />
              </div>
            )}

            {/* Description + Context */}
            {!compact && !index.showRoleBreakdown && (
              <div className="text-xs pt-3 border-t border-border space-y-1">
                {index.context && (
                  <div className="text-foreground/70 font-medium">{index.context}</div>
                )}
                <div className="text-muted-foreground leading-relaxed">{index.description}</div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default SubIndexCards;
