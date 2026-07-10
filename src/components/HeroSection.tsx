import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BookOpen, RefreshCw, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { calcComposite } from '@/lib/types';
import { displayScore, formatDelta } from '@/lib/format';

interface HeroSectionProps {
  data: any;
  onShowMethodology: () => void;
  onRefresh?: () => void;
  fwiLabel?: { label: string; emoji: string; color: string };
}

// The five FWI bands, expressed once so the gauge, rail, and chip stay in lockstep.
type Band = { name: string; color: string; tint: string; text: string };
const bandFor = (score: number): Band => {
  if (score >= 75) return { name: 'Surging', color: 'hsl(158 72% 38%)', tint: 'hsl(158 72% 38% / 0.10)', text: 'hsl(158 72% 30%)' };
  if (score >= 60) return { name: 'Growing', color: 'hsl(142 62% 40%)', tint: 'hsl(142 62% 40% / 0.10)', text: 'hsl(142 62% 30%)' };
  if (score >= 45) return { name: 'Stable', color: 'hsl(42 92% 44%)', tint: 'hsl(42 92% 44% / 0.12)', text: 'hsl(38 92% 34%)' };
  if (score >= 30) return { name: 'Cooling', color: 'hsl(24 90% 50%)', tint: 'hsl(24 90% 50% / 0.10)', text: 'hsl(22 86% 42%)' };
  return { name: 'Contracting', color: 'hsl(2 72% 52%)', tint: 'hsl(2 72% 52% / 0.10)', text: 'hsl(0 70% 44%)' };
};

const HeroSection = ({ data, onShowMethodology, onRefresh, fwiLabel }: HeroSectionProps) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const compositeScore = calcComposite(data.today, data.weights);
  // The whole-number index the UI shows. Band and verdict below derive from this same
  // rounded value, so the number and its label can never disagree at a boundary.
  const score = displayScore(compositeScore);
  const delta = data.today.delta30d;
  const isPositive = delta >= 0;
  const isFlat = Math.abs(delta) < 0.05;

  // Forward lean: demand is the leading pillar, so its recent trajectory is a
  // directional read on where the index is heading. Powered by SEC startup-funding
  // (Form D) filings, a 1 to 3 month leading indicator. Directional, not a forecast,
  // and never with an accuracy claim (truth-discipline). Plain language, no codename.
  const demandDelta = data.today.demand?.delta30d ?? 0;
  const lean =
    demandDelta > 1.5
      ? { txt: 'Demand is tilting up. Recent startup-funding filings point to firmer fractional demand over the next 1 to 3 months.', cls: 'stat-up' }
      : demandDelta < -1.5
      ? { txt: 'Demand is softening. Recent startup-funding filings point to cooler fractional demand over the next 1 to 3 months.', cls: 'stat-down' }
      : { txt: 'Demand is steady. Recent startup-funding filings show no strong directional pull right now.', cls: 'text-muted-foreground' };

  // One synthesized read so level and momentum resolve into a single conclusion
  // instead of a "Stable" pill sitting next to a red drop reading as a contradiction.
  // The band is the market's level; the 4-week delta is its direction. Join them with
  // "and" when they point the same way, "but" when they diverge — and phrase the
  // momentum so it never echoes the band word (no "cooling but cooling").
  const level = bandFor(score).name.toLowerCase();
  const magnitude = Math.abs(delta);
  const momentum = isFlat
    ? 'holding steady'
    : isPositive
    ? (magnitude >= 2 ? 'climbing' : 'edging higher')
    : (magnitude >= 2 ? 'sliding lower' : 'edging lower');
  const levelDir = score >= 60 ? 1 : score >= 45 ? 0 : -1; // hot / neutral / cool
  const momentumDir = isFlat ? 0 : isPositive ? 1 : -1;
  const conjunction =
    levelDir === 0 || momentumDir === 0 || levelDir === momentumDir ? 'and' : 'but';
  const marketVerdict =
    isFlat && levelDir === 0
      ? 'The fractional market is holding steady.'
      : `The fractional market is ${level} ${conjunction} ${momentum}.`;

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        current = score;
        clearInterval(timer);
      }
      setAnimatedScore(Math.round(current));
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 1200);
  };

  const band = bandFor(animatedScore);

  // Gauge geometry: a 270-degree open dial, the convention for an instrument.
  const R = 52;
  const ARC = 270; // degrees of sweep
  const GAP = 90; // bottom gap
  const startAngle = 90 + GAP / 2; // start at lower-left
  const fullArcLen = (ARC / 360) * (2 * Math.PI * R);
  const circumference = 2 * Math.PI * R;
  const progressLen = (animatedScore / 100) * fullArcLen;

  // Tick marks at each band boundary (30/45/60/75) plus 0 and 100.
  const ticks = [0, 30, 45, 60, 75, 100];
  const tickPos = (value: number) => {
    const angle = (startAngle + (value / 100) * ARC) * (Math.PI / 180);
    return {
      x1: 60 + (R + 8) * Math.cos(angle),
      y1: 60 + (R + 8) * Math.sin(angle),
      x2: 60 + (R + 12) * Math.cos(angle),
      y2: 60 + (R + 12) * Math.sin(angle),
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow mb-2.5">The Fractional Working Index</p>
          <h1 className="hero-title">
            <span className="hero-title-accent">Fractional</span>{' '}
            <span className="hero-title-muted">Working Index</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2.5 max-w-md leading-relaxed">
            Market intelligence for fractional executives. A live dashboard on a weekly index, read from 21 data sources.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            aria-label="Refresh index"
            className={`text-muted-foreground hover:text-primary h-8 w-8 ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      <div
        className="instrument-card p-5 sm:p-6"
        style={{ ['--band-accent' as string]: `linear-gradient(90deg, ${band.color}, ${band.color}40)` }}
      >
        <div className="instrument-grid" aria-hidden="true" />

        {/* The single reconciled read: one conclusion the eye lands on first. */}
        <p className="relative text-sm sm:text-[15px] font-semibold text-foreground mb-4 tracking-tight">
          {marketVerdict}
        </p>

        <div className="relative flex flex-col sm:flex-row gap-6 sm:gap-7">
          {/* The gauge instrument */}
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0">
              <svg className="w-full h-full" viewBox="0 0 120 120" role="img" aria-label={`FWI score ${animatedScore} out of 100`}>
                {/* track */}
                <circle
                  cx="60" cy="60" r={R}
                  stroke="hsl(var(--muted))"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${fullArcLen} ${circumference}`}
                  transform={`rotate(${startAngle} 60 60)`}
                />
                {/* progress */}
                <circle
                  cx="60" cy="60" r={R}
                  stroke={band.color}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${progressLen} ${circumference}`}
                  transform={`rotate(${startAngle} 60 60)`}
                  className="score-ring"
                  style={{ filter: `drop-shadow(0 1px 4px ${band.color}55)` }}
                />
                {/* band boundary ticks */}
                {ticks.map((t) => {
                  const p = tickPos(t);
                  return (
                    <line
                      key={t}
                      x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}
                      stroke="hsl(var(--muted-foreground) / 0.35)"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                <span className="score-large" style={{ color: band.color }}>
                  {animatedScore}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground/70 tracking-wider tabular-nums mt-1">
                  / 100
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <span
                className="data-badge w-fit"
                style={{ backgroundColor: band.tint, color: band.text }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: band.color }} />
                {band.name}
              </span>

              <div
                className="inline-flex items-center gap-1.5 w-fit rounded-md px-2 py-1 text-base font-bold tabular-nums"
                style={{
                  color: isFlat ? 'hsl(var(--muted-foreground))' : isPositive ? 'hsl(var(--success))' : 'hsl(var(--error))',
                  backgroundColor: isFlat ? 'hsl(var(--muted))' : isPositive ? 'hsl(var(--success) / 0.10)' : 'hsl(var(--error) / 0.10)',
                }}
              >
                {isFlat ? <Minus size={15} /> : isPositive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                <span>{isPositive && !isFlat ? '+' : ''}{formatDelta(delta)}</span>
                <span className="text-[11px] font-medium opacity-70">pts</span>
              </div>
              <span className="text-[11px] text-muted-foreground -mt-0.5">vs 4 weeks ago</span>

              {data.context?.overallContext && (
                <p className="text-[11px] text-muted-foreground/80 max-w-[210px] leading-relaxed hidden sm:block mt-0.5">
                  {data.context.overallContext}
                </p>
              )}
            </div>
          </div>

          {/* Right side: meta + actions */}
          <div className="sm:ml-auto flex flex-row sm:flex-col items-center sm:items-end justify-between gap-3 sm:text-right">
            <div className="space-y-0.5">
              <div className="section-label">As of</div>
              <div className="text-sm font-semibold text-foreground tabular-nums">
                {new Date(data.asOf).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={onShowMethodology}
              className="w-fit shrink-0"
            >
              <BookOpen size={14} className="mr-1.5" />
              How this works
            </Button>
          </div>
        </div>

        {/* Weight indicators: the instrument's calibration. */}
        <div className="relative mt-5 pt-4 border-t border-hairline">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              Hiring activity <span className="font-semibold text-foreground/80 tabular-nums">{Math.round((data.weights.demand ?? 0.5) * 100)}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              Talent availability <span className="font-semibold text-foreground/80 tabular-nums">{Math.round((data.weights.supply ?? 0.2) * 100)}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
              Market buzz <span className="font-semibold text-foreground/80 tabular-nums">{Math.round((data.weights.culture ?? data.weights.momentum ?? 0.3) * 100)}%</span>
            </span>
          </div>
        </div>

        {/* Forward lean: the Form D Lead, directional not a forecast */}
        <div className="relative mt-3.5 pt-3.5 border-t border-hairline">
          <div className="flex items-start gap-2.5">
            <span className="section-label shrink-0 mt-0.5">Where it's heading</span>
            <p className={`text-xs ${lean.cls} leading-relaxed`}>{lean.txt}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HeroSection;
