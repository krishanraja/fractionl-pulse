import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, User, LogIn, UserPlus, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import SettingsSheet from '@/components/SettingsSheet';
import fractionlLogo from '@/assets/fractionl-logo.png';

const Navbar = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();

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
