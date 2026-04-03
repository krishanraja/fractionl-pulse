import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import SparklineChart from './SparklineChart';
import RoleBreakdown from './RoleBreakdown';
import { fadeInUp } from '@/lib/motion';
import { useSignalContext } from '@/hooks/useSignalContext';

interface SubIndexCardsProps {
  data: any;
  compact?: boolean;
  hasLiveSupply?: boolean;
}

const SubIndexCards = ({ data, compact = false, hasLiveSupply = false }: SubIndexCardsProps) => {
  const supplyIsPlaceholder = !hasLiveSupply;
  const signalContext = useSignalContext();
  const indices = [
    {
      key: 'demand',
      title: 'Hiring activity',
      weight: data.weights.demand,
      score: data.today.demand.score,
      delta: data.today.demand.delta30d,
      description: 'How many companies are actively posting fractional roles right now, plus how many just raised funding (a leading indicator of upcoming hires)',
      rawContext: signalContext.demand,
      context: data.context?.demandContext,
      sparklineData: data.monthly.demand,
      colorClass: 'bg-primary',
      colorName: 'primary',
      isPlaceholder: false,
      comingSoon: false,
      showRoleBreakdown: true,
    },
    {
      key: 'supply',
      title: 'Talent availability',
      weight: data.weights.supply,
      score: data.today.supply.score,
      delta: data.today.supply.delta30d,
      description: supplyIsPlaceholder
        ? 'Will track fractional talent pool growth via People Data Labs profiles and supply-side search interest. Currently excluded from the composite score.'
        : 'How many fractional executives are in the talent pool, based on PDL profile counts and supply-side search interest trends.',
      rawContext: signalContext.supply,
      context: undefined,
      sparklineData: data.monthly.supply,
      colorClass: supplyIsPlaceholder ? 'bg-muted-foreground/40' : 'bg-accent',
      colorName: supplyIsPlaceholder ? 'muted' : 'accent',
      isPlaceholder: supplyIsPlaceholder,
      comingSoon: !hasLiveSupply,
      showRoleBreakdown: false,
    },
    {
      key: 'culture',
      title: 'Market buzz',
      weight: data.weights.culture,
      score: data.today.culture.score,
      delta: data.today.culture.delta30d,
      description: 'How much the world is talking about fractional work: Google searches, news coverage, and social mentions. High buzz often predicts a hiring surge.',
      rawContext: signalContext.culture,
      context: data.context?.cultureContext,
      sparklineData: data.monthly.culture,
      colorClass: 'bg-secondary',
      colorName: 'secondary',
      isPlaceholder: false,
      comingSoon: false,
      showRoleBreakdown: false,
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {indices.map((index, i) => {
        const isPositive = index.delta >= 0;

        if (index.comingSoon) {
          return (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="glass-card index-card p-5 relative overflow-hidden opacity-60"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${index.colorClass} opacity-50`} />
                  <h3 className="font-medium text-foreground">{index.title}</h3>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                  Coming Soon
                </span>
              </div>

              {/* Placeholder score */}
              <div className="flex items-end justify-between mb-4">
                <div className="score-medium text-muted-foreground/40">--</div>
              </div>

              {/* Description */}
              <div className="text-xs text-muted-foreground pt-3 border-t border-border">
                {index.description}
              </div>
            </motion.div>
          );
        }

        return (
          <motion.div
            key={i}
            variants={fadeInUp}
            className="glass-card index-card p-4 sm:p-5 hover-lift cursor-pointer"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${index.colorClass}`} />
                <h3 className="font-medium text-foreground">{index.title}</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(index.weight * 100)}% of score
              </span>
            </div>

            {/* Score and Delta */}
            <div className="flex items-end justify-between mb-2">
              <div className={`score-medium ${index.isPlaceholder ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                {index.score}
              </div>
              {index.isPlaceholder ? (
                <span className="text-xs text-muted-foreground/60 font-medium px-2 py-0.5 bg-muted/50 rounded">
                  Awaiting data
                </span>
              ) : (
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  isPositive ? 'stat-up' : 'stat-down'
                }`}>
                  {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {isPositive ? '+' : ''}{index.delta.toFixed(1)}
                </div>
              )}
            </div>

            {/* Raw context line */}
            {index.rawContext && (
              <p className="text-[10px] text-muted-foreground/60 mb-3">
                {index.rawContext}
              </p>
            )}
            {!index.rawContext && <div className="mb-2" />}

            {/* Sparkline */}
            {!compact && (
              <div className="h-10 mb-3">
                <SparklineChart
                  data={index.sparklineData}
                  months={data.monthly.months}
                  color={index.colorName}
                />
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
                <div className="text-muted-foreground">{index.description}</div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default SubIndexCards;
