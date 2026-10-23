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
import { buildRolePages, buildSitemap, STYLES } from './prerender-roles.mjs';
import { buildAnswerHub, buildStandingPages, sitemapAnswerEntries } from './answers-lib.mjs';

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
// From the 2026-10-26 seam (method v2) a reading is a whole number with a band;
// earlier readings keep the one-decimal form they were published in.
const band = data?.score?.band;
const v2 = data?.meta?.version === '2.0';
const scoreText = haveLive ? (band ? `${score} (${band.low} to ${band.high})` : score.toFixed(1)) : '';
const inputsPhrase = v2
  ? 'nine inputs across demand, supply and culture, every one of which moves, with five official and market series held out to test it'
  : '20 tracked inputs across demand, supply, culture, and context';

const deltaPhrase = typeof delta === 'number'
  ? `${delta >= 0 ? 'up' : 'down'} ${v2 ? Math.round(Math.abs(delta)) : Math.abs(delta).toFixed(1)} points over 30 days`
  : '';

const title = haveLive
  ? `Fractional Working Index: ${band ? `${scoreText}, ${label}` : `${scoreText} (${label})`} | Pulse by Fractionl`
  : 'Pulse by Fractionl | The Fractional Working Index';

const description = haveLive
  ? `The fractional executive market is at ${scoreText} of 100 (${label})${deltaPhrase ? `, ${deltaPhrase}` : ''}. A private composite using ${inputsPhrase}. Not validated against an official measure; method at ${SITE}/methodology.`
  : 'A private 0-100 composite index of the fractional executive market, using 20 tracked inputs across demand, supply, culture, and context.';

// ---- schema.org JSON-LD ----
const datasetLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Fractional Working Index (FWI)',
  alternateName: 'FWI',
  description,
  '@id': `${SITE}/#dataset`,
  url: `${SITE}/`,
  isAccessibleForFree: true,
  inLanguage: 'en',
  creator: { '@id': 'https://fractionl.ai/#organization' },
  publisher: { '@id': 'https://fractionl.ai/#organization' },
  // There is no open-data licence; the terms of use grant free reading and
  // citation with attribution, so they are what a licence field should point at.
  license: `${SITE}/terms`,
  usageInfo: `${SITE}/methodology#how-to-cite-it`,
  creditText: 'Fractional Working Index (FWI), Pulse by Fractionl',
  keywords: ['fractional leadership', 'fractional executives', 'fractional CFO', 'fractional CMO', 'fractional CTO', 'fractional COO', 'fractional CRO', 'interim CEO', 'labour market index'],
  spatialCoverage: { '@type': 'Place', name: 'United States' },
  measurementTechnique: `Private composite using ${inputsPhrase}, weighted demand 50%, supply 20%, culture 30%. Recalculated after each successful daily ingest; completeness${v2 ? ' and a band' : ''} published with every reading. Not validated against any held-out official or market measure as of 2026-10-23; tests and their n are at ${SITE}/methodology. Every method change is dated at ${SITE}/changelog.`,
  variableMeasured: [
    { '@type': 'PropertyValue', name: 'Fractional Working Index (overall)', unitText: 'index, 0 to 100', minValue: 0, maxValue: 100, ...(haveLive ? { value: score } : {}) },
    { '@type': 'PropertyValue', name: 'Demand pillar', description: 'Weight 50%. Job postings naming six roles, plus financing context.', minValue: 0, maxValue: 100 },
    { '@type': 'PropertyValue', name: 'Supply pillar', description: 'Weight 20%. Public signals of fractional executives offering their services.', minValue: 0, maxValue: 100 },
    { '@type': 'PropertyValue', name: 'Culture pillar', description: 'Weight 30%. News, search, podcast, forum and reference-page attention.', minValue: 0, maxValue: 100 },
    { '@type': 'PropertyValue', name: 'Data completeness', description: 'Weighted share of tracked inputs that arrived for the reading. Not a prediction-accuracy metric.', minValue: 0, maxValue: 1 },
  ],
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
  '@id': 'https://fractionl.ai/#organization',
  name: 'Fractionl',
  url: 'https://fractionl.ai',
  logo: { '@type': 'ImageObject', url: `${SITE}/android-chrome-512x512.png`, width: 512, height: 512 },
  email: 'data@fractionl.ai',
  brand: { '@type': 'Brand', name: 'Pulse by Fractionl' },
  parentOrganization: { '@type': 'Organization', name: 'Mindmaker LLC' },
  description: 'Fractionl publishes Pulse and the Fractional Working Index, a free 0 to 100 composite of fractional leadership market health, recalculated after each successful daily ingest and read through a weekly brief.',
};

const siteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  name: 'Pulse by Fractionl',
  alternateName: 'Fractional Working Index',
  url: `${SITE}/`,
  inLanguage: 'en',
  publisher: { '@id': 'https://fractionl.ai/#organization' },
  about: { '@id': `${SITE}/#dataset` },
};

const ld = (x) => JSON.stringify(x).replace(/</g, '\\u003c');
const jsonLdBlock =
  `\n    <script type="application/ld+json">${ld(datasetLd)}</script>` +
  `\n    <script type="application/ld+json">${ld(orgLd)}</script>` +
  `\n    <script type="application/ld+json">${ld(siteLd)}</script>\n`;

// ---- noscript content for non-JS crawlers ----
const noscriptBlock = `
    <noscript>
      <main>
        <h1>Fractional Working Index (FWI)</h1>
        ${haveLive
          ? `<p><strong>${escape(scoreText)} / 100 (${escape(label)})</strong>${deltaPhrase ? `, ${escape(deltaPhrase)}` : ''}${asOf ? `, as of ${escape(asOf)}` : ''}.</p>`
          : `<p>A 0-100 composite index of the fractional executive market, recalculated after each successful daily ingest.</p>`}
        <p>The FWI is a private composite score (0-100) for the fractional executive market (fractional CFO, CMO, CTO, COO, CRO, and interim CEO), using ${escape(inputsPhrase)}. ${escape(methodology)}. It has not been validated against an official measure. <a href="/methodology">How it is made</a> &middot; <a href="/changelog">Changelog</a>.</p>
        <p>SEC Form D filing velocity is included as startup-financing context. Pulse has not validated a predictive relationship between those filings and future fractional hiring.</p>
        <p>Free, no-auth API: <a href="${API}">${API}</a>. Weekly brief: <a href="https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief">export-brief</a>. Published by <a href="https://fractionl.ai">Fractionl</a>.</p>
        <p>Pulse is a Mindmaker LLC company. Mindmaker Ltd in the UK. <a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a></p>
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
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${SITE}/og-image.png$2`)
    .replace(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1Pulse by Fractionl: the market instrument for fractional leadership$2`)
    .replace(/(<meta name="twitter:image:alt" content=")[^"]*(")/, `$1Pulse by Fractionl: the market instrument for fractional leadership$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escape(routeTitle)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escape(routeDescription)}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${SITE}/og-image.png$2`)
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
  noscript: '<h1>Pulse pricing</h1><p>The Fractional Working Index and its public API remain free. Qualified fractional-talent firms can apply for a £1,500 founding benchmark pilot. Enterprise cohorts begin at £15,000 per year only after coverage and privacy thresholds are met.</p><p>Pulse is a Mindmaker LLC company. Mindmaker Ltd in the UK. <a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a></p>',
});

writeAppRouteShell({
  path: '/terms',
  title: 'Terms of use | Pulse by Fractionl',
  description: 'The terms for using Pulse, the Fractional Working Index, its public API and MCP tools. Pulse is operated by Mindmaker LLC and Mindmaker Ltd.',
  indexable: true,
  noscript: '<h1>Terms of use</h1><p>Last updated: 19 October 2026.</p><p>Pulse is operated by Mindmaker LLC, a United States company, and Mindmaker Ltd, a United Kingdom company (together, "Mindmaker", "we", "us"). The index, public API and MCP tools are free to read and cite with attribution. Pulse is not an official index and is not financial, career or rate advice. Contact: <a href="mailto:data@fractionl.ai">data@fractionl.ai</a>.</p><p>Pulse is a Mindmaker LLC company. Mindmaker Ltd in the UK. <a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a></p>',
});

writeAppRouteShell({
  path: '/privacy',
  title: 'Privacy policy | Pulse by Fractionl',
  description: 'What Pulse collects, why, who processes it and how to ask for a copy or deletion. Pulse is operated by Mindmaker LLC and Mindmaker Ltd.',
  indexable: true,
  noscript: '<h1>Privacy policy</h1><p>Last updated: 19 October 2026.</p><p>Pulse is operated by Mindmaker LLC, a United States company, and Mindmaker Ltd, a United Kingdom company (together, "Mindmaker", "we", "us"). Mindmaker LLC and Mindmaker Ltd are responsible for the personal information described in this policy. Reading the index needs no account. Contact: <a href="mailto:data@fractionl.ai">data@fractionl.ai</a>.</p><p>Pulse is a Mindmaker LLC company. Mindmaker Ltd in the UK. <a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a></p>',
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
    ? `prerender: injected live FWI ${scoreText} (${label}) + Dataset JSON-LD + noscript into dist/index.html`
    : 'prerender: API unreachable at build time, injected static JSON-LD + noscript (no live number) into dist/index.html',
);

// ---- Per-role SEO pages + the sitemap that has to match them ----------------
const DIST = join(__dirname, '..', 'dist');
const roleSlugs = await buildRolePages(DIST, SITE);

// ---- Answer hub: /answers, /answers/<slug>, feed, llms-full.txt -------------
// Same static HTML for every visitor; validation failures stop the build.
const answers = buildAnswerHub({ root: join(__dirname, '..'), distDir: DIST, site: SITE, baseStyles: STYLES });
const standing = buildStandingPages({ root: join(__dirname, '..'), distDir: DIST, site: SITE, baseStyles: STYLES });
buildSitemap(DIST, SITE, roleSlugs, [...standing, ...sitemapAnswerEntries(answers, SITE)]);

