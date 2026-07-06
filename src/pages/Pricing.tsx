import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import ApiKeyManager from '@/components/ApiKeyManager';

// Pulse monetizes the metered agent/enterprise API, not a human paywall. The
// dashboard is free in full; the API is the paid wedge (the same read was always
// free and unauthenticated via the API, so a human paywall protected nothing).
type Action = 'signup' | 'api' | 'contact';

const TIERS: Array<{
  name: string; price: string; cadence: string; blurb: string;
  features: string[]; cta: string; action: Action; highlight: boolean;
}> = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'the full dashboard',
    blurb: 'Everything a fractional operator needs to read the market weekly.',
    features: ['Overall FWI + all three sub-indices', '12-month history and trend', 'All 21 source signals', 'AI insight cards + Content Radar', 'Personalized, role-aware readiness', 'Weekly market brief'],
    cta: 'Start free',
    action: 'signup',
    highlight: true,
  },
  {
    name: 'Agents & API',
    price: 'Metered',
    cadence: 'free public, keyed tiers',
    blurb: 'Build the index into your agent, product, or workflow.',
    features: ['Public REST + hosted MCP (no auth)', 'x-api-key tiers: free 1,000 req/day', 'Current + history + weekly brief endpoints', 'X-FWI-Score / X-FWI-Label headers', 'Higher limits on request'],
    cta: 'Get an API key',
    action: 'api',
    highlight: false,
  },
  {
    name: 'Enterprise & Data',
    price: 'Talk to us',
    cadence: '',
    blurb: 'High-volume API, raw data, and licensing.',
    features: ['Unlimited / custom API limits', 'Raw signal + score exports', 'Data licensing and citations', 'White-label and vertical indices', 'SSO + SLA'],
    cta: 'Talk to us',
    action: 'contact',
    highlight: false,
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [apiOpen, setApiOpen] = useState(false);

  const onCta = (action: Action) => {
    if (action === 'signup') { navigate('/login'); return; }
    if (action === 'contact') { window.location.href = 'mailto:data@fractionl.ai?subject=Pulse%20Enterprise%20and%20Data'; return; }
    if (action === 'api') { user ? setApiOpen(true) : navigate('/login'); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container-width py-8 px-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft size={15} /> Back to the index
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Read the market like an instrument</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            The dashboard is free for every fractional operator. We monetize the API that agents and platforms build on.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {TIERS.map((tier) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={`glass-card p-5 flex flex-col ${tier.highlight ? 'ring-2 ring-primary/50 relative' : ''}`}
            >
              {tier.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full px-2.5 py-0.5">
                  For operators
                </span>
              )}
              <h2 className="text-base font-semibold text-foreground">{tier.name}</h2>
              <div className="mt-1.5 mb-1">
                <span className="text-2xl font-bold text-foreground">{tier.price}</span>
                {tier.cadence && <span className="text-xs text-muted-foreground ml-1.5">{tier.cadence}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground mb-4">{tier.blurb}</p>
              <ul className="space-y-2 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-foreground/80">
                    <Check size={14} className="text-primary shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => onCta(tier.action)}
                variant={tier.highlight ? 'default' : 'outline'}
                className="w-full mt-5"
              >
                {tier.cta}
              </Button>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/70 mt-8">
          The FWI is a weekly index for the fractional executive market, published by Fractionl. Not financial advice.
        </p>
      </div>

      <ApiKeyManager open={apiOpen} onOpenChange={setApiOpen} />
    </div>
  );
};

export default Pricing;
