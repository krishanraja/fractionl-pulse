import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Download, BookOpen, RefreshCw } from 'lucide-react';
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
    const steps = 50;
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
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <motion.div variants={fadeInUp} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="hero-title">
            <span className="hero-title-gradient">Fractional</span>
            <span className="hero-title-accent"> Working Index</span>
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Real-time market intelligence
            </p>
            {fwiLabel && (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 ${fwiLabel.color}`}>
                {fwiLabel.emoji} {fwiLabel.label}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          className={`text-muted-foreground hover:text-primary transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={18} />
        </Button>
      </div>

      {/* Main Score Card */}
      <div className="glass-card p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
          {/* Main Score */}
          <div className="col-span-2 md:col-span-1">
            <div className="score-large count-up text-primary">
              {animatedScore.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Current FWI Score
            </div>
          </div>

          {/* Delta */}
          <div>
            <div className={`flex items-center gap-1.5 text-xl font-semibold ${
              isPositive ? 'stat-up' : 'stat-down'
            }`}>
              {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              {isPositive ? '+' : ''}{delta.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              30-day change
            </div>
          </div>

          {/* Last Updated */}
          <div className="hidden md:block">
            <div className="text-sm font-medium text-foreground">
              {new Date(data.asOf).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Last updated
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={onShowMethodology}
              className="hidden sm:flex"
            >
              <BookOpen size={14} className="mr-1.5" />
              Methodology
            </Button>
            <Button
              size="sm"
              onClick={() => window.open('/assets/fwi_sample_report.pdf', '_blank')}
            >
              <Download size={14} className="mr-1.5" />
              Report
            </Button>
          </div>
        </div>

        {/* Weight indicators */}
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Demand ({Math.round((data.weights.demand ?? 0.5) * 100)}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              Supply ({Math.round((data.weights.supply ?? 0.3) * 100)}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              Culture ({Math.round((data.weights.culture ?? data.weights.momentum ?? 0.2) * 100)}%)
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HeroSection;
