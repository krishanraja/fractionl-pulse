import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useMediaQuery } from '@/hooks/use-mobile';
import { RotateCcw } from 'lucide-react';
import type { UserPreferences } from '@/hooks/useUserPreferences';

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SettingsContent = () => {
  const { preferences, updatePreferences, resetPreferences } = useUserPreferences();

  return (
    <div className="space-y-8 py-4">
      {/* Display Preferences */}
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">Display Preferences</h4>
        
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Compact Mode</Label>
            <p className="text-xs text-muted-foreground">Show less detail on cards</p>
          </div>
          <Switch
            checked={preferences.compactMode}
            onCheckedChange={(checked) => updatePreferences({ compactMode: checked })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Default Time Range</Label>
          <Select
            value={preferences.defaultTimeRange}
            onValueChange={(value: UserPreferences['defaultTimeRange']) => updatePreferences({ defaultTimeRange: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-4 border-t border-border pt-6">
        <h4 className="font-medium text-foreground">Alerts</h4>
        
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Enable Alerts</Label>
            <p className="text-xs text-muted-foreground">Get notified of significant changes</p>
          </div>
          <Switch
            checked={preferences.alerts.enabled}
            onCheckedChange={(checked) => updatePreferences({ 
              alerts: { ...preferences.alerts, enabled: checked }
            })}
          />
        </div>

        {preferences.alerts.enabled && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Alert Threshold</Label>
              <span className="text-sm font-medium">{preferences.alerts.threshold}%</span>
            </div>
            <Slider
              value={[preferences.alerts.threshold]}
              onValueChange={(v) => updatePreferences({ 
                alerts: { ...preferences.alerts, threshold: v[0] }
              })}
              max={20}
              min={1}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Alert when any index changes by more than {preferences.alerts.threshold}%
            </p>
          </div>
        )}
      </div>

      {/* Reset */}
      <div className="border-t border-border pt-6">
        <Button variant="outline" onClick={resetPreferences} className="w-full">
          <RotateCcw size={16} className="mr-2" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};

const SettingsSheet = ({ open, onOpenChange }: SettingsSheetProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Settings</DrawerTitle>
            <DrawerDescription>Customize your FWI experience</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto">
            <SettingsContent />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Customize your FWI experience</SheetDescription>
        </SheetHeader>
        <SettingsContent />
      </SheetContent>
    </Sheet>
  );
};

export default SettingsSheet;
