import { ChevronDown, ExternalLink, X } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-mobile';
import { useVisualViewport } from '@/hooks/useVisualViewport';
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

const SCORE_BANDS = [
  ['75-100', 'Surging', 'Very strong activity'],
  ['60-74', 'Growing', 'Strong activity'],
  ['45-59', 'Stable', 'Typical activity'],
  ['30-44', 'Cooling', 'Activity is slowing'],
  ['0-29', 'Contracting', 'Weak activity'],
];

const MethodologyContent = ({ weights }: { weights: MethodologyDrawerProps['weights'] }) => (
  <div className="pulse-method-content">
    <section className="pulse-method-lead" aria-labelledby="method-overview-heading">
      <span>In plain English</span>
      <h3 id="method-overview-heading">One score for current market conditions</h3>
      <p>Pulse combines job postings, business-formation and self-employment statistics, and market attention into a score from 0 to 100 for fractional executives in the US market. It is a measured snapshot, not a forecast, and it has not been validated against an official measure. From 26 October 2026 each reading is a whole number with a band. <a href="/methodology">Full methodology</a> &middot; <a href="/changelog">Changelog</a></p>
    </section>

    <section className="pulse-method-section" aria-labelledby="method-measures-heading">
      <div className="pulse-method-section-heading">
        <span>01</span>
        <h3 id="method-measures-heading">What goes into the score</h3>
      </div>
      <div className="pulse-method-measures">
        <article>
          <div><span>Hiring demand</span><strong>{(weights.demand * 100).toFixed(0)}%</strong></div>
          <p>Open roles and hiring signals for fractional CFO, CMO, CTO, COO, CRO, and interim CEO work.</p>
        </article>
        <article>
          <div><span>Executive availability</span><strong>{(weights.supply * 100).toFixed(0)}%</strong></div>
          <p>Signals of people setting up on their own: professional-services business applications, incorporated self-employment, and LinkedIn profiles naming fractional roles.</p>
        </article>
        <article>
          <div><span>Market interest</span><strong>{(weights.culture * 100).toFixed(0)}%</strong></div>
          <p>News, Hacker News and Wikipedia attention around fractional leadership.</p>
        </article>
      </div>
    </section>

    <section className="pulse-method-section" aria-labelledby="method-bands-heading">
      <div className="pulse-method-section-heading">
        <span>02</span>
        <h3 id="method-bands-heading">How to read the score</h3>
      </div>
      <div className="pulse-method-bands">
        {SCORE_BANDS.map(([range, label, meaning]) => (
          <div key={label}>
            <span>{range}</span>
            <strong>{label}</strong>
            <p>{meaning}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="pulse-method-section" aria-labelledby="technical-details-heading">
      <div className="pulse-method-section-heading">
        <span>03</span>
        <h3 id="technical-details-heading">Technical details</h3>
      </div>
      <div className="pulse-method-details">
        <details>
          <summary>Sources and weightings <ChevronDown aria-hidden="true" /></summary>
          <div>
            <p><strong>Hiring demand:</strong> Adzuna and Google Jobs postings for six roles. SEC Form D filings provide startup-financing context, but Pulse has not validated them as a predictor of future fractional hiring.</p>
            <p><strong>Executive availability (from 26 October 2026):</strong> Census business applications in professional services, BLS incorporated self-employed, and a LinkedIn profile count (its 14-day median).</p>
            <p><strong>Market interest (from 26 October 2026):</strong> NewsAPI, Hacker News and Wikipedia.</p>
            <p>Nine earlier inputs were retired on 26 October 2026 because their values never moved; readings before that date are kept as published. Official labour statistics (BLS, FRED, Census) and SEC interim-executive filings are held out of the score so they can test it.</p>
          </div>
        </details>
        <details>
          <summary>How different data is put on the same scale <ChevronDown aria-hidden="true" /></summary>
          <div>
            <p>Each source uses different units. Pulse converts them to a common 0-100 scale before combining them.</p>
            <ul>
              <li>Job postings use a log scale, where 200 listings equals 100.</li>
              <li>SEC filings use a linear scale, where 800 technology filings over 90 days equals 50.</li>
              <li>News uses a square-root scale to reduce the effect of viral spikes.</li>
              <li>Search trends retain their native 0-100 scale.</li>
              <li>Availability sources use their own calibrated log or native scales.</li>
            </ul>
          </div>
        </details>
        <details>
          <summary>Data quality checks and limitations <ChevronDown aria-hidden="true" /></summary>
          <div>
            <p>Pulse rejects a signal more than three standard deviations from that source's recent readings, so an API error cannot distort the index. Each source gets one vote in its pillar; a source missing for a day holds its last vote for up to seven days.</p>
            <p>The band beside the score shows how much the reading depends on which sources voted. Data coverage shows the weighted share of inputs that arrived. Neither shows prediction accuracy.</p>
            <p>Role comparisons use current hiring demand. Other movement compares the latest reading with the previous observed reading.</p>
          </div>
        </details>
        <details>
          <summary>Update schedule and missing data <ChevronDown aria-hidden="true" /></summary>
          <div>
            <p>The pipeline runs every morning at 6am UTC, with a backstop run at 8am if the first fails. A source outage can lower data coverage or delay a reading.</p>
            <p>Historical coverage may include clearly identified backfilled estimates. The current headline score does not invent a missing component.</p>
          </div>
        </details>
      </div>
    </section>
  </div>
);

const MethodologyFooter = () => (
  <footer className="pulse-method-footer">
    <a href="/methodology">
      Read the full methodology
    </a>
    <a href={`${SUPABASE_FUNCTIONS_URL}/fwi-api/current`} target="_blank" rel="noreferrer">
      View the current raw data
      <ExternalLink aria-hidden="true" />
    </a>
  </footer>
);

const MethodologyDrawer = ({ open, onOpenChange, weights }: MethodologyDrawerProps) => {
  const isCompact = useMediaQuery('(max-width: 1023.98px)');
  const visualViewport = useVisualViewport(open);
  const compactViewportStyle = isCompact && visualViewport.height
    ? { height: visualViewport.height, maxHeight: visualViewport.height, top: visualViewport.offsetTop }
    : undefined;

  if (isCompact) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent
          className="pulse-overlay-theme pulse-method-surface pulse-method-drawer"
          overlayClassName="pulse-overlay-backdrop"
          hideHandle
          style={compactViewportStyle}
        >
          <DrawerHeader className="pulse-overlay-header">
            <div>
              <DrawerTitle>Sources and methods</DrawerTitle>
              <DrawerDescription>A plain-English guide to the data behind today's index.</DrawerDescription>
            </div>
            <DrawerClose className="pulse-overlay-close" aria-label="Close sources and methods">
              <X aria-hidden="true" />
            </DrawerClose>
          </DrawerHeader>
          <div className="pulse-method-scroll">
            <MethodologyContent weights={weights} />
          </div>
          <MethodologyFooter />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="pulse-overlay-theme pulse-method-surface pulse-method-sheet"
        overlayClassName="pulse-overlay-backdrop"
        hideDefaultClose
      >
        <SheetHeader className="pulse-overlay-header">
          <div>
            <SheetTitle>Sources and methods</SheetTitle>
            <SheetDescription>A plain-English guide to the data behind today's index.</SheetDescription>
          </div>
          <SheetClose className="pulse-overlay-close" aria-label="Close sources and methods">
            <X aria-hidden="true" />
          </SheetClose>
        </SheetHeader>
        <div className="pulse-method-scroll">
          <MethodologyContent weights={weights} />
        </div>
        <MethodologyFooter />
      </SheetContent>
    </Sheet>
  );
};

export default MethodologyDrawer;
