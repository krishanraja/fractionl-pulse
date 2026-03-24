import { motion } from 'framer-motion';
import { TrendingUp, Building2, Clock, DollarSign, Briefcase, Users } from 'lucide-react';
import { fadeInUp, staggerContainer } from '@/lib/motion';

const stats = [
  {
    icon: TrendingUp,
    label: 'YoY growth',
    value: '63%',
    note: 'Fractional exec job postings vs last year',
    color: 'text-success bg-success/10',
  },
  {
    icon: Building2,
    label: 'Top industries',
    value: 'Tech, Healthcare, Finance',
    note: 'Highest fractional hiring activity by sector',
    color: 'text-primary bg-primary/10',
  },
  {
    icon: Clock,
    label: 'Avg engagement',
    value: '6–12 months',
    note: 'Typical fractional C-suite engagement length',
    color: 'text-accent bg-accent/10',
  },
  {
    icon: DollarSign,
    label: 'Cost vs full-time',
    value: '40–60% less',
    note: 'Compared to a full-time C-suite hire (salary + equity + benefits)',
    color: 'text-warning bg-warning/10',
  },
  {
    icon: Briefcase,
    label: 'Demand driver',
    value: 'Series A–C',
    note: '68% of demand comes from venture-backed startups scaling fast',
    color: 'text-secondary bg-secondary/10',
  },
  {
    icon: Users,
    label: 'Hottest roles',
    value: 'CFO, CMO, CTO',
    note: 'Ranked by posting volume and search interest this quarter',
    color: 'text-primary bg-primary/10',
  },
];

const MarketSnapshot = () => {
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
          Key benchmarks for the fractional executive economy — updated quarterly.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              variants={fadeInUp}
              className="p-3 sm:p-4 rounded-lg border border-border/60 space-y-2 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${stat.color}`}>
                  <Icon size={14} />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </span>
              </div>
              <div className="text-sm sm:text-base font-semibold text-foreground leading-tight">
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {stat.note}
              </p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MarketSnapshot;
