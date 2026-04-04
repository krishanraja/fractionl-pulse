import { LayoutDashboard, Zap, BarChart3, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSettingsClick: () => void;
}

const BottomNav = ({ activeTab, onTabChange, onSettingsClick }: BottomNavProps) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'signals', label: 'Signals', icon: Zap },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative min-w-[64px] py-2",
                "text-muted-foreground/70 transition-colors",
                isActive && "text-primary"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn(
                "text-[11px] leading-tight",
                isActive ? "font-semibold" : "font-medium"
              )}>{tab.label}</span>
            </button>
          );
        })}

        <button
          onClick={onSettingsClick}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-[64px] py-2 text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <Settings size={20} />
          <span className="text-[11px] font-medium leading-tight">Settings</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
