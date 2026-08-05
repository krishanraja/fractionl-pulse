import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { fadeInUp } from '@/lib/motion';
import { circleUrl } from '@/lib/siblings';

interface CircleCrossSellProps {
  /** The viewer's own fractional lane, if they have told us. Makes the line specific. */
  role?: string | null;
  /** Attribution slot, so the warehouse can tell placements apart. */
  content?: string;
}

/**
 * The Pulse to Circle handoff. Pulse is the documented lead funnel for Fractionl
 * Circle (docs/FLEET_WIRING.md) and Circle already reads Pulse's fwi-api, but
 * until now there was no link in either direction, so the funnel did not exist.
 *
 * Deliberately quiet: this is a data instrument, not a billboard. Same card
 * chrome, type scale and rhythm as the rest of the right-hand column, one text
 * link, no button, no gradient, no badge. It sits directly under the lane picker
 * because that is the one moment the reader has just told us what they sell.
 */
const CircleCrossSell = ({ role, content = 'dashboard_aside' }: CircleCrossSellProps) => {
  // Lowercase only the leading word so the acronym survives: "Fractional CMO"
  // reads as "fractional CMO" mid-sentence, never "fractional cmo".
  const lane = role ? role.replace(/^\w+/, (w) => w.toLowerCase()) : 'fractional';

  return (
    // Drives its own variant states. `variants` alone relies on inheriting an
    // animate label from a motion ancestor, and the page-level stagger container
    // in Index.tsx does not reach this far down the tree, which is what left the
    // readiness gauge stuck at opacity 0 in production.
    <motion.aside variants={fadeInUp} initial="hidden" animate="show" className="glass-card p-4 sm:p-5">
      <p className="text-xs font-semibold text-foreground">From the read to a plan</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
        The index tells you what the {lane} market is doing. Fractionl Circle pressure-tests
        your own offer against it, in the open, then turns the read into named warm-network
        moves toward your next retained client.
      </p>
      <a
        href={circleUrl(content)}
        target="_blank"
        rel="noopener"
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:brightness-110 transition"
      >
        Open Fractionl Circle
        <ArrowUpRight size={12} className="shrink-0" aria-hidden="true" />
      </a>
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed mt-2 pt-2 border-t border-hairline">
        A separate Fractionl product. Free to start, Pro at $39 a month. Pulse itself stays free.
      </p>
    </motion.aside>
  );
};

export default CircleCrossSell;
