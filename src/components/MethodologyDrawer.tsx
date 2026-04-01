import { Download } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-mobile';

interface MethodologyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weights: {
    demand: number;
    supply: number;
    culture: number;
  };
}

const MethodologyContent = ({ weights }: { weights: MethodologyDrawerProps['weights'] }) => {
  return (
    <div className="space-y-6 py-4">
      {/* Overview */}
      <div className="bg-muted/30 p-4 rounded-lg">
        <h4 className="font-medium mb-2 text-foreground">How this works</h4>
        <p className="text-sm text-muted-foreground">
          The Fractional Working Index is a single weekly score (0-100) that answers one question: is this a good time to hire a fractional executive? It combines three signals: how much companies are hiring, how many executives are available, and how much the market is talking about fractional work.
        </p>
      </div>

      {/* Components - High level only */}
      <div className="space-y-4">
        <h4 className="font-medium text-foreground text-sm uppercase tracking-wide">What we measure</h4>

        <div className="space-y-3">
          <div className="p-3 bg-muted/20 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="font-medium text-foreground">Hiring activity</span>
              </div>
              <span className="text-sm text-muted-foreground">{(weights.demand * 100).toFixed(0)}% of score</span>
            </div>
            <p className="text-xs text-muted-foreground pl-5">Live job postings for fractional CFO, CMO, CTO, COO, CRO, and interim CEO roles. Plus venture capital funding filings: companies that just raised tend to hire fractional executives 1-3 months later.</p>
          </div>

          <div className="p-3 bg-muted/20 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                <span className="font-medium text-foreground">Talent availability</span>
              </div>
              <span className="text-sm text-muted-foreground">{(weights.supply * 100).toFixed(0)}% of score</span>
            </div>
            <p className="text-xs text-muted-foreground pl-5">How many fractional executives are currently available to hire. We are integrating live marketplace data (Contra, Toptal) in Q2 2026; using a neutral baseline until then.</p>
          </div>

          <div className="p-3 bg-muted/20 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                <span className="font-medium text-foreground">Market buzz</span>
              </div>
              <span className="text-sm text-muted-foreground">{(weights.culture * 100).toFixed(0)}% of score</span>
            </div>
            <p className="text-xs text-muted-foreground pl-5">Google search interest for fractional executive terms plus news article volume. High buzz typically precedes a hiring surge by a few weeks.</p>
          </div>
        </div>
      </div>

      {/* Normalization */}
      <div className="border-t border-border pt-4">
        <h4 className="font-medium mb-2 text-foreground text-sm uppercase tracking-wide">How we normalize raw data</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Each data source returns different units (job counts, filing counts, search interest 0-100, article counts). We convert each to a 0-100 score using these calibrations:
        </p>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Job postings:</span> Log scale where 200 live listings = 100. Chosen because the highest-volume role (Fractional CFO) peaks around 150-200 listings.</p>
          <p><span className="font-medium text-foreground">SEC Form D filings:</span> Linear scale where 800 tech filings per 90 days = 50. This is the approximate historical median.</p>
          <p><span className="font-medium text-foreground">News articles:</span> Square-root scale (dampens viral spikes) where ~44 articles per 28 days = 100.</p>
          <p><span className="font-medium text-foreground">Google Trends:</span> Passed through directly — Google already returns a 0-100 relative interest score.</p>
        </div>
      </div>

      {/* Data Quality */}
      <div className="border-t border-border pt-4">
        <h4 className="font-medium mb-2 text-foreground">How to read the score</h4>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p><span className="text-emerald-400 font-medium">75-100 Surging</span> - exceptional demand, great time to hire</p>
          <p><span className="text-green-400 font-medium">60-74 Growing</span> - strong market, opportunities abundant</p>
          <p><span className="text-yellow-400 font-medium">45-59 Stable</span> - balanced, normal conditions</p>
          <p><span className="text-orange-400 font-medium">30-44 Cooling</span> - demand softening, more selectivity</p>
          <p><span className="text-red-400 font-medium">0-29 Contracting</span> - market under pressure</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-4 rounded-lg border border-primary/20">
        <h4 className="font-medium mb-1 text-foreground">Updated weekly</h4>
        <p className="text-sm text-muted-foreground">
          The index runs every Monday morning. Each week's reading is stored permanently, so the trend chart fills in over time with real historical data.
        </p>
      </div>

      {/* CTA */}
      <Button 
        className="w-full"
        onClick={() => window.open('https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current', '_blank')}
      >
        <Download size={16} className="mr-2" />
        View raw data (JSON)
      </Button>
    </div>
  );
};

const MethodologyDrawer = ({ open, onOpenChange, weights }: MethodologyDrawerProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>How we calculate this</DrawerTitle>
            <DrawerDescription>What goes into the Fractional Working Index</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto">
            <MethodologyContent weights={weights} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>How we calculate this</SheetTitle>
          <SheetDescription>What goes into the Fractional Working Index</SheetDescription>
        </SheetHeader>
        <MethodologyContent weights={weights} />
      </SheetContent>
    </Sheet>
  );
};

export default MethodologyDrawer;
