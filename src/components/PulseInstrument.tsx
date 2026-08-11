import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Database,
  FileText,
  Info,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  Minus,
  RefreshCw,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import fractionlIcon from '@/assets/fractionl-icon.png';
import fractionlLogo from '@/assets/fractionl-logo.png';
import { useRoleBreakdown } from '@/hooks/useRoleBreakdown';
import { FRACTIONAL_ROLES } from '@/hooks/useUserRole';
import { displayScore, formatDelta } from '@/lib/format';
import type { FWIData } from '@/lib/types';

type Band = {
  label: string;
  lower: string;
  className: string;
};

const bandFor = (score: number): Band => {
  if (score >= 75) return { label: 'Surging', lower: 'surging', className: 'is-surging' };
  if (score >= 60) return { label: 'Growing', lower: 'growing', className: 'is-growing' };
  if (score >= 45) return { label: 'Stable', lower: 'stable', className: 'is-stable' };
  if (score >= 30) return { label: 'Cooling', lower: 'cooling', className: 'is-cooling' };
  return { label: 'Contracting', lower: 'contracting', className: 'is-contracting' };
};

interface PulseInstrumentProps {
  data: FWIData;
  isLoading: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  role: string | null;
  onRoleChange: (role: string) => void;
  onAsk: (prompt?: string) => void;
  onShowMethodology: () => void;
  onRefresh: () => void;
  isSignedIn: boolean;
  onSignOut: () => void;
  overlayOpen: boolean;
  secondaryContent?: ReactNode;
}

const PulseInstrument = ({
  data,
  isLoading,
  activeTab,
  onTabChange,
  role,
  onRoleChange,
  onAsk,
  onShowMethodology,
  onRefresh,
  isSignedIn,
  onSignOut,
  overlayOpen,
  secondaryContent,
}: PulseInstrumentProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [askPrompt, setAskPrompt] = useState('Should I raise my rates?');
  const [expandedCard, setExpandedCard] = useState<'changed' | 'means' | 'do' | null>(null);
  const { roles, isLoading: rolesLoading } = useRoleBreakdown();

  const score = displayScore(data.today.overall);
  const band = isLoading
    ? { label: 'Loading', lower: 'loading', className: 'is-loading' }
    : bandFor(score);
  const delta = data.today.delta30d;
  const deltaIsFlat = Math.abs(delta) < 0.05;
  const deltaIsPositive = delta > 0;
  const latestConfidence = data.monthly.confidence[data.monthly.confidence.length - 1] ?? 0;
  const coverage = Math.max(0, Math.min(100, Math.round(latestConfidence * 100)));
  const activeRole = role ?? roles[0]?.label ?? 'Fractional CMO';
  // Never substitute another role's reading when the selected role is missing.
  // A fallback here previously labelled the first available role (often CFO) as
  // the viewer's chosen role, creating a materially misleading market read.
  const selectedRole = roles.find((item) => item.label === activeRole) ?? null;
  const roleDemand = selectedRole ? displayScore(selectedRole.score) : null;
  const roleVsMarket = selectedRole ? selectedRole.score - data.today.demand.score : null;

  const timeline = useMemo(() => {
    const values = data.monthly.overall.slice(-7);
    const dates = data.monthly.dates.slice(-7);
    if (values.length === 0) return { points: '', values: [] as number[], dates: [] as string[] };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const points = values.map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 75 - ((value - min) / range) * 50;
      return `${x},${y}`;
    }).join(' ');
    return { points, values, dates };
  }, [data.monthly.dates, data.monthly.overall]);

  const marketSentence = deltaIsFlat
    ? `The market is ${band.lower} and holding its level.`
    : `The market is ${band.lower}, ${deltaIsPositive ? 'with upward movement over 30 days.' : 'with downward movement over 30 days.'}`;

  const roleSentence = selectedRole && roleVsMarket != null
    ? `${selectedRole.label} demand is ${Math.abs(roleVsMarket) < 0.5 ? 'in line with' : roleVsMarket > 0 ? 'above' : 'below'} overall hiring demand.`
    : `No current role-specific demand reading is available for ${activeRole}.`;

  const decisionCue = band.label === 'Contracting' || band.label === 'Cooling'
    ? 'Protect pipeline and validate demand before changing price or capacity.'
    : band.label === 'Surging' || band.label === 'Growing'
    ? 'Pressure-test selective rate or capacity moves against your own pipeline.'
    : 'Hold the broad market assumption steady and use your role read to decide.';

  const submitAsk = (event: FormEvent) => {
    event.preventDefault();
    onAsk(askPrompt);
  };

  const selectTab = (tab: string) => {
    onTabChange(tab);
    setMenuOpen(false);
  };

  const navItems = [
    { id: 'dashboard', label: 'Index', icon: Activity },
    { id: 'signals', label: 'Signals', icon: LayoutGrid },
    { id: 'insights', label: 'Interpret', accessibleLabel: 'Interpretation', icon: BrainCircuit },
    { id: 'data', label: 'Sources', icon: Database },
  ];

  const renderTrend = (mobile = false) => (
    <div className={mobile ? 'pulse-mobile-trend' : 'pulse-timeline'} aria-label="Recent index readings">
      {!mobile && (
        <div className="pulse-section-kicker-row">
          <span>Recent index timeline</span>
          <span>Latest {score}</span>
        </div>
      )}
      <svg viewBox="0 0 100 92" preserveAspectRatio="none" role="img" aria-label={`The latest index reading is ${score}`}>
        <line x1="0" y1="75" x2="100" y2="75" className="pulse-chart-baseline" />
        <polyline points={timeline.points} className="pulse-chart-line" />
        {timeline.values.map((value, index) => {
          const x = timeline.values.length === 1 ? 50 : (index / (timeline.values.length - 1)) * 100;
          const min = Math.min(...timeline.values);
          const max = Math.max(...timeline.values);
          const y = 75 - ((value - min) / Math.max(1, max - min)) * 50;
          const isLast = index === timeline.values.length - 1;
          return <circle key={`${timeline.dates[index]}-${index}`} cx={x} cy={y} r={isLast ? 2.7 : 1.7} className={isLast ? 'pulse-chart-point is-current' : 'pulse-chart-point'} />;
        })}
      </svg>
      {!mobile && (
        <div className="pulse-timeline-labels" aria-hidden="true">
          {timeline.dates.map((date, index) => (
            <span key={`${date}-${index}`}>
              {new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const renderRoleLens = (mobile = false) => (
    <section className={mobile ? 'pulse-mobile-role-card' : 'pulse-role-lens'} aria-labelledby={mobile ? 'mobile-role-heading' : 'role-lens-heading'}>
      <div className="pulse-role-heading-row">
        <div>
          <span className="pulse-section-kicker">Your role</span>
          <h2 id={mobile ? 'mobile-role-heading' : 'role-lens-heading'}>{activeRole}</h2>
        </div>
        <label className="pulse-role-select-label">
          <span className="sr-only">Choose role</span>
          <select value={activeRole} onChange={(event) => onRoleChange(event.target.value)}>
            {FRACTIONAL_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="pulse-role-metrics">
        <div>
          <span>Demand for this role</span>
          <strong>{isLoading || rolesLoading ? '--' : roleDemand ?? '--'}</strong>
          <small>{isLoading ? 'Retrieving' : selectedRole?.wowChange == null ? 'Current read' : `${selectedRole.wowChange > 0 ? '+' : ''}${formatDelta(selectedRole.wowChange)} WoW`}</small>
        </div>
        <div>
          <span>Overall hiring demand</span>
          <strong>{isLoading ? '--' : displayScore(data.today.demand.score)}</strong>
          <small>{isLoading ? 'Retrieving' : data.today.demand.delta30d == null ? 'New series' : `${data.today.demand.delta30d > 0 ? '+' : ''}${formatDelta(data.today.demand.delta30d)} / 30d`}</small>
        </div>
        <div>
          <span>Executive availability</span>
          <strong>{isLoading || data.today.supply.score == null ? '--' : displayScore(data.today.supply.score)}</strong>
          <small>{isLoading ? 'Retrieving' : data.today.supply.score == null ? 'Not measured' : 'Market-wide'}</small>
        </div>
        <div>
          <span>Market interest</span>
          <strong>{isLoading ? '--' : displayScore(data.today.culture.score)}</strong>
          <small>{isLoading ? 'Retrieving' : 'Market-wide'}</small>
        </div>
      </div>
      <p className="pulse-role-note">{isLoading ? 'Loading the current role and market comparison.' : roleSentence}</p>
    </section>
  );

  const renderDesktopIndex = () => (
    <div className="pulse-desktop-index">
      <section className="pulse-index-intro">
        <p className="pulse-overline">Public market instrument</p>
        <h1>Fractional<br />Working Index</h1>
        <p className="pulse-index-deck">One public read on the fractional executive market, with the evidence and limits kept in view.</p>
      </section>

      <section className="pulse-score-band" aria-label={isLoading ? 'Loading the current Fractional Working Index reading' : `Fractional Working Index ${score}, ${band.label}`}>
        <div className="pulse-score-number">{isLoading ? '--' : score}</div>
        <div className="pulse-score-state">
          <div className={`pulse-band-label ${band.className}`}><span />{band.label}</div>
          {isLoading ? (
            <div className="pulse-delta is-flat" role="status" aria-live="polite"><RefreshCw /><strong>Retrieving</strong><span>latest evidence</span></div>
          ) : (
            <div className={`pulse-delta ${deltaIsFlat ? 'is-flat' : deltaIsPositive ? 'is-up' : 'is-down'}`}>
              {deltaIsFlat ? <Minus /> : deltaIsPositive ? <ArrowUpRight /> : <ArrowDownRight />}
              <strong>{deltaIsPositive && !deltaIsFlat ? '+' : ''}{formatDelta(delta)}</strong>
              <span>/ 30 days</span>
            </div>
          )}
        </div>
        <div className="pulse-score-meta">
          <strong>{isLoading ? '--' : `${coverage}%`}</strong>
          <span>{isLoading ? 'checking data coverage' : 'data coverage'}</span>
          <small>{isLoading ? 'Checking live sources' : `As of ${new Date(`${data.asOf}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`}</small>
          <button type="button" onClick={onRefresh} aria-label="Refresh index"><RefreshCw /></button>
        </div>
      </section>

      {isLoading
        ? <div className="pulse-timeline pulse-loading-copy" role="status" aria-live="polite">Retrieving the latest verified reading…</div>
        : renderTrend()}
      {renderRoleLens()}

      <section className="pulse-calibration" aria-labelledby="calibration-heading">
        <div className="pulse-section-kicker-row">
          <span id="calibration-heading">Index calibration</span>
          <button type="button" onClick={onShowMethodology}>View methodology <ArrowRight /></button>
        </div>
        <div className="pulse-calibration-grid">
          {[
            ['Hiring activity', data.weights.demand, 'Demand'],
            ['Executive availability', data.weights.supply, 'Availability'],
            ['Market interest', data.weights.culture, 'Interest'],
          ].map(([label, weight, short]) => (
            <div key={String(label)}>
              <div><span>{String(label)}</span><strong>{Math.round(Number(weight) * 100)}%</strong></div>
              <span className="pulse-weight-track"><span style={{ width: `${Number(weight) * 100}%` }} /></span>
              <small>{String(short)} pillar</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const taskCards = [
    {
      id: 'changed' as const,
      title: 'What changed',
      body: isLoading ? 'Retrieving the latest verified movement.' : deltaIsFlat ? 'The overall index held its level over 30 days.' : `The overall index moved ${formatDelta(Math.abs(delta))} points ${deltaIsPositive ? 'higher' : 'lower'} over 30 days.`,
      detail: isLoading ? 'This interpretation will appear when the current evidence has loaded.' : data.context?.overallContext ?? marketSentence,
      icon: Activity,
    },
    {
      id: 'means' as const,
      title: 'What it means',
      body: isLoading ? 'Checking the market level against your role.' : `${marketSentence} ${roleSentence}`,
      detail: 'The level and the movement are separate facts. Pulse shows both so a stable level is not mistaken for a forecast.',
      icon: BrainCircuit,
    },
    {
      id: 'do' as const,
      title: 'What to consider',
      body: isLoading ? 'A decision cue will appear after the evidence is verified.' : decisionCue,
      detail: 'This is a decision cue, not financial advice. Open Ask the Index with your exact role, geography and decision for a bounded interpretation.',
      icon: ArrowUpRight,
    },
  ];

  const renderMobileIndex = () => (
    <div className="pulse-mobile-index">
      <section className="pulse-mobile-score" aria-label={isLoading ? 'Loading the current Fractional Working Index reading' : `Fractional Working Index ${score}, ${band.label}`}>
        <span>Fractional Working Index</span>
        <strong>{isLoading ? '--' : score}</strong>
        <div className={`pulse-mobile-band ${band.className}`}>{band.label}<i /></div>
        <p>{isLoading ? 'Retrieving latest evidence' : `${deltaIsPositive && !deltaIsFlat ? '+' : ''}${formatDelta(delta)} / 30 days`}</p>
        <div className="pulse-mobile-coverage"><span>{isLoading ? 'Checking data coverage' : `${coverage}% data coverage`}</span><span>{isLoading ? 'Live sources' : data.asOf}</span></div>
      </section>
      {isLoading ? <div className="pulse-mobile-trend pulse-loading-copy" role="status" aria-live="polite">Loading current timeline…</div> : renderTrend(true)}
      <section className="pulse-mobile-decisions" aria-label="Index interpretation">
        {taskCards.map((card) => {
          const Icon = card.icon;
          const expanded = expandedCard === card.id;
          return (
            <button key={card.id} type="button" onClick={() => setExpandedCard(expanded ? null : card.id)} aria-expanded={expanded}>
              <span className="pulse-mobile-card-icon"><Icon /></span>
              <span className="pulse-mobile-card-copy"><strong>{card.title}</strong><span>{card.body}</span>{expanded && <small>{card.detail}</small>}</span>
              <ArrowRight className={expanded ? 'is-rotated' : ''} />
            </button>
          );
        })}
      </section>
      <button type="button" className="pulse-mobile-provenance" onClick={onShowMethodology}>
        <FileText /> Sources and methods <ArrowRight />
      </button>
    </div>
  );

  const renderAskPanel = () => (
    <aside className="pulse-ask-panel" aria-labelledby="ask-panel-heading">
      <div className="pulse-ask-heading">
        <span id="ask-panel-heading">Ask the Index</span>
        <button type="button" onClick={() => setAskPrompt('')} aria-label="Clear Ask the Index question"><Minus /></button>
      </div>
      <form onSubmit={submitAsk} className="pulse-ask-form">
        <label htmlFor="pulse-ask-question">Your decision</label>
        <div>
          <input id="pulse-ask-question" value={askPrompt} onChange={(event) => setAskPrompt(event.target.value)} maxLength={280} placeholder="What are you deciding?" />
          <button type="submit" aria-label="Ask the Index" disabled={!askPrompt.trim()}><Send /></button>
        </div>
      </form>

      <div className="pulse-ask-stack">
        <section>
          <div className="pulse-ask-card-title"><span><Activity /></span><strong>Measured facts</strong></div>
          {isLoading ? (
            <p role="status" aria-live="polite">Retrieving the latest measured facts.</p>
          ) : (
            <ul>
              <li>FWI is {score}, classified {band.lower}.</li>
              <li>Hiring activity is {displayScore(data.today.demand.score)}.</li>
              <li>Current data coverage is {coverage}%.</li>
            </ul>
          )}
          <div className="pulse-receipts"><span>21 inputs</span><span>6 roles</span><span>US primary</span></div>
        </section>
        <section>
          <div className="pulse-ask-card-title"><span><BrainCircuit /></span><strong>What the data suggests</strong></div>
          <p>{isLoading ? 'Interpretation will appear after the current evidence is verified.' : `${marketSentence} ${roleSentence}`}</p>
          <div className="pulse-receipts"><span>Index level</span><span>30-day movement</span></div>
        </section>
        <section className="is-decision">
          <div className="pulse-ask-card-title"><span><ArrowUpRight /></span><strong>What to consider</strong></div>
          <p>{isLoading ? 'A decision cue will appear after the current evidence is verified.' : decisionCue}</p>
          <button type="button" onClick={() => onAsk(askPrompt)}>Ask about my situation <ArrowRight /></button>
        </section>
      </div>

      <button className="pulse-provenance-link" type="button" onClick={onShowMethodology}>
        <FileText /> Sources and methods <span>21 tracked inputs</span><ArrowRight />
      </button>
    </aside>
  );

  const mobileMain = activeTab === 'role'
    ? <div className="pulse-mobile-role-view">{renderRoleLens(true)}<p>We can measure hiring demand for this role. We do not yet have reliable role-by-role data for executive availability or market interest, so those two scores reflect the overall market.</p></div>
    : activeTab === 'dashboard'
    ? renderMobileIndex()
    : <div className="pulse-mobile-secondary">{secondaryContent}</div>;

  return (
    <div className="pulse-stage">
      <div className="pulse-product-frame">
        <header className="pulse-product-header">
          <img className="pulse-mobile-brand-icon" src={fractionlIcon} alt="" />
          <div className="pulse-brand-lockup">
            <img src={fractionlLogo} alt="Fractionl" />
            <span aria-hidden="true" />
            <strong>Pulse</strong>
          </div>
          <p>Public market instrument for the<br />fractional executive economy</p>
          <button type="button" className="pulse-mobile-menu-button" onClick={() => setMenuOpen((current) => !current)} aria-expanded={menuOpen} aria-controls="pulse-mobile-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </header>

        <aside className="pulse-desktop-rail" aria-label="Primary navigation">
          <div className="pulse-rail-mark"><img src={fractionlIcon} alt="" /></div>
          <nav>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" onClick={() => selectTab(item.id)} className={activeTab === item.id ? 'is-active' : ''} aria-label={item.accessibleLabel ?? item.label} aria-current={activeTab === item.id ? 'page' : undefined}>
                  <Icon /><span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <button type="button" onClick={onShowMethodology} aria-label="Sources and methods"><Info /><span>Methods</span></button>
          {isSignedIn ? (
            <button type="button" onClick={onSignOut} aria-label="Sign out"><LogOut /><span>Exit</span></button>
          ) : (
            <Link className="pulse-rail-auth-link" to="/login" aria-label="Sign in"><LogIn /><span>Sign in</span></Link>
          )}
        </aside>

        {menuOpen && (
          <nav id="pulse-mobile-menu" className="pulse-mobile-menu" aria-label="More navigation">
            <button type="button" onClick={() => selectTab('signals')}><LayoutGrid /> Signals</button>
            <button type="button" onClick={() => selectTab('insights')}><BrainCircuit /> Interpretation</button>
            <button type="button" onClick={() => selectTab('data')}><Database /> Sources</button>
            <button type="button" onClick={() => { onShowMethodology(); setMenuOpen(false); }}><Info /> Sources and methods</button>
            <Link to="/pricing"><FileText /> Partner access</Link>
            {isSignedIn
              ? <button type="button" onClick={() => { onSignOut(); setMenuOpen(false); }}><LogOut /> Sign out</button>
              : <Link to="/login"><LogIn /> Sign in</Link>}
          </nav>
        )}

        <main className="pulse-product-main">
          <div className="pulse-desktop-only">
            {activeTab === 'dashboard' ? renderDesktopIndex() : <div className="pulse-desktop-secondary">{secondaryContent}</div>}
          </div>
          <div className="pulse-mobile-only">{mobileMain}</div>
        </main>

        <div className="pulse-desktop-only">{renderAskPanel()}</div>

        {!overlayOpen && (
          <nav className="pulse-mobile-bottom-nav" aria-label="Mobile primary navigation">
            <button type="button" onClick={() => selectTab('dashboard')} className={activeTab === 'dashboard' ? 'is-active' : ''}><Activity /><span>Index</span></button>
            <button type="button" onClick={() => selectTab('role')} className={activeTab === 'role' ? 'is-active' : ''}><UserRound /><span>My role</span></button>
            <button type="button" onClick={() => onAsk(askPrompt)}><MessageSquareText /><span>Ask</span></button>
          </nav>
        )}
      </div>
    </div>
  );
};

export default PulseInstrument;
