import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Database, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import ApiKeyManager from '@/components/ApiKeyManager';

type Action = 'public' | 'partner' | 'enterprise';

const TIERS: Array<{
  name: string;
  price: string;
  cadence: string;
  status: string;
  blurb: string;
  features: string[];
  cta: string;
  action: Action;
  highlight: boolean;
}> = [
  {
    name: 'Public instrument',
    price: '£0',
    cadence: 'forever',
    status: 'Live',
    blurb: 'The complete public read for fractional executives, hiring teams, researchers, and agents.',
    features: [
      'Current FWI and all three components',
      'History and six role-demand pages',
      'Weekly brief and evidence detail',
      'Public REST API and hosted MCP tools',
      'No consumer Pro gate',
    ],
    cta: 'Read the market',
    action: 'public',
    highlight: true,
  },
  {
    name: 'Founding Benchmark Partner',
    price: '£1,500',
    cadence: '90-day pilot',
    status: 'Application only · 10 firms',
    blurb: 'For specialist fractional-talent firms with repeated placements and structured engagement data.',
    features: [
      'Privacy, schema, and data-quality review',
      'Private cohort prototype where coverage permits',
      'One benchmark review with your operating team',
      'Pilot fee credited to the first annual plan',
      'No raw partner records or unsafe cohorts',
    ],
    cta: 'Apply as a partner',
    action: 'partner',
    highlight: false,
  },
  {
    name: 'Enterprise and portfolio',
    price: 'From £15k',
    cadence: 'per year',
    status: 'Conditional release',
    blurb: 'Custom cohorts for multi-company talent portfolios after the benchmark reaches sufficient coverage.',
    features: [
      'Custom role, geography, or portfolio cohorts',
      'Up to 25 seats and contracted service level',
      'Proprietary benchmark exports and embed rights',
      'Requires at least 1,500 verified engagements',
      'Every cohort must pass privacy thresholds',
    ],
    cta: 'Discuss future fit',
    action: 'enterprise',
    highlight: false,
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [apiOpen, setApiOpen] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Pulse pricing | Public index and benchmark partnerships';
    return () => { document.title = previousTitle; };
  }, []);

  const onCta = (action: Action) => {
    if (action === 'public') {
      navigate('/');
      return;
    }

    const subject = action === 'partner'
      ? 'Pulse Benchmark Partner'
      : 'Pulse enterprise benchmark fit';
    window.location.href = `mailto:data@fractionl.ai?subject=${encodeURIComponent(subject)}`;
  };

  const openApiKeyManager = () => {
    if (user) {
      setApiOpen(true);
      return;
    }
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container-width px-4 py-8 sm:py-12">
        <Link
          to="/"
          className="mb-8 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:min-h-0"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back to the index
        </Link>

        <header className="mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Public instrument. Partner benchmark.
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Read the market for free. Benchmark your book when the data is ready.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Fractional executives are the audience, not the paywall. Qualified fractional-talent firms can apply to build a privacy-safe market benchmark from real engagement data.
          </p>
        </header>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-3">
          {TIERS.map((tier, index) => (
            <motion.article
              key={tier.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
              className={`glass-card relative flex flex-col p-5 ${tier.highlight ? 'ring-2 ring-primary/50' : ''}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {tier.status}
                </span>
                {tier.highlight && (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                    Start here
                  </span>
                )}
              </div>

              <h2 className="text-base font-semibold text-foreground">{tier.name}</h2>
              <div className="mb-2 mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-foreground">{tier.price}</span>
                <span className="text-xs text-muted-foreground">{tier.cadence}</span>
              </div>
              <p className="mb-5 min-h-12 text-xs leading-5 text-muted-foreground">{tier.blurb}</p>

              <ul className="flex-1 space-y-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs leading-5 text-foreground/80">
                    <Check size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => onCta(tier.action)}
                variant={tier.highlight ? 'default' : 'outline'}
                className="mt-6 min-h-11 w-full"
              >
                {tier.cta}
              </Button>
            </motion.article>
          ))}
        </div>

        <section className="mx-auto mt-6 grid max-w-5xl gap-4 rounded-2xl border border-border/70 bg-card/40 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">
              <Database size={18} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Developer access stays public</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                The REST API and MCP tools remain free. An optional API key provides operational rate controls. It does not unlock a paid version of the same public score.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={openApiKeyManager} className="min-h-11 w-full sm:w-auto">
            <LockKeyhole size={15} aria-hidden="true" />
            {user ? 'Manage API key' : 'Sign in for an API key'}
          </Button>
        </section>

        <div className="mx-auto mt-8 max-w-2xl text-center text-[11px] leading-5 text-muted-foreground/80">
          <p>Paid prices are validation hypotheses, not proven willingness to pay.</p>
          <p>Annual plans do not launch until record-count, partner-independence, and privacy thresholds are met.</p>
        </div>
      </div>

      <ApiKeyManager open={apiOpen} onOpenChange={setApiOpen} />
    </div>
  );
};

export default Pricing;
