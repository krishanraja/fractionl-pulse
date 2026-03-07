import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppShell from '@/components/layout/AppShell';
import HeroSection from '@/components/HeroSection';
import SubIndexCards from '@/components/SubIndexCards';
import TrendlineChart from '@/components/TrendlineChart';
import SignalsTable from '@/components/SignalsTable';
import FractionalReadiness from '@/components/FractionalReadiness';
import AIInsights from '@/components/AIInsights';
import MethodologyDrawer from '@/components/MethodologyDrawer';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { staggerContainer } from '@/lib/motion';
import type { FWIData, Mover } from '@/lib/types';

// FWI score label helper
export const getFWILabel = (score: number): { label: string; emoji: string; color: string } => {
  if (score >= 75) return { label: 'Surging', emoji: '🚀', color: 'text-emerald-400' };
  if (score >= 60) return { label: 'Growing', emoji: '📈', color: 'text-green-400' };
  if (score >= 45) return { label: 'Stable', emoji: '→', color: 'text-yellow-400' };
  if (score >= 30) return { label: 'Cooling', emoji: '📉', color: 'text-orange-400' };
  return { label: 'Contracting', emoji: '⚠️', color: 'text-red-400' };
};

// Fractional Working Index data
// ⚠️ PREVIEW: Real-time data pipeline launching soon. Current data is sample baseline.
const FWI_DATA: FWIData = {
  asOf: "2026-01-12",
  weights: { demand: 0.5, supply: 0.3, culture: 0.2 },
  monthly: {
    months: ["2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01"],
    overall: [52,54,56,57,59,61,62,63,65,66,67,68],
    demand:  [55,57,58,60,62,64,64,66,68,70,71,72],
    supply:  [49,51,54,55,57,58,60,61,63,64,64,65],
    culture: [44,46,47,49,50,53,54,54,56,56,57,58]
  },
  today: {
    overall: 68.4, 
    delta30d: 4.2,
    demand: { score: 72, delta30d: 6.0 },
    supply: { score: 65, delta30d: 3.0 },
    culture: { score: 58, delta30d: 5.0 }
  },
  movers: [
    { skill: "Fractional CMO", type: "demand", change_pct: 12, note: "Enterprise RFP surge" },
    { skill: "AI Strategy Consultant", type: "supply", change_pct: 9, note: "Marketplace listings up" },
    { skill: "Fractional CFO", type: "demand", change_pct: 8, note: "Series A/B hiring cycle" },
    { skill: "Fractional CRO", type: "culture", change_pct: 7, note: "Search interest rising" },
    { skill: "Interim Ops Director", type: "demand", change_pct: 6, note: "Project-based hiring up" }
  ] as Mover[]
};

const Index = () => {
  const [showMethodology, setShowMethodology] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { preferences } = useUserPreferences();

  // Use user-configured weights if customised
  const dataWithUserWeights = {
    ...FWI_DATA,
    weights: preferences.weights ?? FWI_DATA.weights
  };

  const fwiLabel = getFWILabel(dataWithUserWeights.today.overall);

  const renderDashboard = () => (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="container-width space-y-6 py-6"
    >
      {/* Preview banner — remove when real data pipeline is live */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 flex items-center gap-2"
      >
        <span className="text-amber-400 text-xs font-medium">⚡ Preview Mode</span>
        <span className="text-amber-400/70 text-xs">Sample baseline data — live signals launching soon</span>
      </motion.div>

      {/* Hero Section with FWI label */}
      <HeroSection 
        data={dataWithUserWeights}
        fwiLabel={fwiLabel}
        onShowMethodology={() => setShowMethodology(true)} 
      />

      {/* Sub-Index Cards */}
      <section>
        <SubIndexCards data={dataWithUserWeights} compact={preferences.compactMode} />
      </section>

      {/* 12-Month Trendline */}
      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold mb-4 text-foreground">12-Month Trend</h2>
        <TrendlineChart data={dataWithUserWeights.monthly} />
      </section>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 glass-card p-5">
          <h2 className="text-lg font-semibold mb-4 text-foreground">Top Movers</h2>
          <SignalsTable movers={dataWithUserWeights.movers} />
        </section>

        <aside>
          <FractionalReadiness score={dataWithUserWeights.today.overall} label={fwiLabel} />
        </aside>
      </div>

      {/* AI Insights */}
      <section className="glass-card p-5">
        <AIInsights compact />
      </section>
    </motion.div>
  );

  const renderSignals = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container-width py-6"
    >
      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold mb-4 text-foreground">All Market Signals</h2>
        <SignalsTable movers={dataWithUserWeights.movers} />
      </div>
    </motion.div>
  );

  const renderInsights = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container-width py-6"
    >
      <div className="glass-card p-5">
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
        weights={preferences.weights ?? FWI_DATA.weights}
      />
    </AppShell>
  );
};

export default Index;
