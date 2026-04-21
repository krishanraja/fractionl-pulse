import { TrendingUp, TrendingDown, Briefcase, Users, Megaphone } from 'lucide-react';
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

const TYPE_CONFIG: Record<string, { label: string; dotClass: string; icon: any }> = {
  demand: { label: 'Hiring activity', dotClass: 'bg-primary', icon: Briefcase },
  supply: { label: 'Talent availability', dotClass: 'bg-accent', icon: Users },
  culture: { label: 'Market buzz', dotClass: 'bg-secondary', icon: Megaphone },
};

const SignalsTable = ({ movers }: SignalsTableProps) => {
  if (movers.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No significant movers this week. Data will appear after the next pipeline run.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Mobile Cards */}
      <div className="block md:hidden space-y-2.5">
        {movers.map((mover, index) => {
          const config = TYPE_CONFIG[mover.type] || TYPE_CONFIG.demand;
          const Icon = config.icon;
          return (
            <div key={index} className="border border-border rounded-lg p-3.5 space-y-2 hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-6 rounded-full ${config.dotClass}`} />
                  <div>
                    <span className="font-medium text-foreground text-sm">{sanitizeSkillName(mover.skill)}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Icon size={10} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{config.label}</span>
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-1 font-semibold text-sm ${
                  mover.change_pct >= 0 ? 'stat-up' : 'stat-down'
                }`}>
                  {mover.change_pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {mover.change_pct >= 0 ? '+' : ''}{mover.change_pct}%
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{sanitizeNote(mover.note)}</p>
            </div>
          );
        })}
      </div>

      {/* Desktop Table */}
      <table className="hidden md:table w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Signal</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Category</th>
            <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">vs. avg</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((mover, index) => {
            const config = TYPE_CONFIG[mover.type] || TYPE_CONFIG.demand;
            return (
              <tr key={index} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-medium text-foreground text-sm">{sanitizeSkillName(mover.skill)}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
                    <span className="text-xs text-muted-foreground">{config.label}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className={`inline-flex items-center gap-1 font-semibold text-sm tabular-nums ${
                    mover.change_pct >= 0 ? 'stat-up' : 'stat-down'
                  }`}>
                    {mover.change_pct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {mover.change_pct >= 0 ? '+' : ''}{mover.change_pct}%
                  </div>
                </td>
                <td className="py-3 px-4 text-muted-foreground text-sm max-w-xs">
                  {sanitizeNote(mover.note)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SignalsTable;
