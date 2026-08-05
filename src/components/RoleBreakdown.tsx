import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fadeInUp } from '@/lib/motion';
import { useRoleBreakdown } from '@/hooks/useRoleBreakdown';
import { displayScore, formatDelta } from '@/lib/format';

const RoleBreakdown = () => {
  const { roles, isLoading, asOf } = useRoleBreakdown();

  if (isLoading) return null;
  if (roles.length === 0) {
    return (
      <div className="text-xs text-muted-foreground/60 text-center py-3">
        Role-level data will appear after the first pipeline run.
      </div>
    );
  }

  return (
    // Same fix as FractionalReadiness: drive the variant states locally rather
    // than inheriting an animate label that never arrives, which left the whole
    // by-role breakdown invisible on production.
    <motion.div variants={fadeInUp} initial="hidden" animate="show" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          By role
        </h3>
        {asOf && (
          <span className="text-[10px] text-muted-foreground/50">
            as of {asOf}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {roles.map((role) => (
          <div
            key={role.category}
            className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-foreground truncate">
                {role.label}
              </span>
              <span className="text-xs text-muted-foreground/70 shrink-0">
                {role.rawValue} listings
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-semibold text-foreground tabular-nums w-8 text-right">
                {displayScore(role.score)}
              </span>

              {role.wowChange !== null ? (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium w-14 justify-end ${
                    role.wowChange > 0
                      ? 'stat-up'
                      : role.wowChange < 0
                      ? 'stat-down'
                      : 'text-muted-foreground'
                  }`}
                >
                  {role.wowChange > 0 ? (
                    <TrendingUp size={10} />
                  ) : role.wowChange < 0 ? (
                    <TrendingDown size={10} />
                  ) : (
                    <Minus size={10} />
                  )}
                  {role.wowChange > 0 ? '+' : ''}
                  {formatDelta(role.wowChange)}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/40 w-14 text-right">
                  --
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/50 pt-1">
        Score is normalized (0-100). Change is week-over-week.
      </p>
    </motion.div>
  );
};

export default RoleBreakdown;
