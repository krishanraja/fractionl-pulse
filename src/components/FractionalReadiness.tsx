import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import type { getFWILabel } from '@/pages/Index';

interface FractionalReadinessProps {
  score?: number;
  label?: ReturnType<typeof getFWILabel>;
}

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
    if (v >= 75) return '#10b981'; // emerald
    if (v >= 60) return '#22c55e'; // green
    if (v >= 45) return '#eab308'; // yellow
    if (v >= 30) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const gaugeColor = getGaugeColor(animatedValue);

  return (
    <motion.div
      variants={fadeInUp}
      className="glass-card p-5 h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-foreground">Should you hire now?</h3>
        {label ? (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${
            label.color.includes('emerald') ? 'bg-emerald-500/10 text-emerald-400' :
            label.color.includes('green') ? 'bg-green-500/10 text-green-400' :
            label.color.includes('yellow') ? 'bg-yellow-500/10 text-yellow-400' :
            label.color.includes('orange') ? 'bg-orange-500/10 text-orange-400' :
            'bg-red-500/10 text-red-400'
          }`}>
            {label.emoji} {label.label}
          </span>
        ) : (
          <span className="text-[10px] font-medium bg-warning/10 text-warning px-2 py-0.5 rounded-full uppercase tracking-wide">
            Beta
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <div className="relative w-28 h-28">
          <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="42"
              stroke="hsl(var(--border))"
              strokeWidth="6"
              fill="none"
            />
            <circle
              cx="50" cy="50" r="42"
              stroke={gaugeColor}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-semibold" style={{ color: gaugeColor }}>
                {animatedValue}
              </div>
              <div className="text-[10px] text-muted-foreground">/100</div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-2">
        Based on hiring activity, talent availability, and market buzz right now
      </p>
    </motion.div>
  );
};

export default FractionalReadiness;
