// Build-time prerender for the public route.
//
// The app is a client-rendered Vite SPA: the shipped dist/index.html is an empty
// shell, so crawlers and answer engines see no content and there is nothing to
// cite (audit finding A2). This post-build step fetches the live FWI from the
// now-public API and injects, into the static HTML:
//   1. schema.org Dataset + Organization JSON-LD (so Google Dataset Search and
//      answer engines can cite the FWI by name, with the Form D Lead method).
//   2. Live-number <title> / OG / Twitter meta (so fleet-posted links and search
//      snippets show this week's actual score and band).
//   3. A <noscript> content block with the real headline, score, and methodology
//      for non-JS crawlers.
//
// React (createRoot) only owns #root, so the <head> JSON-LD and the <noscript>
// block are never touched at runtime and there is no duplicate visible content.
// Runs on every deploy; the baked number is also refreshed daily by the Supabase
// pg_cron job `pulse-daily-redeploy` (supabase/migrations/009_redeploy_cron.sql),
// which pings the Vercel deploy hook at 06:40 UTC after the daily ingest. Fully
// graceful: if the API is unreachable at build time we fall back to static
// (number-free) JSON-LD so the build never fails.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildRolePages, buildSitemap } from './prerender-roles.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, '..', 'dist', 'index.html');
const API = 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current';
const SITE = 'https://pulse.fractionl.ai';

function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function fetchCurrent() {
  try {
    const res = await fetch(API, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const data = await fetchCurrent();
const score = data?.score?.overall;
const label = data?.score?.label;
const delta = data?.score?.delta30d;
const asOf = data?.meta?.asOf;
const methodology = data?.meta?.methodology || 'FWI = (Demand x 0.5) + (Supply x 0.2) + (Culture x 0.3)';
const haveLive = typeof score === 'number' && typeof label === 'string';

const deltaPhrase = typeof delta === 'number'
  ? `${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)} points over 30 days`
  : '';

const title = haveLive
  ? `Fractional Working Index: ${score.toFixed(1)} (${label}) | Pulse by Fractionl`
  : 'Pulse by Fractionl | The Fractional Working Index';

const description = haveLive
  ? `The fractional executive market is at ${score.toFixed(1)} of 100 (${label})${deltaPhrase ? `, ${deltaPhrase}` : ''}. A private composite using 21 tracked inputs across demand, supply, culture, and context. SEC Form D filings provide financing context, not a validated forecast.`
  : 'A private 0-100 composite index of the fractional executive market, using 21 tracked inputs across demand, supply, culture, and context.';

// ---- schema.org JSON-LD ----
const datasetLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Fractional Working Index (FWI)',
  alternateName: 'FWI',
  description,
  url: SITE,
  sameAs: SITE,
  isAccessibleForFree: true,
  creator: { '@type': 'Organization', name: 'Fractionl', url: 'https://fractionl.ai' },
  publisher: { '@type': 'Organization', name: 'Fractionl', url: 'https://fractionl.ai' },
  license: 'https://pulse.fractionl.ai',
  measurementTechnique: 'Private composite using 21 tracked inputs with mixed availability across demand (50%), supply (20%), culture (30%), and excluded context. Inputs are not all statistically independent. SEC Form D filing velocity is financing context; its relationship to future fractional demand has not been validated.',
  variableMeasured: ['Overall FWI', 'Demand', 'Supply', 'Culture'],
  ...(asOf ? { dateModified: asOf } : {}),
  distribution: [
    { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: API, name: 'Current FWI (JSON, no auth)' },
    { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: API.replace('/current', '/history?months=12'), name: 'FWI history (JSON, no auth)' },
    { '@type': 'DataDownload', encodingFormat: 'text/markdown', contentUrl: 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief', name: 'Weekly brief (Markdown)' },
  ],
};

const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Fractionl',
  url: 'https://fractionl.ai',
  brand: { '@type': 'Brand', name: 'Pulse by Fractionl' },
  description: 'Fractionl publishes the Fractional Working Index, the weekly market-health index for the fractional executive economy.',
};

const jsonLdBlock =
  `\n    <script type="application/ld+json">${JSON.stringify(datasetLd)}</script>` +
  `\n    <script type="application/ld+json">${JSON.stringify(orgLd)}</script>\n`;

// ---- noscript content for non-JS crawlers ----
const noscriptBlock = `
    <noscript>
      <main>
        <h1>Fractional Working Index (FWI)</h1>
        ${haveLive
          ? `<p><strong>${escape(score.toFixed(1))} / 100 (${escape(label)})</strong>${deltaPhrase ? `, ${escape(deltaPhrase)}` : ''}${asOf ? `, as of ${escape(asOf)}` : ''}.</p>`
          : `<p>A weekly 0-100 composite index of the fractional executive market.</p>`}
        <p>The FWI is a private composite score (0-100) for the fractional executive market (fractional CFO, CMO, CTO, COO, CRO, and interim CEO), using 21 tracked inputs with mixed availability across demand, supply, culture, and context. The inputs are not all statistically independent. ${escape(methodology)}.</p>
        <p>SEC Form D filing velocity is included as startup-financing context. Pulse has not validated a predictive relationship between those filings and future fractional hiring.</p>
        <p>Free, no-auth API: <a href="${API}">${API}</a>. Weekly brief: <a href="https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief">export-brief</a>. Published by <a href="https://fractionl.ai">Fractionl</a>.</p>
      </main>
    </noscript>
`;

let html = readFileSync(HTML_PATH, 'utf8');

// 1. title
html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`);

// 2. description + OG/Twitter (replace content of the existing tags)
html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escape(description)}$2`);
html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escape(title)}$2`);
html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escape(description)}$2`);
html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escape(title)}$2`);
html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escape(description)}$2`);

// 3. canonical (was missing, audit gap)
if (!html.includes('rel="canonical"')) {
  html = html.replace('</head>', `    <link rel="canonical" href="${SITE}/" />\n  </head>`);
}

// 4. JSON-LD before </head>
html = html.replace('</head>', `${jsonLdBlock}  </head>`);

// 5. noscript before </body>
html = html.replace('</body>', `${noscriptBlock}  </body>`);

writeFileSync(HTML_PATH, html);

function writeAppRouteShell({ path, title: routeTitle, description: routeDescription, indexable, noscript }) {
  const canonical = `${SITE}${path}`;
  let routeHtml = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(routeTitle)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escape(routeDescription)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escape(routeTitle)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escape(routeDescription)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${SITE}/og-image.svg$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escape(routeTitle)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escape(routeDescription)}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${SITE}/og-image.svg$2`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
    .replace(/\s*<noscript>\s*<main>[\s\S]*?<\/main>\s*<\/noscript>\s*(?=<\/body>)/, '');

  const robots = indexable ? 'index, follow, max-snippet:-1, max-image-preview:large' : 'noindex, nofollow';
  const routeLd = indexable
    ? `\n    <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: routeTitle,
        description: routeDescription,
        url: canonical,
        isPartOf: { '@type': 'WebSite', name: 'Pulse by Fractionl', url: SITE },
      })}</script>`
    : '';

  routeHtml = routeHtml
    .replace('</head>', `    <meta name="robots" content="${robots}" />${routeLd}\n  </head>`)
    .replace('</body>', `    <noscript><main>${noscript}</main></noscript>\n  </body>`);

  const routeDir = join(__dirname, '..', 'dist', path.replace(/^\//, ''));
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'index.html'), routeHtml);
}

writeAppRouteShell({
  path: '/pricing',
  title: 'Pulse pricing | Public index and benchmark partnerships',
  description: 'Pulse keeps the Fractional Working Index free. Qualified fractional-talent firms can apply for a privacy-safe benchmark pilot, with enterprise cohorts released only after coverage thresholds are met.',
  indexable: true,
  noscript: '<h1>Pulse pricing</h1><p>The Fractional Working Index and its public API remain free. Qualified fractional-talent firms can apply for a £1,500 founding benchmark pilot. Enterprise cohorts begin at £15,000 per year only after coverage and privacy thresholds are met.</p>',
});

writeAppRouteShell({
  path: '/login',
  title: 'Sign in or create an account | Pulse by Fractionl',
  description: 'Create a Pulse account to save your fractional role and manage an optional API key. The market index remains public without an account.',
  indexable: false,
  noscript: '<h1>Pulse account</h1><p>JavaScript is required to sign in, create an account, or manage an API key. The Fractional Working Index remains public without an account.</p>',
});

console.log(
  haveLive
    ? `prerender: injected live FWI ${score.toFixed(1)} (${label}) + Dataset JSON-LD + noscript into dist/index.html`
    : 'prerender: API unreachable at build time, injected static JSON-LD + noscript (no live number) into dist/index.html',
);

// ---- Per-role SEO pages + the sitemap that has to match them ----------------
const DIST = join(__dirname, '..', 'dist');
const roleSlugs = await buildRolePages(DIST, SITE);
buildSitemap(DIST, SITE, roleSlugs);

