import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Bell, ChevronDown, X, Download } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import VerdictLine from '@/components/VerdictLine';
import HeroSection from '@/components/HeroSection';
import SubIndexCards from '@/components/SubIndexCards';
import MarketSnapshot from '@/components/MarketSnapshot';
import TrendlineChart from '@/components/TrendlineChart';
import SignalsTable from '@/components/SignalsTable';
import FractionalReadiness from '@/components/FractionalReadiness';
import AIInsights from '@/components/AIInsights';
import DataHealthCard from '@/components/DataHealthCard';
import MethodologyDrawer from '@/components/MethodologyDrawer';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useFWIData } from '@/hooks/useFWIData';
import { staggerContainer } from '@/lib/motion';
import { checkAlerts } from '@/lib/alerts';
import { Link } from 'react-router-dom';
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase';
import { emitEvent } from '@/lib/attribution';
import { useEntitlement } from '@/hooks/useEntitlement';
import { CHECKOUT_ENABLED } from '@/lib/checkout';
import type { AlertItem } from '@/lib/types';

export const getFWILabel = (score: number): { label: string; emoji: string; color: string } => {
  if (score >= 75) return { label: 'Surging', emoji: '🚀', color: 'text-emerald-400' };
  if (score >= 60) return { label: 'Growing', emoji: '📈', color: 'text-green-400' };
  if (score >= 45) return { label: 'Stable', emoji: '→', color: 'text-yellow-400' };
  if (score >= 30) return { label: 'Cooling', emoji: '📉', color: 'text-orange-400' };
  return { label: 'Contracting', emoji: '⚠️', color: 'text-red-400' };
};

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'recently';
  const diffMs = Date.now() - new Date(dateStr + 'T00:00:00Z').getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const Index = () => {
  const [showMethodology, setShowMethodology] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const { preferences } = useUserPreferences();
  const { data: fwiData, isLive, isLoading, isStale, lastUpdated, refresh } = useFWIData();
  const { isPro } = useEntitlement();

  const userHasCustomWeights = preferences.weights &&
    (Math.abs(preferences.weights.demand - 0.5) > 0.01 ||
     Math.abs(preferences.weights.supply - 0.2) > 0.01);

  const data = {
    ...fwiData,
    weights: userHasCustomWeights ? preferences.weights : fwiData.weights,
  };

  const fwiLabel = getFWILabel(data.today.overall);

  // Pro gate: free sees the recent trend, Pro sees the full 12-month history.
  // Only active when self-serve checkout is enabled, so default behavior is unchanged.
  const trendLocked = CHECKOUT_ENABLED && !isPro;
  const trendData = trendLocked
    ? {
        months: data.monthly.months.slice(-5),
        overall: data.monthly.overall.slice(-5),
        demand: data.monthly.demand.slice(-5),
        supply: data.monthly.supply.slice(-5),
        culture: data.monthly.culture.slice(-5),
      }
    : data.monthly;

  const alerts: AlertItem[] = isLive && preferences.alerts.enabled
    ? checkAlerts(data, preferences.alerts.threshold)
    : [];

  const renderStatusBanner = () => {
    if (isLive && !isStale) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl pl-3.5 pr-3 py-2.5 flex items-center justify-between bg-emerald-500/[0.07] border border-emerald-500/20"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="pulse-dot bg-emerald-500 shrink-0" style={{ color: '#10b981' }} />
            <span className="text-emerald-700 text-xs font-semibold tracking-wide">Live</span>
            <span className="text-emerald-700/50 text-xs hidden xs:inline">·</span>
            <span className="text-emerald-700/70 text-xs truncate">
              Updated {formatRelativeTime(lastUpdated)}
            </span>
          </div>
          <button
            onClick={() => {
              void emitEvent('activated', { via: 'export_brief' });
              window.open(`${SUPABASE_FUNCTIONS_URL}/export-brief`, '_blank');
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Download size={12} />
            <span className="hidden sm:inline">Export Brief</span>
          </button>
        </motion.div>
      );
    }
    if (isLive && isStale) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 bg-orange-500/[0.07] border border-orange-500/20"
        >
          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
          <span className="text-orange-700 text-xs font-semibold tracking-wide">Stale</span>
          <span className="text-orange-700/50 text-xs hidden xs:inline">·</span>
          <span className="text-orange-700/70 text-xs truncate">
            Last updated {formatRelativeTime(lastUpdated)}
          </span>
        </motion.div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 bg-amber-500/[0.07] border border-amber-500/20"
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />
        <div className="min-w-0">
          <span className="text-amber-700 text-xs font-semibold tracking-wide">Awaiting first run</span>
          <p className="text-amber-700/70 text-xs leading-relaxed mt-0.5">The pipeline has not run yet. Scores will appear after the first weekly run.</p>
        </div>
      </motion.div>
    );
  };

  const renderDashboardSkeleton = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container-width space-y-5 py-5"
      aria-busy="true"
      aria-label="Loading the index"
    >
      <div className="skeleton-line h-10 rounded-xl" />
      <div className="glass-card-elevated p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="skeleton-line w-7 h-7 rounded-lg" />
          <div className="skeleton-line h-4 w-40" />
        </div>
        <div className="skeleton-line h-12 rounded-xl" />
        <div className="flex gap-1.5">
          <div className="skeleton-line h-7 w-32 rounded-full" />
          <div className="skeleton-line h-7 w-28 rounded-full" />
        </div>
      </div>
      <div className="instrument-card p-5 sm:p-6">
        <div className="flex gap-6">
          <div className="skeleton-line w-32 h-32 sm:w-36 sm:h-36 rounded-full shrink-0" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="skeleton-line h-6 w-28 rounded-full" />
            <div className="skeleton-line h-7 w-24 rounded-md" />
            <div className="skeleton-line h-3 w-40" />
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-hairline flex gap-4">
          <div className="skeleton-line h-3 w-28" />
          <div className="skeleton-line h-3 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-card p-4 sm:p-5 space-y-3">
            <div className="skeleton-line h-4 w-24" />
            <div className="skeleton-line h-8 w-16" />
            <div className="skeleton-line h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </motion.div>
  );

  const renderDashboard = () => (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="container-width space-y-5 py-5"
    >
      {renderStatusBanner()}

      {/* Collapsible alerts */}
      <AnimatePresence>
        {alerts.length > 0 && !alertsDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Collapsible open={alertsExpanded} onOpenChange={setAlertsExpanded}>
              <div className="rounded-lg border border-orange-500/20 bg-orange-500/5">
                <CollapsibleTrigger asChild>
                  <button className="w-full px-4 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer">
                    <span className="flex items-center gap-2 min-w-0">
                      <Bell size={13} className="text-orange-500 shrink-0" />
                      <span className="text-orange-500 font-medium shrink-0">
                        {alerts.length} alert{alerts.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground truncate">
                        {alerts.map(a => a.label).join(', ')}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <ChevronDown size={14} className={`text-muted-foreground transition-transform ${alertsExpanded ? 'rotate-180' : ''}`} />
                      <X
                        size={14}
                        onClick={(e) => { e.stopPropagation(); setAlertsDismissed(true); }}
                        className="text-muted-foreground hover:text-foreground ml-1"
                      />
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-2.5 space-y-1.5 border-t border-orange-500/10 pt-2">
                    {alerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-xs ${
                          alert.direction === 'up' ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        <span className="font-medium">{alert.label}</span>
                        <span className="opacity-70">
                          {alert.direction === 'up' ? '+' : ''}{alert.delta.toFixed(1)} pts to {alert.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Verdict Line: the magic moment leads the dashboard */}
      <VerdictLine />

      {/* Hero */}
      <HeroSection
        data={data}
        fwiLabel={fwiLabel}
        onShowMethodology={() => setShowMethodology(true)}
        onRefresh={refresh}
      />

      {/* Sub-index pillars */}
      <section>
        <SubIndexCards data={data} compact={preferences.compactMode} />
      </section>

      {/* Market snapshot */}
      <section>
        <MarketSnapshot />
      </section>

      {/* Trendline chart */}
      <section className="glass-card p-4 sm:p-5">
        <div className="section-header">
          <div>
            <h2>Market trend</h2>
            <p>Each point is one week's reading across all sub-indices</p>
          </div>
          {data.context?.trendSummary && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">{data.context.trendSummary}</span>
          )}
        </div>
        <TrendlineChart data={trendData} />
        {trendLocked && (
          <Link
            to="/pricing"
            className="mt-3 flex items-center justify-center gap-1.5 text-xs text-primary hover:brightness-110 border border-primary/30 rounded-lg py-2 transition"
          >
            Unlock the full 12-month history with Pro
          </Link>
        )}
      </section>

      {/* Movers + Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 glass-card p-4 sm:p-5">
          <div className="section-header">
            <div>
              <h2>This week's movers</h2>
              <p>Signals notably above or below the index average</p>
            </div>
          </div>
          <SignalsTable movers={data.movers} />
        </section>
        <aside>
          <FractionalReadiness score={data.today.overall} label={fwiLabel} />
        </aside>
      </div>

      {/* AI Insights preview */}
      <section className="glass-card p-4 sm:p-5">
        <AIInsights compact />
      </section>
    </motion.div>
  );

  const renderSignals = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container-width py-5 space-y-4">
      <div className="glass-card p-4 sm:p-5">
        <div className="section-header">
          <div>
            <h2>All signals this week</h2>
            <p>Every role and signal tracked, compared to the market average</p>
          </div>
        </div>
        <SignalsTable movers={data.movers} />
      </div>
    </motion.div>
  );

  const renderInsights = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container-width py-5">
      <div className="glass-card p-4 sm:p-5">
        <AIInsights />
      </div>
    </motion.div>
  );

  const renderData = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container-width py-5">
      <div className="glass-card p-4 sm:p-5">
        <DataHealthCard />
      </div>
    </motion.div>
  );

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (isLoading ? renderDashboardSkeleton() : renderDashboard())}
        {activeTab === 'signals' && renderSignals()}
        {activeTab === 'insights' && renderInsights()}
        {activeTab === 'data' && renderData()}
      </AnimatePresence>

      <MethodologyDrawer
        open={showMethodology}
        onOpenChange={setShowMethodology}
        weights={data.weights}
      />
    </AppShell>
  );
};

export default Index;
