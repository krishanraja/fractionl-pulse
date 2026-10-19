import { Link } from 'react-router-dom';

const COMPANY_NOTE = 'Pulse is a Mindmaker LLC company. Mindmaker Ltd in the UK.';

interface SiteFooterProps {
  /** `instrument` uses the cream-paper instrument styles; `page` uses the shared muted text tokens. */
  variant?: 'instrument' | 'page';
}

const SiteFooter = ({ variant = 'page' }: SiteFooterProps) => {
  if (variant === 'instrument') {
    return (
      <footer className="pulse-site-footer">
        <p>{COMPANY_NOTE}</p>
        <nav aria-label="Legal">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </footer>
    );
  }

  return (
    <footer className="mx-auto mt-10 flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-6 text-center text-[11px] leading-5 text-muted-foreground/80">
      <p className="text-balance">{COMPANY_NOTE}</p>
      <nav aria-label="Legal" className="flex gap-3">
        <Link to="/terms" className="underline-offset-2 hover:text-foreground hover:underline">Terms</Link>
        <Link to="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">Privacy</Link>
      </nav>
    </footer>
  );
};

export default SiteFooter;
