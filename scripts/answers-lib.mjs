// The answer hub: question-led pages at /answers/<slug>, built from Markdown
// files in content/answers/. Adding a post is adding one file.
//
// Every page is static HTML written at build time, the same HTML for every
// visitor and every crawler. Nothing here reads a user agent. The hub is not
// linked from the app's navigation, header or footer; it is reached through
// sitemap.xml, llms.txt, llms-full.txt, /answers/feed.xml and its own index.
//
// File format (see docs/ANSWER_HUB.md for the full contract):
//
//   ---
//   title: Is fractional leadership growing in 2026?
//   slug: is-fractional-leadership-growing-2026
//   description: One sentence for search snippets, 50 to 160 characters.
//   answer: The direct answer, 40 to 60 words, shown first and used as the snippet.
//   datePublished: 2026-10-21
//   dateModified: 2026-10-21
//   related: what-is-the-fractional-working-index, how-to-cite-the-fractional-working-index
//   keywords: fractional leadership, fractional executives
//   ---
//   Markdown body. Must contain "## Sources" (a list of links) and
//   "## Frequently asked questions" (each question a "### " heading).
//
// No dependencies on purpose: the parser and the renderer below cover the
// subset of Markdown the posts use, and the validator rejects anything else
// that would render badly.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const ANSWERS_DIR_REL = 'content/answers';
export const PUBLISHER = {
  '@type': 'Organization',
  name: 'Fractionl',
  url: 'https://fractionl.ai',
  logo: { '@type': 'ImageObject', url: 'https://pulse.fractionl.ai/android-chrome-512x512.png', width: 512, height: 512 },
};
export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630 };

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(s) {
  return escapeHtml(s).replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const LIST_KEYS = new Set(['related', 'keywords']);

/** Front matter is `key: value` lines only. Lists are comma-separated. */
export function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: null, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) {
      meta.__invalid = [...(meta.__invalid || []), line];
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    meta[key] = LIST_KEYS.has(key)
      ? value.split(',').map((x) => x.trim()).filter(Boolean)
      : value;
  }
  return { meta, body: m[2] };
}

/** Splits a Markdown body into its "## " sections, keeping the order. */
export function sections(body) {
  const out = [];
  let current = { heading: null, lines: [] };
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^## (.+)$/);
    if (h) {
      out.push(current);
      current = { heading: h[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  out.push(current);
  return out.filter((s) => s.heading !== null || s.lines.some((l) => l.trim()));
}

export function parseSources(body) {
  const sec = sections(body).find((s) => s.heading && /^sources$/i.test(s.heading));
  if (!sec) return null;
  const links = [];
  for (const line of sec.lines) {
    for (const m of line.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) links.push({ name: m[1], url: m[2] });
  }
  return links;
}

export function parseFaq(body) {
  const sec = sections(body).find((s) => s.heading && /^frequently asked questions$/i.test(s.heading));
  if (!sec) return null;
  const items = [];
  let cur = null;
  for (const line of sec.lines) {
    const q = line.match(/^### (.+)$/);
    if (q) {
      if (cur) items.push(cur);
      cur = { q: q[1].trim(), a: [] };
    } else if (cur && line.trim()) {
      cur.a.push(line.trim());
    }
  }
  if (cur) items.push(cur);
  return items.map((x) => ({ q: x.q, a: stripInline(x.a.join(' ')) }));
}

/** Plain-text form of inline Markdown, for JSON-LD, feeds and llms files. */
export function stripInline(s) {
  return String(s)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(s) {
  return stripInline(s).replace(/\([^)]*https?:[^)]*\)/g, '').split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function inline(s) {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
    const external = /^https?:\/\//.test(href) && !href.startsWith('https://pulse.fractionl.ai');
    return `<a href="${href}"${external ? ' rel="noopener"' : ''}>${text}</a>`;
  });
  return out;
}

/** Headings, paragraphs, lists, fenced code and inline marks. Nothing else. */
export function renderMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const html = [];
  let para = [];
  let list = null; // { tag, items }
  let code = null;

  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };

  let table = null;
  const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const flushTable = () => {
    if (!table) return;
    const [header, , ...rows] = table;
    html.push(
      `<div class="tablewrap"><table><thead><tr>${cells(header).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
        `<tbody>${rows.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
    );
    table = null;
  };

  for (const line of lines) {
    if (!code && /^\|.*\|\s*$/.test(line)) {
      flushPara();
      flushList();
      (table ||= []).push(line);
      continue;
    }
    flushTable();
    if (code) {
      if (/^```/.test(line)) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (/^```/.test(line)) {
      flushPara();
      flushList();
      code = [];
      continue;
    }
    const h = line.match(/^(#{2,3}) (.+)$/);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`);
      continue;
    }
    const ul = line.match(/^- (.+)$/);
    const ol = line.match(/^\d+\. (.+)$/);
    if (ul || ol) {
      flushPara();
      const tag = ul ? 'ul' : 'ol';
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((ul || ol)[1]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushTable();
  flushPara();
  flushList();
  return html.join('\n');
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function loadAnswers(root) {
  const dir = join(root, ANSWERS_DIR_REL);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(dir, file), 'utf8');
      const { meta, body } = parseFrontMatter(raw);
      return {
        file,
        raw,
        meta: meta || {},
        hasFrontMatter: !!meta,
        body,
        sources: parseSources(body),
        faq: parseFaq(body),
      };
    })
    .sort((a, b) =>
      String(b.meta.datePublished || '').localeCompare(String(a.meta.datePublished || '')) ||
      String(a.meta.slug || '').localeCompare(String(b.meta.slug || '')),
    );
}

export const answerUrl = (site, slug) => `${site}/answers/${slug}`;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const REQUIRED = ['title', 'slug', 'description', 'answer', 'datePublished', 'dateModified'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Claim rules from docs/AGENT_BRIEFING.md and public/product-truth.json do_not_say.
const BANNED = [
  [/\u2014/, 'em dash (house style forbids them in user-facing copy)'],
  [/(?<!\bnot (?:a |an )?)\breal[- ]time\b/i, '"real-time" claim'],
  [/\b(?:first|only) (?:fractional )?(?:working )?index\b/i, '"first" or "only" index claim'],
  [/(?<!\bnot (?:a |an )?)\bpeer[- ]reviewed\b/i, 'peer-review claim'],
  [/(?<!\bnot (?:a |an )?)\bofficial index\b/i, 'official-index claim'],
  // A live reading must be read from the index, never typed into a post.
  [/\b(?:FWI|index|score)\s+(?:reads|is at|sits at|stands at|is currently)\s+\d/i, 'hardcoded live reading'],
  [/\b(?:organization|normalized|analyze|behavior|labeled|modeled)\b/i, 'American spelling (posts are British English)'],
];

/**
 * Returns a list of human-readable failures. Empty means every post is valid.
 * `today` is injectable so the check is deterministic in tests.
 */
export function validateAnswers(posts, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const failures = [];
  const slugs = new Map();
  const titles = new Map();
  const all = new Set(posts.map((p) => p.meta.slug));

  if (posts.length === 0) failures.push(`${ANSWERS_DIR_REL}: no answer posts found`);

  for (const p of posts) {
    const where = `${ANSWERS_DIR_REL}/${p.file}`;
    const m = p.meta;
    if (!p.hasFrontMatter) {
      failures.push(`${where}: missing front matter block`);
      continue;
    }
    if (m.__invalid) failures.push(`${where}: unparseable front matter line(s): ${m.__invalid.join(' | ')}`);
    for (const k of REQUIRED) if (!m[k] || !String(m[k]).trim()) failures.push(`${where}: missing required field "${k}"`);

    if (m.slug) {
      if (!SLUG.test(m.slug)) failures.push(`${where}: slug "${m.slug}" must be lowercase words joined by hyphens`);
      if (`${m.slug}.md` !== p.file) failures.push(`${where}: file name must be "${m.slug}.md"`);
      if (slugs.has(m.slug)) failures.push(`${where}: duplicate slug "${m.slug}" (also in ${slugs.get(m.slug)})`);
      slugs.set(m.slug, p.file);
    }
    if (m.title) {
      if (!m.title.trim().endsWith('?')) failures.push(`${where}: title must be the question, ending in "?"`);
      const t = m.title.toLowerCase();
      if (titles.has(t)) failures.push(`${where}: duplicate title (also in ${titles.get(t)})`);
      titles.set(t, p.file);
    }
    if (m.description && (m.description.length < 50 || m.description.length > 160)) {
      failures.push(`${where}: description is ${m.description.length} characters, needs 50 to 160`);
    }
    if (m.answer) {
      const n = wordCount(m.answer);
      if (n < 40 || n > 60) failures.push(`${where}: answer is ${n} words, needs 40 to 60`);
    }
    for (const k of ['datePublished', 'dateModified']) {
      if (m[k] && !DATE.test(m[k])) failures.push(`${where}: ${k} must be YYYY-MM-DD`);
      else if (m[k] && m[k] > today) failures.push(`${where}: ${k} ${m[k]} is in the future`);
    }
    if (m.datePublished && m.dateModified && m.dateModified < m.datePublished) {
      failures.push(`${where}: dateModified is earlier than datePublished`);
    }
    for (const r of m.related || []) {
      if (!all.has(r)) failures.push(`${where}: related slug "${r}" does not exist`);
      if (r === m.slug) failures.push(`${where}: related lists itself`);
    }

    if (!p.sources) failures.push(`${where}: missing "## Sources" section`);
    else if (p.sources.length < 2) failures.push(`${where}: "## Sources" needs at least two linked sources`);
    if (!p.faq) failures.push(`${where}: missing "## Frequently asked questions" section`);
    else {
      if (p.faq.length < 2) failures.push(`${where}: FAQ needs at least two questions`);
      for (const f of p.faq) {
        if (!f.q.endsWith('?')) failures.push(`${where}: FAQ heading "${f.q}" must be a question`);
        if (!f.a) failures.push(`${where}: FAQ "${f.q}" has no answer`);
      }
    }
    if (wordCount(p.body) < 300) failures.push(`${where}: body is ${wordCount(p.body)} words; an answer page needs depth (300+)`);
    if (/^# /m.test(p.body)) failures.push(`${where}: do not use "# " in the body; the title is the page heading`);
    if (/<[a-z][^>]*>/i.test(p.body.replace(/```[\s\S]*?```/g, ''))) failures.push(`${where}: raw HTML is not allowed in the body`);

    const text = [m.title, m.description, m.answer, p.body.replace(/```[\s\S]*?```/g, '')].join('\n');
    for (const [re, label] of BANNED) if (re.test(text)) failures.push(`${where}: ${label}: "${text.match(re)[0]}"`);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Page building
// ---------------------------------------------------------------------------

const ANSWER_STYLES = `
.crumbs{font-size:12px;color:var(--dim);margin:0 0 4px}
.crumbs a{text-decoration:none;font-weight:600}
.crumbs a:hover{text-decoration:underline}
.answer{font-size:17px;line-height:1.55;margin:0;color:var(--fg)}
.byline{font-size:12px;color:var(--dim);margin:6px 0 0}
article h2{scroll-margin-top:16px}
article ul,article ol{padding-left:20px;margin:0 0 12px}
article li{margin:0 0 6px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;background:var(--line);padding:1px 5px;border-radius:5px}
pre{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px;overflow-x:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.5}
pre code{background:none;padding:0}
.list{list-style:none;padding:0;margin:12px 0 0}
.list li{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:16px 18px;margin:0 0 10px}
.list a{font-weight:600;text-decoration:none;font-size:15px}
.list a:hover{text-decoration:underline}
.list p{font-size:13.5px;color:var(--dim);margin:6px 0 0}
`.trim();

function head({ title, description, canonical, site, ogType, ogAlt, extraMeta = [], ld, styles }) {
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${canonical}">`,
    '<meta name="author" content="Fractionl">',
    '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">',
    '<meta name="theme-color" content="#111827">',
    `<meta property="og:type" content="${ogType}">`,
    '<meta property="og:site_name" content="Pulse by Fractionl">',
    '<meta property="og:locale" content="en_GB">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${site}${OG_IMAGE.path}">`,
    '<meta property="og:image:type" content="image/png">',
    `<meta property="og:image:width" content="${OG_IMAGE.width}">`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}">`,
    `<meta property="og:image:alt" content="${escapeHtml(ogAlt)}">`,
    ...extraMeta,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${site}${OG_IMAGE.path}">`,
    `<meta name="twitter:image:alt" content="${escapeHtml(ogAlt)}">`,
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">',
    '<link rel="shortcut icon" href="/favicon.ico">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<link rel="alternate" type="application/rss+xml" title="Pulse answers" href="${site}/answers/feed.xml">`,
    `<style>${styles}</style>`,
    ...ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`),
  ].join('');
}

const FOOTER = `<footer>
      <p>Published by <a href="https://fractionl.ai">Fractionl</a>. The Fractional Working Index is a private composite, not an official, institutional or government index, and not financial, career or rate advice.</p>
      <p>Free to cite with attribution to the Fractional Working Index (FWI), Pulse by Fractionl. Questions or corrections: <a href="mailto:data@fractionl.ai">data@fractionl.ai</a>.</p>
      <p>Pulse is a Mindmaker LLC company. Mindmaker Ltd in the UK. <a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a></p>
    </footer>`;

function fmtDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function answerPage(p, posts, site, baseStyles) {
  const m = p.meta;
  const canonical = answerUrl(site, m.slug);
  const pageTitle = `${m.title} | Pulse answers`;
  const bySlug = new Map(posts.map((x) => [x.meta.slug, x]));
  const related = [
    ...(m.related || []),
    ...posts.map((x) => x.meta.slug).filter((s) => s !== m.slug && !(m.related || []).includes(s)),
  ]
    .map((s) => bySlug.get(s))
    .filter(Boolean)
    .slice(0, 4);

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': `${canonical}#article`,
      headline: m.title,
      description: m.description,
      abstract: m.answer,
      url: canonical,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      datePublished: m.datePublished,
      dateModified: m.dateModified,
      inLanguage: 'en-GB',
      isAccessibleForFree: true,
      author: { '@type': 'Organization', name: 'Fractionl', url: 'https://fractionl.ai' },
      publisher: PUBLISHER,
      image: { '@type': 'ImageObject', url: `${site}${OG_IMAGE.path}`, width: OG_IMAGE.width, height: OG_IMAGE.height },
      about: { '@type': 'Dataset', name: 'Fractional Working Index (FWI)', url: `${site}/` },
      isPartOf: { '@type': 'CollectionPage', '@id': `${site}/answers`, name: 'Pulse answers' },
      ...(m.keywords && m.keywords.length ? { keywords: m.keywords.join(', ') } : {}),
      citation: (p.sources || []).map((s) => ({ '@type': 'CreativeWork', name: s.name, url: s.url })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [{ q: m.title, a: m.answer }, ...p.faq].map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: stripInline(f.a) },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Pulse', item: `${site}/` },
        { '@type': 'ListItem', position: 2, name: 'Answers', item: `${site}/answers` },
        { '@type': 'ListItem', position: 3, name: m.title, item: canonical },
      ],
    },
  ];

  const h = head({
    title: pageTitle,
    description: m.description,
    canonical,
    site,
    ogType: 'article',
    ogAlt: 'Pulse by Fractionl: the market instrument for fractional leadership',
    extraMeta: [
      `<meta property="article:published_time" content="${m.datePublished}">`,
      `<meta property="article:modified_time" content="${m.dateModified}">`,
      '<meta property="article:author" content="Fractionl">',
    ],
    ld,
    styles: `${baseStyles}\n${ANSWER_STYLES}`,
  });

  const updated = m.dateModified !== m.datePublished ? ` &middot; Updated <time datetime="${m.dateModified}">${fmtDate(m.dateModified)}</time>` : '';

  const body = `<div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Pulse</a> &rsaquo; <a href="/answers">Answers</a></nav>
    <article>
    <h1>${escapeHtml(m.title)}</h1>
    <p class="byline">By Fractionl &middot; Published <time datetime="${m.datePublished}">${fmtDate(m.datePublished)}</time>${updated}</p>
    <section class="panel" aria-label="Short answer">
      <div class="eyebrow">Short answer</div>
      <p class="answer" style="margin-top:8px">${inline(m.answer)}</p>
    </section>
    ${renderMarkdown(p.body)}
    </article>

    <h2>Related answers</h2>
    <ul class="list">${related
      .map((r) => `<li><a href="/answers/${r.meta.slug}">${escapeHtml(r.meta.title)}</a><p>${escapeHtml(r.meta.description)}</p></li>`)
      .join('')}</ul>

    <h2>Read the live index</h2>
    <div class="onward">
      <a class="solid" href="/">Open the Fractional Working Index</a>
      <a href="/answers">All answers</a>
      <a href="/answers/feed.xml">Answers feed (RSS)</a>
    </div>

    ${FOOTER}
  </div>`;

  return `<!doctype html><html lang="en-GB"><head>${h}</head><body>${body}</body></html>`;
}

function indexPage(posts, site, baseStyles) {
  const canonical = `${site}/answers`;
  const title = 'Answers on the fractional leadership market | Pulse by Fractionl';
  const description = 'Direct, sourced answers to the questions people ask about fractional leadership, and how to read the Fractional Working Index to answer them.';
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': canonical,
      name: 'Pulse answers',
      description,
      url: canonical,
      inLanguage: 'en-GB',
      publisher: PUBLISHER,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: posts.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: answerUrl(site, p.meta.slug),
          name: p.meta.title,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Pulse', item: `${site}/` },
        { '@type': 'ListItem', position: 2, name: 'Answers', item: canonical },
      ],
    },
  ];
  const h = head({
    title,
    description,
    canonical,
    site,
    ogType: 'website',
    ogAlt: 'Pulse by Fractionl: the market instrument for fractional leadership',
    ld,
    styles: `${baseStyles}\n${ANSWER_STYLES}`,
  });
  const body = `<div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Pulse</a> &rsaquo; Answers</nav>
    <h1>Answers</h1>
    <p class="lede">Direct, sourced answers about the fractional leadership market. Each one says what the evidence shows, what it cannot show, and how to read the live Fractional Working Index rather than trusting a number frozen into a page.</p>
    <ul class="list">${posts
      .map(
        (p) => `<li><a href="/answers/${p.meta.slug}">${escapeHtml(p.meta.title)}</a><p>${escapeHtml(p.meta.answer)}</p><p><time datetime="${p.meta.dateModified}">Updated ${fmtDate(p.meta.dateModified)}</time></p></li>`,
      )
      .join('')}</ul>
    <div class="onward">
      <a class="solid" href="/">Open the Fractional Working Index</a>
      <a href="/answers/feed.xml">RSS feed</a>
      <a href="/llms-full.txt">llms-full.txt</a>
    </div>
    ${FOOTER}
  </div>`;
  return `<!doctype html><html lang="en-GB"><head>${h}</head><body>${body}</body></html>`;
}

function rfc822(iso) {
  return new Date(`${iso}T09:00:00Z`).toUTCString();
}

export function buildFeed(posts, site) {
  const latest = posts.reduce((a, p) => (p.meta.dateModified > a ? p.meta.dateModified : a), '1970-01-01');
  const items = posts
    .map((p) => {
      const url = answerUrl(site, p.meta.slug);
      return `    <item>
      <title>${escapeXml(p.meta.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(p.meta.datePublished)}</pubDate>
      <dc:creator>Fractionl</dc:creator>
      <description>${escapeXml(p.meta.answer)}</description>
      <content:encoded><![CDATA[${`<p>${inline(p.meta.answer)}</p>\n${renderMarkdown(p.body)}`.replace(/]]>/g, ']]&gt;')}]]></content:encoded>
    </item>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Pulse answers</title>
    <link>${site}/answers</link>
    <atom:link href="${site}/answers/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Direct, sourced answers about the fractional leadership market, from the publisher of the Fractional Working Index.</description>
    <language>en-gb</language>
    <lastBuildDate>${rfc822(latest)}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/** The block between the answers markers in llms.txt. */
export function llmsAnswersBlock(posts, site) {
  return [
    '<!-- answers:start (generated by `npm run answers:sync`; edit content/answers/ instead) -->',
    ...posts.map((p) => `- [${p.meta.title}](${answerUrl(site, p.meta.slug)}): ${p.meta.answer}`),
    '<!-- answers:end -->',
  ].join('\n');
}

export function sitemapAnswerEntries(posts, site) {
  const latest = posts.reduce((a, p) => (p.meta.dateModified > a ? p.meta.dateModified : a), '1970-01-01');
  return [
    { loc: `${site}/answers`, lastmod: latest, changefreq: 'weekly', priority: '0.7' },
    ...posts.map((p) => ({ loc: answerUrl(site, p.meta.slug), lastmod: p.meta.dateModified, changefreq: 'monthly', priority: '0.7' })),
  ];
}

export function buildLlmsFull(llmsTxt, posts, site) {
  const parts = [
    llmsTxt.trim(),
    '',
    '---',
    '',
    '# Full text of every answer',
    '',
    'Each answer below is also published as static HTML at its URL, with Article, FAQPage and BreadcrumbList JSON-LD. Live figures are never written into an answer; read them from the API endpoints above.',
  ];
  for (const p of posts) {
    parts.push(
      '',
      '---',
      '',
      `## ${p.meta.title}`,
      '',
      `URL: ${answerUrl(site, p.meta.slug)}`,
      `Published: ${p.meta.datePublished}. Updated: ${p.meta.dateModified}. Author and publisher: Fractionl.`,
      '',
      `Short answer: ${p.meta.answer}`,
      '',
      p.body.trim().replace(/^### /gm, '#### ').replace(/^## /gm, '### '),
    );
  }
  return `${parts.join('\n')}\n`;
}

/**
 * Writes /answers, /answers/<slug>, /answers/feed.xml and /llms-full.txt into
 * `distDir`, and rewrites the answers block in dist/llms.txt. Throws when any
 * post fails validation, so a broken post fails the build instead of shipping.
 */
export function buildAnswerHub({ root, distDir, site, baseStyles }) {
  const posts = loadAnswers(root);
  const failures = validateAnswers(posts);
  if (failures.length) {
    throw new Error(`answer hub validation failed:\n- ${failures.join('\n- ')}`);
  }

  mkdirSync(join(distDir, 'answers'), { recursive: true });
  writeFileSync(join(distDir, 'answers', 'index.html'), indexPage(posts, site, baseStyles));
  for (const p of posts) {
    mkdirSync(join(distDir, 'answers', p.meta.slug), { recursive: true });
    writeFileSync(join(distDir, 'answers', p.meta.slug, 'index.html'), answerPage(p, posts, site, baseStyles));
  }
  writeFileSync(join(distDir, 'answers', 'feed.xml'), buildFeed(posts, site));

  const llmsPath = join(distDir, 'llms.txt');
  let llms = readFileSync(llmsPath, 'utf8');
  llms = replaceAnswersBlock(llms, llmsAnswersBlock(posts, site));
  writeFileSync(llmsPath, llms);
  writeFileSync(join(distDir, 'llms-full.txt'), buildLlmsFull(llms, posts, site));

  console.log(`prerender: wrote answer hub (${posts.length} answers, index, feed.xml, llms-full.txt)`);
  return posts;
}

export function replaceAnswersBlock(text, block) {
  const re = /<!-- answers:start[\s\S]*?<!-- answers:end -->/;
  if (!re.test(text)) throw new Error('llms.txt has no <!-- answers:start --> ... <!-- answers:end --> block');
  return text.replace(re, block);
}
