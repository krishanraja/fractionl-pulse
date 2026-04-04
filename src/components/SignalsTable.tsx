import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Mover } from '@/lib/types';

interface SignalsTableProps {
  movers: Mover[];
}

const sanitizeSkillName = (skill: string) => {
  const nameMap: Record<string, string> = {
    'Brave News Coverage': 'News Coverage',
    'Web Discourse': 'Online Discourse',
  };
  return nameMap[skill] || skill;
};

const sanitizeNote = (note: string) =>
  note.replace(/\s*\(Brave\)/gi, '').replace(/\s*\(NewsAPI\)/gi, '');

const SignalsTable = ({ movers }: SignalsTableProps) => {
  const getTypeDot = (type: string) => {
    const colors: Record<string, string> = {
      demand: 'bg-primary',
      supply: 'bg-accent', 
      culture: 'bg-secondary'
    };
    return colors[type] || 'bg-muted-foreground';
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      demand: 'Hiring activity',
      supply: 'Talent availability',
      culture: 'Market buzz',
    };
    return labels[type] || type;
  };

  return (
    <div className="overflow-x-auto">
      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {movers.map((mover, index) => (
          <div key={index} className="border border-border rounded-lg p-3 sm:p-4 space-y-2 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${getTypeDot(mover.type)}`} />
                <span className="font-medium text-foreground">{sanitizeSkillName(mover.skill)}</span>
              </div>
              <div className={`flex items-center gap-1 font-semibold text-sm ${
                mover.change_pct >= 0 ? 'stat-up' : 'stat-down'
              }`}>
                {mover.change_pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {mover.change_pct >= 0 ? '+' : ''}{mover.change_pct}% vs avg
              </div>
            </div>
            <p className="text-xs text-muted-foreground/70 mb-0.5">{getTypeLabel(mover.type)}</p>
            <p className="text-sm text-muted-foreground">{sanitizeNote(mover.note)}</p>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <table className="hidden md:table w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Role</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Signal type</th>
            <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">vs. index avg</th>
            <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">What this means</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((mover, index) => (
            <tr key={index} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="py-3.5 px-4">
                <span className="font-medium text-foreground">{sanitizeSkillName(mover.skill)}</span>
              </td>
              <td className="py-3.5 px-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${getTypeDot(mover.type)}`} />
                  <span className="text-sm text-muted-foreground">{getTypeLabel(mover.type)}</span>
                </div>
              </td>
              <td className="py-3.5 px-4 text-right">
                <div className={`inline-flex items-center gap-1 font-semibold text-sm ${
                  mover.change_pct >= 0 ? 'stat-up' : 'stat-down'
                }`}>
                  {mover.change_pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {mover.change_pct >= 0 ? '+' : ''}{mover.change_pct}%
                </div>
              </td>
              <td className="py-3.5 px-4 text-muted-foreground text-sm">
                {sanitizeNote(mover.note)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SignalsTable;
