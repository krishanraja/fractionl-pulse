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
      <div className="section-header">
        <div>
          <h2>Market snapshot</h2>
          <p>Key benchmarks for the fractional executive economy</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map((stat: MarketStat, i: number) => {
          const Icon = ICONS[stat.label] || Info;
          const color = COLORS[stat.label] || 'text-muted-foreground bg-muted/10';

          return (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="p-3 rounded-lg border border-border/60 space-y-2 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${color}`}>
                  <Icon size={13} />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
              <div className="text-sm font-semibold text-foreground leading-tight">
                {isLoading ? '...' : stat.value}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {stat.note}
              </p>
              {stat.source === 'industry-estimate' && stat.citation && (
                <p className="text-[9px] text-muted-foreground/50 italic">
                  {stat.citation}
                </p>
              )}
              {stat.source === 'computed' && stat.value !== 'N/A' && (
                <p className="text-[9px] text-emerald-500/60 font-medium">
                  From live pipeline
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
