import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CHECKOUT_ENABLED, startCheckout } from '@/lib/checkout';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    cadence: '',
    features: ['Overall FWI score', '30-day trend', 'Top 5 movers', 'Weekly email digest', 'Public no-auth API'],
    cta: 'Current plan',
    plan: null as 'monthly' | 'annual' | null,
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$99',
    cadence: '/mo ($79/mo billed annually)',
    features: ['Full sub-index breakdown', '12-month history', 'All 21 signals', 'AI insight cards', 'Custom weight tuning', 'Brief export (MD + PDF)', 'the Form D Lead detail'],
    cta: 'Upgrade to Pro',
    plan: 'monthly' as const,
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$500+',
    cadence: '/mo',
    features: ['Everything in Pro', 'REST + MCP at scale', 'Vertical sub-indices', 'Raw data exports', 'SSO + SLA', 'White-label partnership available'],
    cta: 'Talk to us',
    plan: null,
    highlight: false,
  },
];

const Pricing = () => {
  const [busy, setBusy] = useState(false);

  const onCta = async (tier: (typeof TIERS)[number]) => {
    if (tier.name === 'Enterprise') { window.location.href = 'mailto:data@fractionl.ai?subject=Pulse%20Enterprise'; return; }
    if (!tier.plan) return;
    if (!CHECKOUT_ENABLED) { window.location.href = '/login'; return; } // waitlist until checkout is on
    setBusy(true);
    await startCheckout(tier.plan);
    setBusy(false);
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
            The FWI is free to glance at. Pro is for operators who act on it every week.
            {!CHECKOUT_ENABLED && ' Founding-customer pricing is open by waitlist while we finish self-serve checkout.'}
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
                  Most popular
                </span>
              )}
              <h2 className="text-base font-semibold text-foreground">{tier.name}</h2>
              <div className="mt-1.5 mb-4">
                <span className="text-2xl font-bold text-foreground">{tier.price}</span>
                <span className="text-xs text-muted-foreground">{tier.cadence}</span>
              </div>
              <ul className="space-y-2 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-foreground/80">
                    <Check size={14} className="text-primary shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => onCta(tier)}
                disabled={busy || tier.name === 'Free'}
                variant={tier.highlight ? 'default' : 'outline'}
                className="w-full mt-5"
              >
                {tier.name === 'Free' ? 'Current plan' : !CHECKOUT_ENABLED && tier.plan ? 'Join the waitlist' : tier.cta}
              </Button>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/70 mt-8">
          The FWI is a weekly index for the fractional executive market, published by Fractionl. Not financial advice.
        </p>
      </div>
    </div>
  );
};

export default Pricing;
