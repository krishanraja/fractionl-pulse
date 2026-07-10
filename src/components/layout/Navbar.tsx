import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, User, LogIn, UserPlus, Database, Bell, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SettingsSheet from '@/components/SettingsSheet';
import fractionlLogo from '@/assets/fractionl-logo.png';
import { useFWIData } from '@/hooks/useFWIData';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { checkAlerts } from '@/lib/alerts';
import { displayScore, formatDelta } from '@/lib/format';
import { formatRelativeTime } from '@/lib/time';
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase';
import { emitEvent } from '@/lib/attribution';
import type { AlertItem } from '@/lib/types';

const Navbar = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { data, isLive, isStale, lastUpdated } = useFWIData();
  const { preferences } = useUserPreferences();

  const alerts: AlertItem[] = isLive && preferences.alerts.enabled
    ? checkAlerts(data, preferences.alerts.threshold)
    : [];

  // Live status colour: emerald = live & fresh, orange = stale, amber = awaiting first run.
  const status = isLive ? (isStale ? 'stale' : 'live') : 'awaiting';
  const statusDot =
    status === 'live' ? 'bg-emerald-500'
    : status === 'stale' ? 'bg-orange-500'
    : 'bg-amber-500';
  const statusLabel =
    status === 'live' ? 'Live'
    : status === 'stale' ? 'Stale'
    : 'Awaiting first run';

  return (
    <>
      <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container-width">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <img
                src={fractionlLogo}
                alt="Fractionl"
                className="h-5 md:h-7 object-contain"
                loading="eager"
                decoding="sync"
                fetchPriority="high"
              />
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground/70 bg-muted/50 rounded-full px-2.5 py-1">
                <Database size={10} />
                <span>21 live sources</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Live status indicator + Export Brief */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    aria-label={`Status: ${statusLabel}`}
                    className="flex items-center gap-1.5 h-8 rounded-full px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot} ${status === 'live' ? 'pulse-dot' : ''}`} />
                    <span className="hidden sm:inline text-[11px] font-semibold tracking-wide">{statusLabel}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
                    <span className="text-sm font-semibold">{statusLabel}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isLive
                      ? `Updated ${formatRelativeTime(lastUpdated)}`
                      : 'The pipeline has not run yet. Scores appear after the first weekly run.'}
                  </p>
                  {isLive && (
                    <button
                      onClick={() => {
                        void emitEvent('activated', { via: 'export_brief' });
                        window.open(`${SUPABASE_FUNCTIONS_URL}/export-brief`, '_blank');
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-lg px-2.5 py-2 transition-colors"
                    >
                      <Download size={13} />
                      Export Brief
                    </button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Alerts bell */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    aria-label={`${alerts.length} alert${alerts.length === 1 ? '' : 's'}`}
                    className="relative flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Bell size={16} />
                    {alerts.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold leading-none">
                        {alerts.length}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell size={13} className="text-orange-500" />
                    <span className="text-sm font-semibold">
                      {alerts.length > 0
                        ? `${alerts.length} alert${alerts.length === 1 ? '' : 's'}`
                        : 'No alerts'}
                    </span>
                  </div>
                  {alerts.length > 0 ? (
                    <div className="space-y-1.5">
                      {alerts.map((alert, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between gap-2 text-xs ${
                            alert.direction === 'up' ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          <span className="font-medium">{alert.label}</span>
                          <span className="opacity-70 tabular-nums shrink-0">
                            {alert.direction === 'up' ? '+' : ''}{formatDelta(alert.delta)} pts to {displayScore(alert.score)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      You're all caught up. Alerts appear when a sub-index moves past your threshold.
                    </p>
                  )}
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                className="text-muted-foreground hover:text-foreground h-8 w-8"
              >
                <Settings size={16} />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8">
                    <User size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/login')}>
                    <LogIn size={16} className="mr-2" />
                    Sign In
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-muted-foreground text-sm" onClick={() => navigate('/login')}>
                    <UserPlus size={16} className="mr-2" />
                    Create Account
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};

export default Navbar;
