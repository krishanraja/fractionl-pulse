import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PulseInstrument from '@/components/PulseInstrument';
import { useFWIData } from '@/hooks/useFWIData';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

const AIInsights = lazy(() => import('@/components/AIInsights'));
const AskIndexModal = lazy(() => import('@/components/AskIndexModal'));
const ContentRadar = lazy(() => import('@/components/ContentRadar'));
const DataHealthCard = lazy(() => import('@/components/DataHealthCard'));
const MethodologyDrawer = lazy(() => import('@/components/MethodologyDrawer'));
const SignalsTable = lazy(() => import('@/components/SignalsTable'));

const VALID_VIEWS = new Set(['dashboard', 'signals', 'insights', 'data', 'role']);
const ROUTE_ROLES: Record<string, string> = {
  cmo: 'Fractional CMO',
  cfo: 'Fractional CFO',
  cto: 'Fractional CTO',
  coo: 'Fractional COO',
  cro: 'Fractional CRO',
  ceo: 'Interim CEO',
};
const ROLE_ROUTES = Object.fromEntries(Object.entries(ROUTE_ROLES).map(([slug, label]) => [label, slug]));

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [askOpen, setAskOpen] = useState(false);
  const [askPrompt, setAskPrompt] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);
  const [hasOpenedAsk, setHasOpenedAsk] = useState(false);
  const [hasOpenedMethodology, setHasOpenedMethodology] = useState(false);
  const askReturnFocusRef = useRef<HTMLElement | null>(null);
  const methodologyReturnFocusRef = useRef<HTMLElement | null>(null);
  const { data, isLoading, refresh } = useFWIData();
  const { user, signOut } = useAuth();
  const { role, setRole } = useUserRole();
  const roleSlug = location.pathname.startsWith('/fractional-')
    ? location.pathname.slice('/fractional-'.length)
    : null;
  const routeRole = roleSlug ? ROUTE_ROLES[roleSlug] ?? null : null;
  const effectiveRole = routeRole ?? role;

  const requestedView = searchParams.get('view') ?? 'dashboard';
  const activeTab = VALID_VIEWS.has(requestedView) ? requestedView : 'dashboard';

  useEffect(() => {
    if (routeRole) {
      document.title = `${routeRole} market demand | Pulse by Fractionl`;
      return;
    }
    const viewName = activeTab === 'dashboard'
      ? 'Fractional Working Index'
      : activeTab === 'insights'
      ? 'Interpretation'
      : activeTab === 'data'
      ? 'Sources'
      : activeTab === 'role'
      ? 'My role'
      : activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    document.title = `${viewName} | Pulse by Fractionl`;
  }, [activeTab, routeRole]);

  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'dashboard') next.delete('view');
    else next.set('view', tab);
    setSearchParams(next);
  };

  const openAsk = (prompt = '') => {
    askReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setHasOpenedAsk(true);
    setAskPrompt(prompt);
    setAskOpen(true);
  };

  const openMethodology = () => {
    methodologyReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setHasOpenedMethodology(true);
    setShowMethodology(true);
  };

  const restoreFocus = (target: HTMLElement | null, fallbackSelector: string) => {
    window.setTimeout(() => {
      const fallback = document.querySelector<HTMLElement>(fallbackSelector);
      (target?.isConnected ? target : fallback)?.focus();
    }, 0);
  };

  const secondaryContent = <Suspense fallback={<p role="status" aria-live="polite">Loading this view…</p>}>{activeTab === 'signals'
    ? (
      <section aria-labelledby="signals-heading">
        <div className="pulse-secondary-heading">
          <span>Signal register</span>
          <h1 id="signals-heading">What is moving this week</h1>
          <p>Every observed role and signal, compared with the current market average.</p>
        </div>
        {isLoading
          ? <p role="status" aria-live="polite">Retrieving the latest signal register…</p>
          : <SignalsTable movers={data.movers} />}
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
    : null}</Suspense>;

  return (
    <>
      <PulseInstrument
        data={data}
        isLoading={isLoading}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        role={effectiveRole}
        onRoleChange={(nextRole) => {
          if (routeRole) navigate(`/fractional-${ROLE_ROUTES[nextRole] ?? 'cmo'}`);
          else void setRole(nextRole);
        }}
        onAsk={openAsk}
        onShowMethodology={openMethodology}
        onRefresh={refresh}
        isSignedIn={Boolean(user)}
        onSignOut={() => { void signOut(); }}
        secondaryContent={secondaryContent}
      />

      {hasOpenedMethodology && (
        <Suspense fallback={<span role="status" className="sr-only">Opening methodology…</span>}>
          <MethodologyDrawer
            open={showMethodology}
            onOpenChange={(open) => {
              setShowMethodology(open);
              if (!open) restoreFocus(methodologyReturnFocusRef.current, '.pulse-mobile-menu-button');
            }}
            weights={data.weights}
          />
        </Suspense>
      )}

      {hasOpenedAsk && (
        <Suspense fallback={<span role="status" className="sr-only">Opening Ask Pulse…</span>}>
          <AskIndexModal
            open={askOpen}
            onOpenChange={(open) => {
              setAskOpen(open);
              if (!open) restoreFocus(askReturnFocusRef.current, '.pulse-mobile-bottom-nav button:last-child');
            }}
            defaultRole={effectiveRole}
            initialPrompt={askPrompt}
          />
        </Suspense>
      )}
    </>
  );
};

export default Index;
