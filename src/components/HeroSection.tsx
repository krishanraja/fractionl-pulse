import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, BookOpen, RefreshCw, Activity } from 'lucide-react';
import { fadeInUp } from '@/lib/motion';
import { calcComposite } from '@/lib/types';

interface HeroSectionProps {
  data: any;
  onShowMethodology: () => void;
  onRefresh?: () => void;
  fwiLabel?: { label: string; emoji: string; color: string };
}

const HeroSection = ({ data, onShowMethodology, onRefresh, fwiLabel }: HeroSectionProps) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const compositeScore = calcComposite(data.today, data.weights);
  const delta = data.today.delta30d;
  const isPositive = delta >= 0;

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = compositeScore / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= compositeScore) {
        current = compositeScore;
        clearInterval(timer);
      }
      setAnimatedScore(Math.round(current * 10) / 10);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [compositeScore]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 1200);
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return '#10b981';
    if (score >= 60) return '#22c55e';
    if (score >= 45) return '#eab308';
    if (score >= 30) return '#f97316';
    return '#ef4444';
  };

  const circumference = 2 * Math.PI * 54;
  const progress = (animatedScore / 100) * circumference;
  const scoreColor = getScoreColor(animatedScore);

  return (
    <motion.div variants={fadeInUp} className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="hero-title">
            <span className="hero-title-gradient">Fractional</span>
            <span className="hero-title-accent"> Working Index</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-lg">
            Real-time market intelligence for fractional executives. Updated weekly from 21 data sources.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className={`text-muted-foreground hover:text-primary h-8 w-8 ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      <div className="glass-card-elevated p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Score ring + number */}
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60" cy="60" r="54"
                  stroke="hsl(var(--border))"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="60" cy="60" r="54"
                  stroke={scoreColor}
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - progress}
                  className="score-ring"
                  style={{ filter: `drop-shadow(0 0 6px ${scoreColor}40)` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl sm:text-4xl font-bold tabular-nums" style={{ color: scoreColor }}>
                  {animatedScore.toFixed(1)}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">/ 100</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {fwiLabel && (
                <span className={`data-badge ${
                  fwiLabel.color.includes('emerald') ? 'bg-emerald-500/10 text-emerald-500' :
                  fwiLabel.color.includes('green') ? 'bg-green-500/10 text-green-500' :
                  fwiLabel.color.includes('yellow') ? 'bg-yellow-500/10 text-yellow-500' :
                  fwiLabel.color.includes('orange') ? 'bg-orange-500/10 text-orange-500' :
                  'bg-red-500/10 text-red-500'
                } text-xs font-semibold w-fit`}>
                  <Activity size={12} />
                  {fwiLabel.label}
                </span>
              )}

              <div className={`flex items-center gap-1.5 text-lg font-semibold ${
                isPositive ? 'stat-up' : 'stat-down'
              }`}>
                {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span>{isPositive ? '+' : ''}{delta.toFixed(1)} pts</span>
              </div>
              <span className="text-xs text-muted-foreground">vs 4 weeks ago</span>

              {data.context?.overallContext && (
                <p className="text-[11px] text-muted-foreground/70 max-w-[200px] leading-relaxed hidden sm:block">
                  {data.context.overallContext}
                </p>
              )}
            </div>
          </div>

          {/* Right side: meta + actions */}
          <div className="sm:ml-auto flex flex-col justify-between gap-3 sm:items-end sm:text-right">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">
                {new Date(data.asOf).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
              <div className="text-xs text-muted-foreground">Last updated</div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={onShowMethodology}
              className="w-fit"
            >
              <BookOpen size={14} className="mr-1.5" />
              How this works
            </Button>
          </div>
        </div>

        {/* Weight indicators */}
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              Hiring activity {Math.round((data.weights.demand ?? 0.5) * 100)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              Talent availability {Math.round((data.weights.supply ?? 0.2) * 100)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />
              Market buzz {Math.round((data.weights.culture ?? data.weights.momentum ?? 0.3) * 100)}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HeroSection;
