import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppShell from '@/components/layout/AppShell';
import HeroSection from '@/components/HeroSection';
import SubIndexCards from '@/components/SubIndexCards';
import MarketSnapshot from '@/components/MarketSnapshot';
import TrendlineChart from '@/components/TrendlineChart';
import SignalsTable from '@/components/SignalsTable';
import FractionalReadiness from '@/components/FractionalReadiness';
import AIInsights from '@/components/AIInsights';
import MethodologyDrawer from '@/components/MethodologyDrawer';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useFWIData } from '@/hooks/useFWIData';
import { staggerContainer } from '@/lib/motion';

export const getFWILabel = (score: number): { label: string; emoji: string; color: string } => {
  if (score >= 75) return { label: 'Surging', emoji: '🚀', color: 'text-emerald-400' };
  if (score >= 60) return { label: 'Growing', emoji: '📈', color: 'text-green-400' };
  if (score >= 45) return { label: 'Stable', emoji: '→', color: 'text-yellow-400' };
  if (score >= 30) return { label: 'Cooling', emoji: '📉', color: 'text-orange-400' };
  return { label: 'Contracting', emoji: '⚠️', color: 'text-red-400' };
};

const Index = () => {
  const [showMethodology, setShowMethodology] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { preferences } = useUserPreferences();
  const { data: fwiData, isLive, isLoading, isStale, lastUpdated, refresh } = useFWIData();

  // Only use preferences weights if user has explicitly changed them from default (50/20/30)
  const userHasCustomWeights = preferences.weights &&
    (Math.abs(preferences.weights.demand - 0.5) > 0.01 ||
     Math.abs(preferences.weights.supply - 0.2) > 0.01);

  const data = {
    ...fwiData,
    weights: userHasCustomWeights ? preferences.weights : fwiData.weights,
  };

  const fwiLabel = getFWILabel(data.today.overall);

  const renderDashboard = () => (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="container-width space-y-6 py-6"
    >
      {/* Live / Preview banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-lg px-4 py-2.5 flex items-center gap-2 ${
          isLive && !isStale
            ? 'bg-emerald-500/10 border border-emerald-500/20'
            : isLive && isStale
            ? 'bg-orange-500/10 border border-orange-500/20'
            : 'bg-amber-500/10 border border-amber-500/20'
        }`}
      >
        {isLive && !isStale ? (
          <>
            <span className="text-emerald-400 text-xs font-medium">● Live</span>
            <span className="text-emerald-400/70 text-xs">
              Updated {lastUpdated
                ? new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'today'}
            </span>
          </>
        ) : isLive && isStale ? (
          <>
            <span className="text-orange-400 text-xs font-medium">● Stale</span>
            <span className="text-orange-400/70 text-xs">
              Last updated {lastUpdated
                ? new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'unknown'} - data may be outdated
            </span>
          </>
        ) : (
          <>
            <span className="text-amber-400 text-xs font-medium">Awaiting First Run</span>
            <span className="text-amber-400/70 text-xs">The data pipeline has not run yet. No real data is displayed. Scores will appear after the first weekly pipeline run.</span>
          </>
        )}
      </motion.div>

      <HeroSection
        data={data}
        fwiLabel={fwiLabel}
        onShowMethodology={() => setShowMethodology(true)}
        onRefresh={refresh}
      />

      <section>
        <SubIndexCards data={data} compact={preferences.compactMode} />
      </section>

      <section>
        <MarketSnapshot />
      </section>

      <section className="glass-card p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">How the market has moved</h2>
          <p className="text-xs text-muted-foreground mt-1">Each point is one week's reading. More weeks = more reliable picture.</p>
        </div>
        <TrendlineChart data={data.monthly} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <section className="lg:col-span-2 glass-card p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">What's moving this week</h2>
            <p className="text-xs text-muted-foreground mt-1">Roles and signals that are notably above or below the index average of all tracked roles this week.</p>
          </div>
          <SignalsTable movers={data.movers} />
        </section>
        <aside>
          <FractionalReadiness score={data.today.overall} label={fwiLabel} />
        </aside>
      </div>

      <section className="glass-card p-4 sm:p-5">
        <AIInsights compact />
      </section>
    </motion.div>
  );

  const renderSignals = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container-width py-6">
      <div className="glass-card p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">All signals this week</h2>
          <p className="text-xs text-muted-foreground mt-1">Every role and signal we tracked, compared to the market average.</p>
        </div>
        <SignalsTable movers={data.movers} />
      </div>
    </motion.div>
  );

  const renderInsights = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container-width py-6">
      <div className="glass-card p-4 sm:p-5">
        <AIInsights />
      </div>
    </motion.div>
  );

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'signals' && renderSignals()}
        {activeTab === 'insights' && renderInsights()}
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
