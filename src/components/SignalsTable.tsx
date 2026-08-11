import { Briefcase, Megaphone, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Mover } from '@/lib/types';

interface SignalsTableProps {
  movers: Mover[];
}

const sanitizeSkillName = (skill: string) => {
  const nameMap: Record<string, string> = {
    'Brave News Coverage': 'News Coverage',
    'Web Discourse': 'Online Discourse',
    'Prestige Media': 'Major Publications',
    'Audio Culture': 'Podcast Mentions',
    'Community Buzz': 'Community Discourse',
    'Marketplace Listings': 'Marketplace Supply',
    'Supply Intent': 'Supply Search Interest',
    'Self-Employment Rate': 'Self-Employment',
  };
  return nameMap[skill] || skill;
};

const sanitizeNote = (note: string) =>
  note.replace(/\s*\(Brave\)/gi, '').replace(/\s*\(NewsAPI\)/gi, '');

const TYPE_CONFIG: Record<string, { label: string; tone: string; icon: LucideIcon }> = {
  demand: { label: 'Hiring activity', tone: 'is-demand', icon: Briefcase },
  supply: { label: 'Executive availability', tone: 'is-supply', icon: Users },
  culture: { label: 'Market interest', tone: 'is-interest', icon: Megaphone },
};

const SignalsTable = ({ movers }: SignalsTableProps) => {
  if (movers.length === 0) {
    return <div className="pulse-register-empty"><p>No significant changes this week. New readings will appear after the next pipeline run.</p></div>;
  }

  return (
    <div className="pulse-signal-register">
      <div className="pulse-signal-cards">
        {movers.map((mover, index) => {
          const config = TYPE_CONFIG[mover.type] || TYPE_CONFIG.demand;
          const Icon = config.icon;
          const direction = mover.change_pct >= 0 ? 'is-up' : 'is-down';
          return (
            <article key={index} className={`pulse-signal-card ${config.tone}`}>
              <header>
                <span className="pulse-signal-icon" aria-hidden="true"><Icon /></span>
                <div>
                  <strong>{sanitizeSkillName(mover.skill)}</strong>
                  <span>{config.label}</span>
                </div>
                <span className={`pulse-signal-change ${direction}`}>
                  {mover.change_pct >= 0 ? <TrendingUp aria-hidden="true" /> : <TrendingDown aria-hidden="true" />}
                  {mover.change_pct >= 0 ? '+' : ''}{mover.change_pct}%
                </span>
              </header>
              <p>{sanitizeNote(mover.note)}</p>
            </article>
          );
        })}
      </div>

      <table className="pulse-signal-table">
        <thead>
          <tr>
            <th>Signal</th>
            <th>What it measures</th>
            <th>Vs. current average</th>
            <th>What changed</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((mover, index) => {
            const config = TYPE_CONFIG[mover.type] || TYPE_CONFIG.demand;
            const direction = mover.change_pct >= 0 ? 'is-up' : 'is-down';
            return (
              <tr key={index}>
                <td><strong>{sanitizeSkillName(mover.skill)}</strong></td>
                <td><span className={`pulse-signal-category ${config.tone}`}>{config.label}</span></td>
                <td>
                  <span className={`pulse-signal-change ${direction}`}>
                    {mover.change_pct >= 0 ? <TrendingUp aria-hidden="true" /> : <TrendingDown aria-hidden="true" />}
                    {mover.change_pct >= 0 ? '+' : ''}{mover.change_pct}%
                  </span>
                </td>
                <td>{sanitizeNote(mover.note)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SignalsTable;
