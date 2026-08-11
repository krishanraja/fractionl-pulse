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
  secondaryContent,
}: PulseInstrumentProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [askPrompt, setAskPrompt] = useState('Should I raise my rates?');
  const [expandedCard, setExpandedCard] = useState<'changed' | 'means' | 'do' | null>(null);
  const { roles, isLoading: rolesLoading } = useRoleBreakdown();

  const score = displayScore(data.today.overall);
  const band = bandFor(score);
  const delta = data.today.delta30d;
  const deltaIsFlat = Math.abs(delta) < 0.05;
  const deltaIsPositive = delta > 0;
  const latestConfidence = data.monthly.confidence[data.monthly.confidence.length - 1] ?? 0;
  const coverage = Math.max(0, Math.min(100, Math.round(latestConfidence * 100)));
  const activeRole = role ?? roles[0]?.label ?? 'Fractional CMO';
  const selectedRole = roles.find((item) => item.label === activeRole) ?? roles[0] ?? null;
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
    ? `${selectedRole.label} demand is ${Math.abs(roleVsMarket) < 0.5 ? 'in line with' : roleVsMarket > 0 ? 'above' : 'below'} the market demand reading.`
    : 'Choose a role to compare its observed demand with the market.';

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
          <span className="pulse-section-kicker">Role lens</span>
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
          <span>Role demand</span>
          <strong>{rolesLoading ? '--' : roleDemand ?? '--'}</strong>
          <small>{selectedRole?.wowChange == null ? 'Current read' : `${selectedRole.wowChange > 0 ? '+' : ''}${formatDelta(selectedRole.wowChange)} WoW`}</small>
        </div>
        <div>
          <span>Market demand</span>
          <strong>{displayScore(data.today.demand.score)}</strong>
          <small>{data.today.demand.delta30d == null ? 'New series' : `${data.today.demand.delta30d > 0 ? '+' : ''}${formatDelta(data.today.demand.delta30d)} / 30d`}</small>
        </div>
        <div>
          <span>Talent availability</span>
          <strong>{data.today.supply.score == null ? '--' : displayScore(data.today.supply.score)}</strong>
          <small>{data.today.supply.score == null ? 'Not measured' : 'Market-wide'}</small>
        </div>
        <div>
          <span>Market buzz</span>
          <strong>{displayScore(data.today.culture.score)}</strong>
          <small>Market-wide</small>
        </div>
      </div>
      <p className="pulse-role-note">{roleSentence}</p>
    </section>
  );

  const renderDesktopIndex = () => (
    <div className="pulse-desktop-index">
      <section className="pulse-index-intro">
        <p className="pulse-overline">Independent market instrument</p>
        <h1>Fractional<br />Working Index</h1>
        <p className="pulse-index-deck">One public read on the fractional executive market, with the evidence and limits kept in view.</p>
      </section>

      <section className="pulse-score-band" aria-label={`Fractional Working Index ${score}, ${band.label}`}>
        <div className="pulse-score-number">{isLoading ? '--' : score}</div>
        <div className="pulse-score-state">
          <div className={`pulse-band-label ${band.className}`}><span />{band.label}</div>
          <div className={`pulse-delta ${deltaIsFlat ? 'is-flat' : deltaIsPositive ? 'is-up' : 'is-down'}`}>
            {deltaIsFlat ? <Minus /> : deltaIsPositive ? <ArrowUpRight /> : <ArrowDownRight />}
            <strong>{deltaIsPositive && !deltaIsFlat ? '+' : ''}{formatDelta(delta)}</strong>
            <span>/ 30 days</span>
          </div>
        </div>
        <div className="pulse-score-meta">
          <strong>{coverage}%</strong>
          <span>evidence coverage</span>
          <small>As of {new Date(`${data.asOf}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</small>
          <button type="button" onClick={onRefresh} aria-label="Refresh index"><RefreshCw /></button>
        </div>
      </section>

      {renderTrend()}
      {renderRoleLens()}

      <section className="pulse-calibration" aria-labelledby="calibration-heading">
        <div className="pulse-section-kicker-row">
          <span id="calibration-heading">Index calibration</span>
          <button type="button" onClick={onShowMethodology}>View methodology <ArrowRight /></button>
        </div>
        <div className="pulse-calibration-grid">
          {[
            ['Hiring activity', data.weights.demand, 'Demand'],
            ['Talent availability', data.weights.supply, 'Supply'],
            ['Market buzz', data.weights.culture, 'Culture'],
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
      body: deltaIsFlat ? 'The overall index held its level over 30 days.' : `The overall index moved ${formatDelta(Math.abs(delta))} points ${deltaIsPositive ? 'higher' : 'lower'} over 30 days.`,
      detail: data.context?.overallContext ?? marketSentence,
      icon: Activity,
    },
    {
      id: 'means' as const,
      title: 'What it means',
      body: `${marketSentence} ${roleSentence}`,
      detail: 'The level and the movement are separate facts. Pulse shows both so a stable level is not mistaken for a forecast.',
      icon: BrainCircuit,
    },
    {
      id: 'do' as const,
      title: 'What to do',
      body: decisionCue,
      detail: 'This is a decision cue, not financial advice. Open Ask Pulse with your exact role, geography and decision for a bounded interpretation.',
      icon: ArrowUpRight,
    },
  ];

  const renderMobileIndex = () => (
    <div className="pulse-mobile-index">
      <section className="pulse-mobile-score" aria-label={`Fractional Working Index ${score}, ${band.label}`}>
        <span>Fractional Working Index</span>
        <strong>{isLoading ? '--' : score}</strong>
        <div className={`pulse-mobile-band ${band.className}`}>{band.label}<i /></div>
        <p>{deltaIsPositive && !deltaIsFlat ? '+' : ''}{formatDelta(delta)} / 30 days</p>
        <div className="pulse-mobile-coverage"><span>{coverage}% evidence coverage</span><span>{data.asOf}</span></div>
      </section>
      {renderTrend(true)}
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
        <FileText /> View methodology and evidence <ArrowRight />
      </button>
    </div>
  );

  const renderAskPanel = () => (
    <aside className="pulse-ask-panel" aria-labelledby="ask-panel-heading">
      <div className="pulse-ask-heading">
        <span>Ask Pulse</span>
        <button type="button" onClick={() => setAskPrompt('')} aria-label="Clear Ask Pulse question"><Minus /></button>
      </div>
      <form onSubmit={submitAsk} className="pulse-ask-form">
        <label htmlFor="pulse-ask-question">Your decision</label>
        <div>
          <input id="pulse-ask-question" value={askPrompt} onChange={(event) => setAskPrompt(event.target.value)} maxLength={280} placeholder="What are you deciding?" />
          <button type="submit" aria-label="Ask Pulse" disabled={!askPrompt.trim()}><Send /></button>
        </div>
      </form>

      <div className="pulse-ask-stack">
        <section>
          <div className="pulse-ask-card-title"><span><Activity /></span><strong>Measured facts</strong></div>
          <ul>
            <li>FWI is {score}, classified {band.lower}.</li>
            <li>Hiring activity is {displayScore(data.today.demand.score)}.</li>
            <li>Current evidence coverage is {coverage}%.</li>
          </ul>
          <div className="pulse-receipts"><span>21 inputs</span><span>6 roles</span><span>US + UK</span></div>
        </section>
        <section>
          <div className="pulse-ask-card-title"><span><BrainCircuit /></span><strong>Interpretation</strong></div>
          <p>{marketSentence} {roleSentence}</p>
          <div className="pulse-receipts"><span>Index level</span><span>30-day movement</span></div>
        </section>
        <section className="is-decision">
          <div className="pulse-ask-card-title"><span><ArrowUpRight /></span><strong>Decision cue</strong></div>
          <p>{decisionCue}</p>
          <button type="button" onClick={() => onAsk(askPrompt)}>Ask with my situation <ArrowRight /></button>
        </section>
      </div>

      <button className="pulse-provenance-link" type="button" onClick={onShowMethodology}>
        <FileText /> View provenance <span>21 tracked inputs</span><ArrowRight />
      </button>
    </aside>
  );

  const mobileMain = activeTab === 'role'
    ? <div className="pulse-mobile-role-view">{renderRoleLens(true)}<p>Role demand is a real observed series. Talent availability and market buzz remain market-wide because the current sources do not support defensible role-level splits.</p></div>
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
          <button type="button" className="pulse-mobile-menu-button" onClick={() => setMenuOpen((current) => !current)} aria-expanded={menuOpen} aria-label="Open navigation">
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
          <button type="button" onClick={onShowMethodology} aria-label="Methodology"><Info /><span>Method</span></button>
        </aside>

        {menuOpen && (
          <nav className="pulse-mobile-menu" aria-label="More navigation">
            <button type="button" onClick={() => selectTab('signals')}><LayoutGrid /> Signals</button>
            <button type="button" onClick={() => selectTab('insights')}><BrainCircuit /> Interpretation</button>
            <button type="button" onClick={() => selectTab('data')}><Database /> Sources</button>
            <button type="button" onClick={() => { onShowMethodology(); setMenuOpen(false); }}><Info /> Methodology</button>
            <Link to="/pricing"><FileText /> Partner access</Link>
          </nav>
        )}

        <main className="pulse-product-main">
          <div className="pulse-desktop-only">
            {activeTab === 'dashboard' ? renderDesktopIndex() : <div className="pulse-desktop-secondary">{secondaryContent}</div>}
          </div>
          <div className="pulse-mobile-only">{mobileMain}</div>
        </main>

        <div className="pulse-desktop-only">{renderAskPanel()}</div>

        <nav className="pulse-mobile-bottom-nav" aria-label="Mobile primary navigation">
          <button type="button" onClick={() => selectTab('dashboard')} className={activeTab === 'dashboard' ? 'is-active' : ''}><Activity /><span>Index</span></button>
          <button type="button" onClick={() => selectTab('role')} className={activeTab === 'role' ? 'is-active' : ''}><UserRound /><span>My role</span></button>
          <button type="button" onClick={() => onAsk(askPrompt)}><MessageSquareText /><span>Ask</span></button>
        </nav>
      </div>
    </div>
  );
};

export default PulseInstrument;
