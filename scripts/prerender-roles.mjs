// Per-role demand index pages + the sitemap they belong in.
//
// Six crawlable pages (/fractional-cfo through /fractional-ceo). public/sitemap.xml
// has been submitting all six at priority 0.8, but none of them existed: there was
// no route in src/App.tsx, so the SPA catch-all rewrite in vercel.json served the
// homepage shell and React Router rendered NotFound. Every crawler that followed
// the sitemap got a soft 404 on all six.
//
// These are built by the same machine as the homepage prerender: fetched at build
// time, baked into static HTML, and refreshed daily by the Supabase pg_cron job
// `pulse-daily-redeploy` (supabase/migrations/009_redeploy_cron.sql), which pings
// the Vercel deploy hook at 06:40 UTC after the daily ingest. Vercel checks the
// filesystem before it applies rewrites, so dist/<slug>/index.html wins over the
// catch-all and the page is served as real static HTML, not a client-rendered shell.
//
// Data rule: every number on these pages comes from the live /fwi-roles read. If a
// figure is unavailable for a role, that element is omitted rather than guessed. The
// page itself is ALWAYS written, so the sitemap can never point at a 404 again.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROLES_API = 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-roles';
const BRIEF_API = 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/export-brief';
const CIRCLE = 'https://circle.fractionl.ai/?utm_source=pulse&utm_medium=cross_sell&utm_campaign=fwi_dashboard';

// `phrase` is the exact string each demand collector searches for (supabase/
// functions/ingest-signals/index.ts, FRACTIONAL_ROLES). Naming it on the page is
// what makes the number checkable by the reader rather than something they have
// to take on trust. It doubles as the mid-sentence form of the label, so the
// acronym stays capitalised ("fractional CFO", never "fractional cfo").
const ROLE_DEFS = [
  { role: 'cfo', label: 'Fractional CFO', slug: 'fractional-cfo', phrase: 'fractional CFO' },
  { role: 'cmo', label: 'Fractional CMO', slug: 'fractional-cmo', phrase: 'fractional CMO' },
  { role: 'cto', label: 'Fractional CTO', slug: 'fractional-cto', phrase: 'fractional CTO' },
  { role: 'coo', label: 'Fractional COO', slug: 'fractional-coo', phrase: 'fractional COO' },
  { role: 'cro', label: 'Fractional CRO', slug: 'fractional-cro', phrase: 'fractional CRO' },
  { role: 'ceo', label: 'Interim CEO', slug: 'fractional-ceo', phrase: 'interim CEO' },
];

// The band tone is applied by CLASS, not by an inline colour, so each colour
// scheme can carry its own value. An inline `style="--band:..."` would win over
// any stylesheet rule and force one tone to serve both schemes, which left the
// 11px band chip below the 4.5:1 contrast floor in dark mode.
const BAND_CLASS = {
  Surging: 'b-surging',
  Growing: 'b-growing',
  Stable: 'b-stable',
  Cooling: 'b-cooling',
  Contracting: 'b-contracting',
};

const SOURCE_LABEL = {
  adzuna: 'Adzuna (US job boards)',
  serpapi_jobs: 'Google Jobs via SerpAPI',
};

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Display convention, shared with src/lib/format.ts and the fwi-roles API: an
// index LEVEL renders as a whole number (one decimal on a multi-source blend is
// false precision, and the band boundaries are integers, so rounding keeps the
// number and its band label in lockstep). A CHANGE keeps one decimal, because a
// move of a few tenths is real signal that rounding would erase.
function lvl(n) { return String(Math.round(Number(n))); }
function one(n) { return Number(n).toFixed(1); }
function abs1(n) { return Math.abs(Number(n)).toFixed(1); }
function signed(n) { return `${n > 0 ? '+' : n < 0 ? '-' : ''}${abs1(n)}`; }

/**
 * What the LEVEL of the reading supports on price. Never quotes a rate: Pulse
 * holds no rate data, so inventing one here would be the worst kind of SEO page.
 */
function rateRead(r) {
  const base = {
    Surging: 'Advertised demand for this role is in the top band of the scale. A reading here does not support discounting. Lead with your rate, put it in the first conversation, and flex scope rather than price.',
    Growing: 'Advertised demand for this role is in the upper half of the scale. A reading here does not support discounting. Publish your rate, hold it, and let scope be the thing that moves.',
    Stable: 'A stable reading is not a discount signal. It supports publishing a rate and holding it, and competing on speed to first value and clarity of scope rather than on price.',
    Cooling: 'A cooling reading is a reason to change the shape of the offer, not the rate. A shorter first phase, a tighter scope and a defined end are easier to approve in a soft week. A day rate is the hardest thing to put back up once it has come down.',
    Contracting: 'Advertised demand is in the bottom band. Hold the rate and shrink the unit instead. A small fixed-scope first engagement is easier to say yes to than a retainer, and it leaves the rate intact for the renewal.',
  }[r.band];
  if (!base) return null;

  const v = r.vsRoleAverage;
  const rel = v == null
    ? ''
    : v >= 3
      ? ` It is also running ${one(v)} points above the average of the six roles this week, which is the strongest relative position on this page to negotiate from.`
      : v <= -3
        ? ` It is running ${abs1(v)} points below the average of the six roles this week, so expect more competition for each opportunity and be sharper about which ones you chase.`
        : ' It is tracking within a few points of the average of the six roles this week.';
  return base + rel;
}

/** What the DIRECTION of the reading supports on timing. */
function timingRead(r) {
  if (r.change7d == null || r.direction == null || r.prevDemand == null) return null;
  const span = `${lvl(r.prevDemand)} to ${lvl(r.demand)}`;
  if (r.direction === 'rising') {
    return `Demand rose ${one(r.change7d)} points against the previous seven days (${span}). Rising weeks are when outreach lands. This is the week to work the list you already have rather than the week to go and build a new one.`;
  }
  if (r.direction === 'falling') {
    return `Demand fell ${abs1(r.change7d)} points against the previous seven days (${span}). Falling weeks reward depth over volume: work the warm relationships, and hold the cold push for the turn.`;
  }
  return `Demand is effectively flat against the previous seven days (${span}). Nothing in the reading argues for changing what you are already doing this week.`;
}

function rankRead(r, total) {
  if (r.rank == null || !total) return null;
  if (r.rank === 1) return `Highest advertised demand of the ${total} roles the index tracks this week.`;
  if (r.rank === total) return `Lowest advertised demand of the ${total} roles the index tracks this week.`;
  return `Ranked ${r.rank} of ${total} on advertised demand this week.`;
}

/**
 * The concrete counts behind the score. The SerpAPI page cap is disclosed
 * because that collector reads one page of Google Jobs results, so it saturates
 * at ten and must not be read as a volume count.
 */
function countsRows(r) {
  if (!r.postings || !r.postings.length) return '';
  return r.postings
    .map((p) => {
      const note = p.source === 'serpapi_jobs'
        ? 'first page of results, saturates at ten, so read it as presence rather than volume'
        : 'US postings matching the exact phrase';
      return `<tr><td>${escape(SOURCE_LABEL[p.source] || p.source)}</td><td class="num">${escape(String(p.count))}</td><td class="dim">${escape(p.date)}</td><td class="dim">${note}</td></tr>`;
    })
    .join('');
}

function faqFor(r, def, overall) {
  const items = [];
  const lower = def.phrase; // mid-sentence form, acronym preserved
  const live = !!(r && r.demand != null);

  if (live) {
    const move = r.change7d == null
      ? '.'
      : r.direction === 'flat'
        ? ', unchanged within half a point of the previous seven days.'
        : `, ${r.direction === 'rising' ? 'up' : 'down'} ${abs1(r.change7d)} points against the previous seven days.`;
    let a = `Advertised demand for ${lower} roles reads ${lvl(r.demand)} out of 100 (${r.band}) for the seven days ending ${r.asOf}${move}`;
    if (overall && overall.score != null) {
      a += ` The overall Fractional Working Index sits at ${lvl(overall.score)} (${overall.band}) in the same week.`;
    }
    items.push({ q: `Is demand for ${lower} roles rising or falling right now?`, a });
  }

  const rate = live ? rateRead(r) : null;
  items.push({
    q: `What should a ${lower} charge?`,
    a: `Pulse does not publish rate data and will not invent it. What the index can tell you is the position you are negotiating from. ${rate || 'Check the live reading at the top of this page before your next pricing conversation.'}`,
  });

  items.push({
    q: `How is the ${lower} demand index calculated?`,
    a: `It counts job postings that name the phrase "${def.phrase}" explicitly, from two independent sources: Adzuna's US index and Google Jobs via SerpAPI. Each source is averaged across a trailing seven-day window, then the sources are averaged together and normalised onto the same 0 to 100 scale as the FWI demand pillar. It does not count full-time openings for the same title, and it does not count fractional work won by referral rather than by a posting.`,
  });

  return items;
}

/**
 * Inline styles only. These pages ship as standalone static HTML so a crawler
 * gets the full document in one request, with no CSS round trip and no JS at
 * all. Tokens mirror src/index.css (warm paper, ink indigo, the five FWI band
 * tones) in both light and dark.
 */
const STYLES = `
:root{--bg:#f9f7f3;--surface:#fff;--fg:#151827;--dim:#5e6378;--line:#e2e3e9;--primary:#242e89;--on-primary:#fff;--radius:14px}
.b-surging{--band:#0a7a56}.b-growing{--band:#157a3b}.b-stable{--band:#8a6206}.b-cooling{--band:#b04a08}.b-contracting{--band:#c02626}
@media(prefers-color-scheme:dark){
:root{--bg:#0c0e18;--surface:#121521;--fg:#f5f3ef;--dim:#989dae;--line:#242738;--primary:#8f9cf0;--on-primary:#0c0e18}
.b-surging{--band:#38d39b}.b-growing{--band:#4ade80}.b-stable{--band:#f2c14e}.b-cooling{--band:#ff9350}.b-contracting{--band:#ff6b6b}
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);line-height:1.62;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.wrap{max-width:720px;margin:0 auto;padding:32px 20px 72px}
a{color:var(--primary)}
.back{display:inline-block;font-size:13px;text-decoration:none;font-weight:600}
.back:hover{text-decoration:underline}
h1{font-size:clamp(26px,5.2vw,34px);line-height:1.14;letter-spacing:-.03em;margin:22px 0 6px;font-weight:700}
h2{font-size:17px;letter-spacing:-.015em;margin:38px 0 8px;font-weight:600}
h3{font-size:14px;margin:20px 0 4px;font-weight:600}
p{margin:0 0 12px}
.lede{color:var(--dim);font-size:15px;margin-bottom:22px}
.eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;margin:20px 0;position:relative;overflow:hidden}
.panel::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:var(--band,var(--primary))}
.reading{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:6px 0 2px}
.score{font-size:52px;font-weight:700;line-height:1;letter-spacing:-.04em;color:var(--band,var(--fg))}
.of{font-size:15px;color:var(--dim)}
.chip{display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;border:1px solid var(--band,var(--primary));color:var(--band,var(--primary))}
.meta{font-size:12px;color:var(--dim);margin-top:12px}
.meta span{display:inline-block;margin-right:16px}
.tablewrap{overflow-x:auto;margin:8px 0 4px}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:340px}
th,td{text-align:left;padding:8px 14px 8px 0;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);font-weight:700}
td.num{font-weight:600;white-space:nowrap}
td.dim,.dim{color:var(--dim)}
.roles{list-style:none;padding:0;margin:8px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px}
.roles a{display:flex;justify-content:space-between;gap:8px;text-decoration:none;font-size:13px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.roles a:hover{border-color:var(--primary)}
.roles .n{color:var(--dim)}
.onward{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 0}
.onward a{text-decoration:none;font-size:13px;font-weight:600;padding:10px 16px;border-radius:10px;border:1px solid var(--line)}
.onward a.solid{background:var(--primary);color:var(--on-primary);border-color:var(--primary)}
.onward a:hover{border-color:var(--primary)}
.cross{border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;margin:28px 0 0;background:var(--surface)}
.cross strong{font-size:13px}
.cross p{font-size:13px;color:var(--dim);margin:6px 0 10px}
.cross a{font-size:13px;font-weight:600;text-decoration:none}
.cross a:hover{text-decoration:underline}
.faq{margin:0}
.faq dt{font-weight:600;font-size:14px;margin:18px 0 4px}
.faq dd{margin:0;font-size:14px;color:var(--dim)}
footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);font-size:11px;color:var(--dim)}
`.trim();

function rolePage(def, r, data, site) {
  const overall = data && data.overall ? data.overall : null;
  const live = !!(r && r.demand != null);
  const bandClass = live ? BAND_CLASS[r.band] || '' : '';
  const canonical = `${site}/${def.slug}`;
  const lower = def.phrase; // mid-sentence form, acronym preserved
  const ogImage = `${site}/api/og?role=${def.role}`;

  const title = live
    ? `${def.label} Demand: ${lvl(r.demand)} of 100 (${r.band}) | Fractional Working Index`
    : `${def.label} Demand Index | Fractional Working Index`;

  const move = live && r.change7d != null
    ? `, ${r.direction === 'rising' ? 'up' : r.direction === 'falling' ? 'down' : 'flat within'} ${abs1(r.change7d)} points on the previous seven days`
    : '';
  const desc = live
    ? `Advertised demand for ${lower} roles reads ${lvl(r.demand)} of 100 (${r.band}) for the week ending ${r.asOf}${move}. What that says about your rate and your timing, from the weekly Fractional Working Index.`
    : `A weekly 0 to 100 demand index for ${lower} roles, counted from US job postings that name the phrase, and what the reading says about rates and timing.`;

  const faq = faqFor(r, def, overall);

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${def.label} Demand Index`,
      alternateName: `${def.label} demand, Fractional Working Index`,
      description: desc,
      url: canonical,
      isAccessibleForFree: true,
      creator: { '@type': 'Organization', name: 'Fractionl', url: 'https://fractionl.ai' },
      publisher: { '@type': 'Organization', name: 'Fractionl', url: 'https://fractionl.ai' },
      isPartOf: { '@type': 'Dataset', name: 'Fractional Working Index (FWI)', url: site },
      variableMeasured: {
        '@type': 'PropertyValue',
        name: `${def.label} advertised demand`,
        unitText: 'index, 0 to 100',
        ...(live ? { value: r.demand, minValue: 0, maxValue: 100 } : {}),
      },
      measurementTechnique: `Job postings naming the exact phrase "${def.phrase}", from Adzuna's US index and Google Jobs via SerpAPI, averaged per source across a trailing seven-day window then averaged across sources, normalised to 0 to 100. SEC Form D filing velocity is tracked separately as financing context, not a validated forecast.`,
      spatialCoverage: 'United States',
      temporalCoverage: '2026-03/..',
      ...(live && r.asOf ? { dateModified: r.asOf } : {}),
      distribution: [
        { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: ROLES_API, name: 'Per-role demand indices (JSON, no auth)' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Fractional Working Index', item: site },
        { '@type': 'ListItem', position: 2, name: `${def.label} demand`, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];

  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(desc)}">`,
    `<link rel="canonical" href="${canonical}">`,
    '<meta name="author" content="Fractionl">',
    '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">',
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="Pulse by Fractionl">',
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(desc)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${ogImage}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${escape(def.label)} demand reading from the Fractional Working Index">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escape(title)}">`,
    `<meta name="twitter:description" content="${escape(desc)}">`,
    `<meta name="twitter:image" content="${ogImage}">`,
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
    '<link rel="shortcut icon" href="/favicon.ico">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    `<link rel="alternate" type="application/rss+xml" title="Fractional Working Index weekly" href="${site}/feed.xml">`,
    `<style>${STYLES}</style>`,
    ...ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`),
  ].join('');

  const others = ROLE_DEFS.filter((d) => d.slug !== def.slug)
    .map((d) => {
      const o = data && Array.isArray(data.roles) ? data.roles.find((x) => x.slug === d.slug) : null;
      const n = o && o.demand != null ? `<span class="n">${lvl(o.demand)}</span>` : '';
      return `<li><a href="/${d.slug}"><span>${escape(d.label)}</span>${n}</a></li>`;
    })
    .join('');

  const rate = live ? rateRead(r) : null;
  const timing = live ? timingRead(r) : null;
  const rank = live && data ? rankRead(r, data.rolesMeasured) : null;
  const counts = live ? countsRows(r) : '';

  const readingPanel = live
    ? `<section class="panel${bandClass ? ` ${bandClass}` : ''}">
        <div class="eyebrow">Advertised demand, week ending ${escape(r.asOf)}</div>
        <div class="reading"><span class="score">${lvl(r.demand)}</span><span class="of">of 100</span><span class="chip">${escape(r.band)}</span></div>
        <div class="meta">${[
          r.change7d != null ? `<span><strong>${escape(signed(r.change7d))}</strong> vs the previous 7 days</span>` : '',
          data && data.roleAverage != null ? `<span>Six-role average ${lvl(data.roleAverage)}</span>` : '',
          rank ? `<span>${escape(rank)}</span>` : '',
        ].filter(Boolean).join('')}</div>
      </section>`
    : `<section class="panel">
        <div class="eyebrow">Advertised demand</div>
        <p class="dim" style="margin-top:10px">This week's reading for ${escape(lower)} is not available, so nothing is quoted here rather than a number being guessed. The live figure is always readable from <a href="${ROLES_API}">the free per-role endpoint</a> and on the <a href="/">dashboard</a>.</p>
      </section>`;

  const marketRows = overall && overall.score != null
    ? [
        `<tr><td>Fractional Working Index (overall)</td><td class="num">${lvl(overall.score)}</td><td class="dim">${escape(overall.band || '')}</td></tr>`,
        overall.demand != null ? `<tr><td>Demand pillar, all roles (weight 50%)</td><td class="num">${lvl(overall.demand)}</td><td class="dim"></td></tr>` : '',
        overall.supply != null ? `<tr><td>Supply pillar (weight 20%)</td><td class="num">${lvl(overall.supply)}</td><td class="dim"></td></tr>` : '',
        overall.culture != null ? `<tr><td>Culture pillar (weight 30%)</td><td class="num">${lvl(overall.culture)}</td><td class="dim"></td></tr>` : '',
        overall.confidence != null ? `<tr><td>Confidence in this week's composite</td><td class="num">${Math.round(overall.confidence * 100)}%</td><td class="dim">share of sources that reported</td></tr>` : '',
      ].filter(Boolean).join('')
    : '';

  const body = `<div class="wrap">
    <a class="back" href="/">&larr; Pulse, the Fractional Working Index</a>
    <h1>${escape(def.label)} demand index</h1>
    <p class="lede">What the Fractional Working Index says about demand for ${escape(lower)} work right now, what that means for your rate, and what it means for your timing. Rebuilt from live data every day.</p>

    ${readingPanel}

    ${rate || timing ? '<h2>What the reading means</h2>' : ''}
    ${rate ? `<h3>For your rate</h3><p>${escape(rate)}</p>` : ''}
    ${timing ? `<h3>For your timing</h3><p>${escape(timing)}</p>` : ''}
    ${live ? `<h3>Financing context</h3><p class="dim">Pulse tracks SEC Form D filing velocity alongside observed job-posting demand. The filing series provides startup-financing context, but Pulse has not validated a predictive relationship between those filings and future fractional hiring. It is documented on the <a href="/">dashboard</a>.</p>` : ''}

    ${counts ? `<h2>What was counted</h2>
    <div class="tablewrap"><table><thead><tr><th>Source</th><th>Count</th><th>Last read</th><th>What it is</th></tr></thead><tbody>${counts}</tbody></table></div>
    <p class="dim">Both sources are averaged across the seven days to ${escape(r.asOf)}, then averaged together, so a source that reported on five of those days does not outweigh one that reported on two.</p>` : ''}

    ${marketRows ? `<h2>The wider market this week</h2>
    <div class="tablewrap"><table><tbody>${marketRows}</tbody></table></div>` : ''}

    <h2>How this number is built</h2>
    <p>The ${escape(lower)} demand index counts job postings that name the phrase <strong>&ldquo;${escape(def.phrase)}&rdquo;</strong> explicitly, from two independent sources: Adzuna's US index and Google Jobs via SerpAPI. Each source is averaged across a trailing seven-day window, the sources are then averaged together, and the result is normalised onto the same 0 to 100 scale as the FWI demand pillar.</p>
    <p>Bands: 75 and above is Surging, 60 to 75 Growing, 45 to 60 Stable, 30 to 45 Cooling, and below 30 Contracting.</p>
    <p class="dim">What it does not count: full-time openings for the same title, and fractional work won by referral rather than by a posting. That second gap matters, because a large share of fractional engagements never reach a job board at all. Read this as a directional read on <em>advertised</em> demand, not as a census of the market.</p>
    <p class="dim">Pulse does not publish a per-role supply or talent-availability score. The supply sources are not role-differentiated once normalised, so splitting them by role would invent a distinction the data does not contain.</p>

    <h2>Questions</h2>
    <dl class="faq">${faq.map((f) => `<dt>${escape(f.q)}</dt><dd>${escape(f.a)}</dd>`).join('')}</dl>

    <h2>The other five roles</h2>
    <ul class="roles">${others}</ul>

    <h2>Go deeper</h2>
    <div class="onward">
      <a class="solid" href="/">Open the live dashboard</a>
      <a href="${ROLES_API}">Per-role JSON, no auth</a>
      <a href="${BRIEF_API}">Weekly brief</a>
      <a href="/feed.xml">RSS</a>
    </div>

    <aside class="cross">
      <strong>From the read to a plan</strong>
      <p>The index tells you what the ${escape(lower)} market is doing. Fractionl Circle pressure-tests your own offer against it, in the open, then turns the read into named warm-network moves toward your next retained client. A separate Fractionl product, free to start, Pro at $39 a month. Pulse itself stays free.</p>
      <a href="${escape(`${CIRCLE}&utm_content=${def.slug}`)}" rel="noopener">Open Fractionl Circle &rarr;</a>
    </aside>

    <footer>
      <p>Published by <a href="https://fractionl.ai">Fractionl</a>, a private composite. Not an official, institutional or government index, and not financial advice.</p>
      <p>Daily ingest, weekly settle. About 12 weeks of history and accumulating. US primary, UK secondary. Free to cite with attribution to the Fractional Working Index.</p>
    </footer>
  </div>`;

  return `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;
}

/**
 * Writes all six role pages into `dist`. Always writes every page, with or
 * without live numbers, and returns the slugs written so the sitemap can be
 * built from what actually exists.
 */
export async function buildRolePages(distDir, site) {
  let data = null;
  try {
    const res = await fetch(ROLES_API, { signal: AbortSignal.timeout(15000) });
    if (res.ok) data = await res.json();
  } catch {
    /* fall through and write the number-free pages */
  }

  const written = [];
  let withNumbers = 0;

  for (const def of ROLE_DEFS) {
    const found = data && Array.isArray(data.roles) ? data.roles.find((x) => x.slug === def.slug) : null;
    // Carry the window end date onto the role so every claim on the page is dated.
    const r = found ? { ...found, asOf: data.asOf } : null;
    if (r && r.demand != null) withNumbers += 1;
    mkdirSync(join(distDir, def.slug), { recursive: true });
    writeFileSync(join(distDir, def.slug, 'index.html'), rolePage(def, r, data, site));
    written.push(def.slug);
  }

  console.log(
    `prerender: wrote ${written.length} per-role pages (${withNumbers} carrying a live reading${withNumbers < written.length ? ', the rest number-free by design' : ''})`,
  );
  return written;
}

/**
 * Rewrites dist/sitemap.xml from the routes this build actually produced, so the
 * sitemap cannot drift back into advertising URLs that 404. public/sitemap.xml is
 * the checked-in copy of the same set; this overwrites it in dist with a fresh
 * lastmod, which the daily redeploy keeps current.
 */
export function buildSitemap(distDir, site, roleSlugs) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const url = (loc, changefreq, priority) =>
    `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
  const urls = [
    url(`${site}/`, 'daily', '1.0'),
    ...roleSlugs.map((s) => url(`${site}/${s}`, 'daily', '0.8')),
    url(`${site}/pricing`, 'monthly', '0.6'),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  writeFileSync(join(distDir, 'sitemap.xml'), xml);
  console.log(`prerender: wrote sitemap with ${urls.length} URLs, every one of them produced by this build`);
}
