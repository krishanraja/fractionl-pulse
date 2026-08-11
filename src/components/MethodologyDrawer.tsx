import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-mobile';
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase';

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
      <div className="bg-muted/30 p-4 rounded-lg">
        <h4 className="font-medium mb-2 text-foreground">How this works</h4>
        <p className="text-sm text-muted-foreground">
          The Fractional Working Index is a single weekly score (0-100) that answers one question: is this a good time to hire a fractional executive? It combines 21 data sources across three dimensions: hiring activity, talent availability, and market momentum.
        </p>
      </div>

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
            <p className="text-xs text-muted-foreground pl-5">Adzuna + SerpAPI Google Jobs postings for fractional CFO, CMO, CTO, COO, CRO, and interim CEO roles. SEC Form D filings add startup-financing context. Pulse has not validated a predictive relationship between those filings and future fractional hiring.</p>
          </div>

          <div className="p-3 bg-muted/20 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                <span className="font-medium text-foreground">Talent availability</span>
              </div>
              <span className="text-sm text-muted-foreground">{(weights.supply * 100).toFixed(0)}% of score</span>
            </div>
            <p className="text-xs text-muted-foreground pl-5">SerpAPI and Brave LinkedIn profile proxies (a redundant pair so the reading survives a single-vendor outage), GoFractional marketplace listings, and supply-intent search trends (searches like "become fractional executive").</p>
          </div>

          <div className="p-3 bg-muted/20 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                <span className="font-medium text-foreground">Market momentum</span>
              </div>
              <span className="text-sm text-muted-foreground">{(weights.culture * 100).toFixed(0)}% of score</span>
            </div>
            <p className="text-xs text-muted-foreground pl-5">Search-interest trends, NewsAPI + Mediastack + Brave News coverage, Guardian prestige media mentions, Podchaser podcast episodes, Reddit + Hacker News community discourse, and Wikipedia article interest.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h4 className="font-medium mb-2 text-foreground text-sm uppercase tracking-wide">21 data sources</h4>
        <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
          <span>Adzuna Jobs</span><span>SerpAPI Google Jobs</span>
          <span>SEC EDGAR Form D</span><span>SerpAPI Trends</span>
          <span>NewsAPI</span><span>Mediastack</span>
          <span>Brave News</span><span>Brave Web Search</span>
          <span>The Guardian</span><span>Podchaser</span>
          <span>Reddit</span><span>Hacker News</span>
          <span>SerpAPI LinkedIn</span><span>Brave Talent Proxy</span>
          <span>GoFractional</span><span>SerpAPI Supply Trends</span>
          <span>BLS (JOLTS)</span><span>Wikipedia Pageviews</span>
          <span>OpenAlex Research</span><span>FRED Macro Data</span>
          <span>Census ACS</span>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h4 className="font-medium mb-2 text-foreground text-sm uppercase tracking-wide">Normalization</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Each source returns different units. We normalize to 0-100 using calibrated scales:
        </p>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Job postings:</span> Log scale (200 listings = 100)</p>
          <p><span className="font-medium text-foreground">SEC filings:</span> Linear (800 tech filings/90d = 50)</p>
          <p><span className="font-medium text-foreground">News:</span> Square-root scale (dampens viral spikes)</p>
          <p><span className="font-medium text-foreground">Trends:</span> Native 0-100 pass-through</p>
          <p><span className="font-medium text-foreground">Supply:</span> Log scale (10,000 profiles = 100)</p>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h4 className="font-medium mb-2 text-foreground text-sm uppercase tracking-wide">Data integrity</h4>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Anomaly guard:</span> Rejects any signal more than 3 standard deviations from its 8-week rolling average to prevent API glitches from corrupting the index.</p>
          <p><span className="font-medium text-foreground">Confidence score:</span> Weighted by source reliability. A week where all 21 sources report = 1.0 confidence.</p>
          <p><span className="font-medium text-foreground">Week-over-week deltas:</span> Movers are calculated against the prior week's actual scores, not static baselines.</p>
        </div>
      </div>

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
        <h4 className="font-medium mb-1 text-foreground">Scheduled daily</h4>
        <p className="text-sm text-muted-foreground">
          The pipeline is scheduled every morning at 6am UTC, with a weekly Monday baseline. Source outages can reduce coverage or delay a reading; the Sources view shows the current state. Historical coverage can include backfilled estimates, while the current headline does not invent a missing pillar reading.
        </p>
      </div>

      <Button
        className="w-full"
        onClick={() => window.open(`${SUPABASE_FUNCTIONS_URL}/fwi-api/current`, '_blank')}
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
          <DrawerClose className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close methodology">
            <X aria-hidden="true" size={18} />
          </DrawerClose>
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
