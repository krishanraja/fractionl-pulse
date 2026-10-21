// Renders the static social card (public/og-image.png, 1200x630) and the
// maskable app icon (public/android-chrome-maskable-512x512.png) from HTML
// with headless Chromium. Run by hand when the brand or the promise changes:
//
//   npm run og:render
//   CHROME=/path/to/chrome npm run og:render   (use a specific Chromium)
//
// Not part of the build: Vercel has no browser, and the PNGs are committed.
// The homepage and role pages keep their live-number cards from /api/og; this
// card serves every page that has no live reading of its own (pricing, terms,
// privacy, the answer hub). The copy is the approved public promise from
// docs/CORPORATE_STRATEGY.md, and the card carries no number, so it cannot go
// stale.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pub = join(root, 'public');

// The mark, exactly as public/favicon.svg draws it.
const MARK = `<svg viewBox="0 0 320 330" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><linearGradient id="amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD99A"/><stop offset="1" stop-color="#FEC15F"/></linearGradient></defs>
  <g fill="url(#amber)"><path d="M0 0h156v156H0z"/><path d="M174 0l146 50v78l-146 28z"/><path d="M0 174h156v156H0z"/><path d="M174 174l62 22v67l-62 24z"/></g>
</svg>`;

const BANDS = [
  ['Contracting', '#ff6b6b'],
  ['Cooling', '#ff9350'],
  ['Stable', '#f2c14e'],
  ['Growing', '#4ade80'],
  ['Surging', '#38d39b'],
];

const card = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#111827;color:#F8F4EA;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative;overflow:hidden}
.glow{position:absolute;right:-220px;top:-260px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,rgba(254,197,103,.13),rgba(254,197,103,0) 65%)}
.wrap{position:absolute;inset:0;padding:68px 72px 60px}
.eyebrow{font-size:21px;font-weight:700;letter-spacing:.2em;color:#FEC567}
h1{font-size:64px;line-height:1.06;letter-spacing:-.035em;font-weight:700;margin-top:34px;max-width:790px}
.sub{font-size:25px;line-height:1.4;color:#B9C1D0;margin-top:24px;max-width:700px}
.mark{position:absolute;right:84px;top:118px;width:228px}
.scale{position:absolute;left:72px;right:72px;bottom:96px}
.bar{display:flex;gap:6px}
.bar div{flex:1;height:10px;border-radius:5px}
.labels{display:flex;gap:6px;margin-top:12px}
.labels span{flex:1;font-size:16px;font-weight:600;color:#8F9AAD;letter-spacing:.02em}
.foot{position:absolute;left:72px;right:72px;bottom:44px;display:flex;justify-content:space-between;font-size:19px;color:#8F9AAD}
.foot b{color:#F8F4EA;font-weight:600}
</style></head><body>
<div class="glow"></div>
<div class="wrap">
  <div class="eyebrow">PULSE BY FRACTIONL</div>
  <h1>Read the fractional leadership market like an instrument.</h1>
  <p class="sub">The Fractional Working Index: a free 0 to 100 reading of demand, role movement and evidence strength.</p>
</div>
<div class="mark">${MARK}</div>
<div class="scale">
  <div class="bar">${BANDS.map(([, c]) => `<div style="background:${c}"></div>`).join('')}</div>
  <div class="labels">${BANDS.map(([n]) => `<span>${n}</span>`).join('')}</div>
</div>
<div class="foot"><span><b>pulse.fractionl.ai</b></span><span>Free index, API and MCP tools</span></div>
</body></html>`;

// Maskable icon: full-bleed navy, mark inside the central 80% safe zone so a
// circular or squircle mask never clips it (the existing icons put the mark at
// 64%, which a circle mask clips at the corners).
const maskable = `<!doctype html><html><head><style>
*{margin:0}body{width:512px;height:512px;background:#111827;display:flex;align-items:center;justify-content:center}
svg{width:236px;height:auto;transform:translateX(6px)}
</style></head><body>${MARK}</body></html>`;

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(card, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(pub, 'og-image.png'), type: 'png' });

  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(maskable, { waitUntil: 'load' });
  await page.screenshot({ path: join(pub, 'android-chrome-maskable-512x512.png'), type: 'png' });
} finally {
  await browser.close();
}

const size = (f) => {
  const b = readFileSync(join(pub, f));
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
};
console.log(`og:render wrote public/og-image.png (${size('og-image.png')}) and public/android-chrome-maskable-512x512.png (${size('android-chrome-maskable-512x512.png')})`);
