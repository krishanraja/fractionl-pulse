import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, User, LogIn, UserPlus } from 'lucide-react';
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
          <div className="flex items-center justify-between h-16">
            {/* Logo - no margin compensation needed, image has no internal padding */}
            <div className="flex items-center">
              <img 
                src={fractionlLogo} 
                alt="Fractionl" 
                className="h-6 md:h-8 object-contain"
                loading="eager"
                decoding="sync"
                fetchPriority="high"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Settings size={20} />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <User size={20} />
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
