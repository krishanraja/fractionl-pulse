import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircleQuestion } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import AskIndexModal from '@/components/AskIndexModal';
import HeroSection from '@/components/HeroSection';
import SubIndexCards from '@/components/SubIndexCards';
import MarketSnapshot from '@/components/MarketSnapshot';
import TrendlineChart from '@/components/TrendlineChart';
import SignalsTable from '@/components/SignalsTable';
import FractionalReadiness from '@/components/FractionalReadiness';
import AIInsights from '@/components/AIInsights';
import ContentRadar from '@/components/ContentRadar';
import DataHealthCard from '@/components/DataHealthCard';
import MethodologyDrawer from '@/components/MethodologyDrawer';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useFWIData } from '@/hooks/useFWIData';
import { staggerContainer } from '@/lib/motion';
import { Link } from 'react-router-dom';
import { useProGate } from '@/lib/entitlements';

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
  const [askOpen, setAskOpen] = useState(false);
  const { preferences } = useUserPreferences();
  const { data: fwiData, isLoading, refresh } = useFWIData();
  // Single Pro gate: free sees the recent trend, Pro sees the full 12-month
  // history. Inactive (nothing locked) until self-serve checkout is enabled.
  const { locked: trendLocked } = useProGate();

  const userHasCustomWeights = preferences.weights &&
    (Math.abs(preferences.weights.demand - 0.5) > 0.01 ||
     Math.abs(preferences.weights.supply - 0.2) > 0.01);

  const data = {
    ...fwiData,
    weights: userHasCustomWeights ? preferences.weights : fwiData.weights,
  };

  const fwiLabel = getFWILabel(data.today.overall);

  const trendData = trendLocked
    ? {
        months: data.monthly.months.slice(-5),
        overall: data.monthly.overall.slice(-5),
        demand: data.monthly.demand.slice(-5),
        supply: data.monthly.supply.slice(-5),
        culture: data.monthly.culture.slice(-5),
      }
    : data.monthly;

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
      {/* Hero: the Fractional Working Index title leads the page */}
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

  const renderRadar = () => <ContentRadar />;

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
        {activeTab === 'radar' && renderRadar()}
        {activeTab === 'data' && renderData()}
      </AnimatePresence>

      <MethodologyDrawer
        open={showMethodology}
        onOpenChange={setShowMethodology}
        weights={data.weights}
      />

      {/* Floating "Ask the index" trigger: opens the overlay instead of taking page space.
          Offset above the mobile bottom nav; sits bottom-right on desktop. */}
      {activeTab === 'dashboard' && (
        <button
          onClick={() => setAskOpen(true)}
          aria-label="Ask the index"
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 h-12 w-12 sm:h-auto sm:w-auto sm:px-4 sm:py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <MessageCircleQuestion size={20} className="shrink-0" />
          <span className="hidden sm:inline text-sm font-semibold">Ask the index</span>
        </button>
      )}

      <AskIndexModal open={askOpen} onOpenChange={setAskOpen} />
    </AppShell>
  );
};

export default Index;
