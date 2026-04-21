import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import type { getFWILabel } from '@/pages/Index';

interface FractionalReadinessProps {
  score?: number;
  label?: ReturnType<typeof getFWILabel>;
}

const getGuidance = (score: number): { headline: string; body: string } => {
  if (score >= 75) return {
    headline: 'Strong market conditions',
    body: 'Hiring activity and talent availability are both elevated. Fractional executives have strong leverage right now.',
  };
  if (score >= 60) return {
    headline: 'Favorable conditions',
    body: 'Market is growing with healthy demand signals. Good time to engage fractional talent for strategic initiatives.',
  };
  if (score >= 45) return {
    headline: 'Steady market',
    body: 'Market activity is stable. Conditions are neutral for both hiring companies and fractional executives.',
  };
  if (score >= 30) return {
    headline: 'Cooling market',
    body: 'Demand is softening. Companies may find more availability; executives should focus on pipeline building.',
  };
  return {
    headline: 'Contracting market',
    body: 'Significant slowdown in fractional hiring. Focus on existing relationships and differentiated positioning.',
  };
};

const FractionalReadiness = ({ score, label }: FractionalReadinessProps) => {
  const targetValue = score ?? 0;
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    setAnimatedValue(0);
    const duration = 1400;
    const steps = 50;
    const increment = targetValue / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetValue) {
        current = targetValue;
        clearInterval(timer);
      }
      setAnimatedValue(Math.round(current));
    }, duration / steps);

    return () => clearInterval(timer);
  }, [targetValue]);

  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  const getGaugeColor = (v: number) => {
    if (v >= 75) return '#10b981';
    if (v >= 60) return '#22c55e';
    if (v >= 45) return '#eab308';
    if (v >= 30) return '#f97316';
    return '#ef4444';
  };

  const gaugeColor = getGaugeColor(animatedValue);
  const guidance = getGuidance(animatedValue);

  return (
    <motion.div
      variants={fadeInUp}
      className="glass-card p-4 sm:p-5 h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">Market Readiness</h3>
        {label && (
          <span className={`data-badge ${
            label.color.includes('emerald') ? 'bg-emerald-500/10 text-emerald-500' :
            label.color.includes('green') ? 'bg-green-500/10 text-green-500' :
            label.color.includes('yellow') ? 'bg-yellow-500/10 text-yellow-500' :
            label.color.includes('orange') ? 'bg-orange-500/10 text-orange-500' :
            'bg-red-500/10 text-red-500'
          }`}>
            {label.label}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-3">
        <div className="relative w-28 h-28">
          <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="42"
              stroke="hsl(var(--border))"
              strokeWidth="5"
              fill="none"
            />
            <circle
              cx="50" cy="50" r="42"
              stroke={gaugeColor}
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="score-ring"
              style={{ filter: `drop-shadow(0 0 4px ${gaugeColor}30)` }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ color: gaugeColor }}>
                {animatedValue}
              </div>
              <div className="text-[9px] text-muted-foreground font-medium">/ 100</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 mt-2">
        <p className="text-xs font-semibold text-foreground">{guidance.headline}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{guidance.body}</p>
      </div>
    </motion.div>
  );
};

export default FractionalReadiness;
