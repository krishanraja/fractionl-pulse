import { useState } from 'react';
import AIInsights from '@/components/AIInsights';
import AskIndexModal from '@/components/AskIndexModal';
import ContentRadar from '@/components/ContentRadar';
import DataHealthCard from '@/components/DataHealthCard';
import MethodologyDrawer from '@/components/MethodologyDrawer';
import PulseInstrument from '@/components/PulseInstrument';
import SignalsTable from '@/components/SignalsTable';
import { useFWIData } from '@/hooks/useFWIData';
import { useUserRole } from '@/hooks/useUserRole';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [askOpen, setAskOpen] = useState(false);
  const [askPrompt, setAskPrompt] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);
  const { data, isLoading, refresh } = useFWIData();
  const { role, setRole } = useUserRole();

  const openAsk = (prompt = '') => {
    setAskPrompt(prompt);
    setAskOpen(true);
  };

  const secondaryContent = activeTab === 'signals'
    ? (
      <section aria-labelledby="signals-heading">
        <div className="pulse-secondary-heading">
          <span>Signal register</span>
          <h1 id="signals-heading">What is moving this week</h1>
          <p>Every observed role and signal, compared with the current market average.</p>
        </div>
        <SignalsTable movers={data.movers} />
      </section>
    )
    : activeTab === 'insights'
    ? (
      <section aria-labelledby="interpretation-heading">
        <div className="pulse-secondary-heading">
          <span>Interpretation register</span>
          <h1 id="interpretation-heading">What the current evidence can support</h1>
          <p>AI interpretation is kept separate from measured facts and carries its own confidence.</p>
        </div>
        <AIInsights />
      </section>
    )
    : activeTab === 'radar'
    ? <ContentRadar />
    : activeTab === 'data'
    ? (
      <section aria-labelledby="sources-heading">
        <div className="pulse-secondary-heading">
          <span>Evidence register</span>
          <h1 id="sources-heading">Source health and provenance</h1>
          <p>Tracked inputs, their current status and the boundaries of the published index.</p>
        </div>
        <DataHealthCard />
      </section>
    )
    : null;

  return (
    <>
      <PulseInstrument
        data={data}
        isLoading={isLoading}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        role={role}
        onRoleChange={(nextRole) => { void setRole(nextRole); }}
        onAsk={openAsk}
        onShowMethodology={() => setShowMethodology(true)}
        onRefresh={refresh}
        secondaryContent={secondaryContent}
      />

      <MethodologyDrawer
        open={showMethodology}
        onOpenChange={setShowMethodology}
        weights={data.weights}
      />

      <AskIndexModal
        open={askOpen}
        onOpenChange={setAskOpen}
        defaultRole={role}
        initialPrompt={askPrompt}
      />
    </>
  );
};

export default Index;
