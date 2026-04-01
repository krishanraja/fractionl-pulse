import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import SparklineChart from './SparklineChart';
import { fadeInUp } from '@/lib/motion';

interface SubIndexCardsProps {
  data: any;
  compact?: boolean;
}

const SubIndexCards = ({ data, compact = false }: SubIndexCardsProps) => {
  const supplyIsPlaceholder = data.today.supply.score === 50 && data.today.supply.delta30d === 0;

  const indices = [
    {
      title: 'Hiring activity',
      weight: data.weights.demand,
      score: data.today.demand.score,
      delta: data.today.demand.delta30d,
      description: 'How many companies are actively posting fractional roles right now, plus how many just raised funding (a leading indicator of upcoming hires)',
      sparklineData: data.monthly.demand,
      colorClass: 'bg-primary',
      colorName: 'primary',
      isPlaceholder: false,
    },
    {
      title: 'Talent availability',
      weight: data.weights.supply,
      score: data.today.supply.score,
      delta: data.today.supply.delta30d,
      description: supplyIsPlaceholder
        ? 'This index uses a neutral placeholder (50) until marketplace data integration launches. No real supply data is being collected yet.'
        : 'How many fractional executives are currently available to hire, based on marketplace data.',
      sparklineData: data.monthly.supply,
      colorClass: supplyIsPlaceholder ? 'bg-muted-foreground/40' : 'bg-accent',
      colorName: supplyIsPlaceholder ? 'muted' : 'accent',
      isPlaceholder: supplyIsPlaceholder,
    },
    {
      title: 'Market buzz',
      weight: data.weights.culture,
      score: data.today.culture.score,
      delta: data.today.culture.delta30d,
      description: 'How much the world is talking about fractional work: Google searches, news coverage, and social mentions. High buzz often predicts a hiring surge.',
      sparklineData: data.monthly.culture,
      colorClass: 'bg-secondary',
      colorName: 'secondary',
      isPlaceholder: false,
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {indices.map((index, i) => {
        const isPositive = index.delta >= 0;
        
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
            <div className="flex items-end justify-between mb-4">
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

            {/* Description */}
            {!compact && (
              <div className="text-xs text-muted-foreground pt-3 border-t border-border">
                {index.description}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default SubIndexCards;
