import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LEGAL_LAST_UPDATED } from '@/lib/legal';
import SiteFooter from './SiteFooter';

interface LegalPageProps {
  title: string;
  documentTitle: string;
  children: ReactNode;
}

const LegalPage = ({ title, documentTitle, children }: LegalPageProps) => {
  useEffect(() => {
    document.title = documentTitle;
    return () => { document.title = 'Fractional Working Index | Pulse by Fractionl'; };
  }, [documentTitle]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container-width px-4 py-8 sm:py-12">
        <Link
          to="/"
          className="mb-8 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:min-h-0"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back to the index
        </Link>

        <article className="mx-auto max-w-2xl text-sm leading-6 text-foreground/85 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:underline [&_a]:underline-offset-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="text-xs text-muted-foreground">Last updated: {LEGAL_LAST_UPDATED}</p>
          {children}
        </article>
      </div>
      <SiteFooter />
    </div>
  );
};

export default LegalPage;
