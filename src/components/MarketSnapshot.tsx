import { motion } from 'framer-motion';
import { TrendingUp, Building2, Clock, DollarSign, Briefcase, Users, Info } from 'lucide-react';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { useMarketStats, type MarketStat } from '@/hooks/useMarketStats';

const ICONS: Record<string, any> = {
  'YoY index change': TrendingUp,
  'Top industries': Building2,
  'Avg engagement': Clock,
  'Cost vs full-time': DollarSign,
  'Demand driver': Briefcase,
  'Hottest roles': Users,
};

const COLORS: Record<string, string> = {
  'YoY index change': 'text-success bg-success/10',
  'Top industries': 'text-primary bg-primary/10',
  'Avg engagement': 'text-accent bg-accent/10',
  'Cost vs full-time': 'text-warning bg-warning/10',
  'Demand driver': 'text-secondary bg-secondary/10',
  'Hottest roles': 'text-primary bg-primary/10',
};

const MarketSnapshot = () => {
  const { stats, isLoading } = useMarketStats();

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="glass-card p-4 sm:p-5"
    >
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-foreground">Market snapshot</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Key benchmarks for the fractional executive economy. Stats marked <span className="italic">estimate</span> are cited industry figures, not computed from our pipeline.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat: MarketStat, i: number) => {
          const Icon = ICONS[stat.label] || Info;
          const color = COLORS[stat.label] || 'text-muted-foreground bg-muted/10';

          return (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="p-3 sm:p-4 rounded-lg border border-border/60 space-y-2 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${color}`}>
                  <Icon size={14} />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </span>
              </div>
              <div className="text-sm sm:text-base font-semibold text-foreground leading-tight">
                {isLoading ? '...' : stat.value}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {stat.note}
              </p>
              {stat.source === 'industry-estimate' && stat.citation && (
                <p className="text-[10px] text-muted-foreground/60 italic">
                  Source: {stat.citation}
                </p>
              )}
              {stat.source === 'computed' && stat.value !== 'N/A' && (
                <p className="text-[10px] text-emerald-400/70 italic">
                  Computed from pipeline
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MarketSnapshot;
