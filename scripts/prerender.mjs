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

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
  ? `The fractional executive market is at ${score.toFixed(1)} of 100 (${label})${deltaPhrase ? `, ${deltaPhrase}` : ''}. A weekly composite of 21 data sources across demand, supply, and culture, with the Form D Lead as a 1 to 3 month forward demand signal.`
  : 'A weekly 0-100 composite index of the fractional executive market, blended from 21 data sources across demand, supply, and culture.';

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
  creator: { '@type': 'Organization', name: 'Fractionl', url: 'https://fractionl.com' },
  publisher: { '@type': 'Organization', name: 'Fractionl', url: 'https://fractionl.com' },
  license: 'https://pulse.fractionl.ai',
  measurementTechnique: 'Weekly composite of 21 independent sources across demand (50%), supply (20%), and culture (30%). The Form D Lead uses SEC Form D filing velocity as a 1 to 3 month leading indicator of fractional executive demand.',
  temporalCoverage: '2026-03/..',
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
  url: 'https://fractionl.com',
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
        <p>The FWI is a weekly composite score (0-100) for the fractional executive market (fractional CFO, CMO, CTO, COO, CRO, and interim CEO), blended from 21 independent data sources across three pillars: demand, supply, and culture. ${escape(methodology)}.</p>
        <p>The Form D Lead, Pulse's named method, uses SEC Form D filing velocity as a 1 to 3 month leading indicator of fractional executive demand.</p>
        <p>Free, no-auth API: <a href="${API}">${API}</a>. Weekly brief: <a href="https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief">export-brief</a>. Published by <a href="https://fractionl.com">Fractionl</a>.</p>
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

console.log(
  haveLive
    ? `prerender: injected live FWI ${score.toFixed(1)} (${label}) + Dataset JSON-LD + noscript into dist/index.html`
    : 'prerender: API unreachable at build time, injected static JSON-LD + noscript (no live number) into dist/index.html',
);

// ---- Per-role demand index pages (crawlable, distinct content per role) ----
async function buildRolePages() {
  let roleData = null;
  try {
    const res = await fetch('https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-roles', { signal: AbortSignal.timeout(15000) });
    if (res.ok) roleData = await res.json();
  } catch { /* skip role pages if unavailable */ }
  if (!roleData?.roles?.length) { console.log('prerender: fwi-roles unavailable, skipped role pages'); return; }

  const headTags = (title, desc, canonical, ld) =>
    `<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">` +
    `<title>${escape(title)}</title><meta name="description" content="${escape(desc)}">` +
    `<link rel="canonical" href="${canonical}"><meta property="og:title" content="${escape(title)}">` +
    `<meta property="og:description" content="${escape(desc)}"><meta property="og:image" content="${SITE}/api/og">` +
    `<meta property="og:type" content="website"><meta property="og:url" content="${canonical}">` +
    `<meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon.svg">` +
    `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;

  let count = 0;
  for (const r of roleData.roles) {
    if (r.demand == null) continue;
    const title = `${r.label} Demand Index: ${r.demand} (${r.band}) | Pulse`;
    const desc = `Demand for ${r.label.toLowerCase()} roles reads ${r.demand} of 100 (${r.band}) this week, within an overall Fractional Working Index of ${roleData.overall.score} (${roleData.overall.band}). A weekly index from Fractionl.`;
    const canonical = `${SITE}/${r.slug}`;
    const ld = {
      '@context': 'https://schema.org', '@type': 'Dataset',
      name: `${r.label} Demand Index`, description: desc, url: canonical, isAccessibleForFree: true,
      creator: { '@type': 'Organization', name: 'Fractionl' }, publisher: { '@type': 'Organization', name: 'Fractionl' },
      variableMeasured: `${r.label} demand`, measurementTechnique: 'Mean of normalized Adzuna + SerpAPI Google Jobs demand signals for the week, plus the Form D Lead as a 1 to 3 month leading indicator.',
      ...(roleData.asOf ? { dateModified: roleData.asOf } : {}),
    };
    const body = `
    <main style="max-width:680px;margin:0 auto;padding:48px 20px;font-family:Inter,system-ui,sans-serif;color:#1e2233;line-height:1.6">
      <a href="/" style="color:#4338ca;text-decoration:none;font-size:14px">Pulse, the Fractional Working Index</a>
      <h1 style="font-size:30px;letter-spacing:-0.02em;margin:18px 0 4px">${escape(r.label)} Demand Index</h1>
      <p style="font-size:44px;font-weight:700;margin:8px 0;color:#0b1020">${r.demand}<span style="font-size:18px;color:#64748b"> / 100 &middot; ${escape(r.band)}</span></p>
      <p style="color:#475569">Demand for ${escape(r.label.toLowerCase())} roles reads <strong>${r.demand} of 100 (${escape(r.band)})</strong> for the week of ${escape(roleData.asOf || '')}, within an overall Fractional Working Index of <strong>${roleData.overall.score} (${escape(roleData.overall.band)})</strong>.</p>
      <p style="color:#475569">This per-role demand index is the mean of normalized Adzuna and SerpAPI Google Jobs signals for the week. The Form D Lead, Pulse's named method, uses SEC Form D filing velocity as a 1 to 3 month leading indicator of fractional executive demand.</p>
      <p style="color:#475569">See the live index and all six roles on the <a href="/" style="color:#4338ca">Pulse dashboard</a>, query the free no-auth API at <code>/functions/v1/fwi-roles</code>, or read the <a href="/feed.xml" style="color:#4338ca">weekly feed</a>. Published by <a href="https://fractionl.com" style="color:#4338ca">Fractionl</a>.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:28px">A weekly index (daily ingest, weekly settle). Not financial advice. About 12 weeks of history and accumulating.</p>
    </main>`;
    const doc = `<!doctype html><html lang="en"><head>${headTags(title, desc, canonical, ld)}</head><body>${body}</body></html>`;
    mkdirSync(join(__dirname, '..', 'dist', r.slug), { recursive: true });
    writeFileSync(join(__dirname, '..', 'dist', r.slug, 'index.html'), doc);
    count++;
  }
  console.log(`prerender: wrote ${count} per-role demand pages`);
}

await buildRolePages();
