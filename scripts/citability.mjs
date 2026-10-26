// Citability score, computed from live evidence. Read-only unless --record.
//
// docs/CITABILITY.md defines ten points. This scores every one of them against
// what a stranger can check: the public API, the public pages and the public
// `signals` table, with the public key. Nothing here reads a secret.
//
// Why it exists (Krish, 2026-10-26): "the overall north star of this
// repository is that we maintain 10/10 data collection consistently for a
// number of months so that this becomes a sellable product eventually." A score
// that is re-scored by hand on a good day says nothing about months; a score
// recorded every day, by a machine, from the evidence, does.
//
//   node scripts/citability.mjs             print today's score
//   node scripts/citability.mjs --json      the same as JSON
//   node scripts/citability.mjs --date=YYYY-MM-DD   score as of a day (negative control)
//   node scripts/citability.mjs --record    also append today's line to
//                                           docs/citability-log.jsonl (once per
//                                           date) and print the 10/10 streak
//
// Two rules make point 2 hold up over months (docs/CITABILITY.md, "How it is
// measured"):
//   - Monthly official series (Census, BLS) are judged on their release record,
//     read with the pipeline's own code: a day is delivered when the reading
//     that day had a release no more than three months old, and the series
//     moves when its score changed across the releases of the last 62 days.
//     They must also vote in today's reading, so collection itself is tested.
//   - An input with too little history to judge is PENDING, never a pass.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://pulse.fractionl.ai';
const LOG = join(ROOT, 'docs/citability-log.jsonl');
const s = readFileSync(join(ROOT, 'src/lib/supabase.ts'), 'utf8');
const SB = { url: s.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)[1], key: s.match(/(eyJ[A-Za-z0-9._-]+)/)[1] };
const method = readFileSync(join(ROOT, 'supabase/functions/_shared/fwi-method.ts'), 'utf8');
const SEAM = method.match(/METHOD_V2_EFFECTIVE\s*=\s*'([^']+)'/)[1];
const V2 = Object.fromEntries([...method.match(/V2_SOURCES[^=]*=\s*\{([\s\S]*?)\n\};/)[1].matchAll(/^\s*([a-z0-9_]+)\s*:\s*'([a-z]+)'/gm)].map((m) => [m[1], m[2]]));
const ingest = readFileSync(join(ROOT, 'supabase/functions/ingest-signals/index.ts'), 'utf8');
const PROBATIONARY = [...(ingest.match(/PROBATIONARY_SOURCES[^=]*=\s*\[([\s\S]*?)\]/)?.[1] || '').matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
const MONTHLY = ['census_bfs_pbs', 'bls_incorporated'];
const JSON_MODE = process.argv.includes('--json');
const RECORD = process.argv.includes('--record');

// --date=YYYY-MM-DD scores as if on that day: a negative control (a future
// date must fail point 1). Never combined with --record.
const today = (process.argv.find((x) => x.startsWith('--date=')) || '').split('=')[1] || new Date().toISOString().slice(0, 10);
if (RECORD && process.argv.some((x) => x.startsWith('--date='))) throw new Error('--record scores today only');
const shift = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const H = { apikey: SB.key, Authorization: `Bearer ${SB.key}`, 'User-Agent': 'pulse-citability/1.0' };
async function get(url, json = true) {
  try {
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(30000) });
    return { status: r.status, body: json ? await r.json().catch(() => null) : await r.text() };
  } catch (e) { return { status: 0, body: null, error: e.message }; }
}
async function restAll(path) {
  const out = [];
  for (let o = 0; ; o += 1000) {
    const r = await fetch(`${SB.url}/rest/v1/${path}`, { headers: { ...H, Range: `${o}-${o + 999}` } });
    const page = await r.json();
    if (!Array.isArray(page)) throw new Error(`signals read failed: ${JSON.stringify(page).slice(0, 200)}`);
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

const points = [];
const score = (n, name, value, evidence, gap = null) => points.push({ n, name, value, evidence, gap });

// ---- reads -----------------------------------------------------------------
const cur = (await get(`${SB.url}/functions/v1/fwi-api/current`)).body;
const hist = (await get(`${SB.url}/functions/v1/fwi-api/history?days=40`)).body?.history || [];
const asOf = cur?.meta?.asOf;
const v2 = asOf && asOf >= SEAM;
const band = cur?.score?.band;
const shown = band ? `${cur.score.overall} (${band.low} to ${band.high})` : null;
const since62 = shift(today, -62), since30 = shift(today, -30), since28 = shift(today, -28);
const sources = Object.keys(V2);
const { fetchOfficialSupply, RELEASE_DAY } = await import(pathToFileURL(join(ROOT, 'supabase/functions/_shared/official-supply.ts')).href);
const { officialScore, yoy } = await import(pathToFileURL(join(ROOT, 'supabase/functions/_shared/fwi-method.ts')).href);
const official = await fetchOfficialSupply().then((o) => ({ census_bfs_pbs: o.census_bfs_pbs, bls_incorporated: yoy(o.bls_incorporated) })).catch((e) => ({ error: e.message }));
const monthsBetween = (period, day) => { const [y, m] = period.split('-').map(Number); const [Y, M] = day.split('-').map(Number); return (Y - y) * 12 + (M - m); };
const signals = await restAll(`signals?select=date,source,normalized_value,metadata&source=in.(${sources.join(',')})&date=gte.${since62}&date=lte.${today}&order=date`);
const [home, methodology, changelog, feed, llms] = await Promise.all([
  get(`${SITE}/`, false), get(`${SITE}/methodology`, false), get(`${SITE}/changelog`, false),
  get(`${SB.url}/functions/v1/fwi-feed?format=json`), get(`${SITE}/llms.txt`, false),
]);
const mcp = await fetch(`${SB.url}/functions/v1/mcp`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }), signal: AbortSignal.timeout(30000) })
  .then(async (r) => ({ status: r.status, text: await r.text() })).catch(() => ({ status: 0, text: '' }));

// ---- 1 Fresh ---------------------------------------------------------------
{
  const days = new Set(hist.map((h) => h.date));
  const missing = [];
  for (let d = shift(today, -29); d <= today; d = shift(d, 1)) if (!days.has(d)) missing.push(d);
  const ok = asOf === today && missing.length === 0;
  score(1, 'Fresh', ok ? 1 : 0, `asOf ${asOf}; ${30 - missing.length}/30 days in /fwi-api/history`, ok ? null : `missing: ${missing.join(', ') || 'today'}`);
}

// ---- 2 Inputs collecting, continuous, moving -------------------------------
const inputs = {};
{
  const by = {};
  for (const r of signals) (by[r.source] ||= []).push(r);
  const gaps = [], pending = [];
  for (const src of sources) {
    if (MONTHLY.includes(src)) {
      const series = official[src];
      const voted = (cur?.contributors || []).some((c) => c.source === src && c.scored !== false);
      if (!series) { gaps.push(`${src}: release record unreadable (${official.error})`); inputs[src] = { pillar: V2[src], error: official.error }; continue; }
      const missed = [], scores = new Set();
      for (let d = shift(today, -61); d <= today; d = shift(d, 1)) {
        const o = officialScore(series, d, RELEASE_DAY[src]);
        if (o) scores.add(o.score);
        if (d >= shift(today, -29) && (!o || monthsBetween(o.period, d) > 3)) missed.push(d);
      }
      const delivered = 30 - missed.length;
      inputs[src] = { pillar: V2[src], basis: 'release record', delivered, pct: Math.round((delivered / 30) * 1000) / 10, missed, misses_left: Math.max(0, 3 - missed.length),
        movement_window_days: 62, distinct_values: scores.size, moved: scores.size > 1, judgeable: true, voted_today: voted, clear_on: missed.length > 3 ? shift(missed.at(-4), 30) : null };
      if (delivered < 27) gaps.push(`${src} release current on ${delivered}/30 days`);
      if (scores.size < 2) gaps.push(`${src} did not move across its releases in 62 days`);
      if (v2 && !voted) gaps.push(`${src} did not vote in today's reading`);
      continue;
    }
    const rows = by[src] || [];
    const delivered = new Set(rows.filter((r) => r.date >= shift(today, -29)).map((r) => r.date));
    const missed = [];
    for (let d = shift(today, -29); d <= today; d = shift(d, 1)) if (!delivered.has(d)) missed.push(d);
    const pct = delivered.size / 30;
    const win = MONTHLY.includes(src) ? since62 : since28;
    const inWin = rows.filter((r) => r.date >= win);
    const storedDays = new Set(inWin.map((r) => r.date)).size;
    const needDays = MONTHLY.includes(src) ? 62 : 14;
    // Movement per source: its daily mean (one vote per source), as the method scores it.
    const daily = {};
    for (const r of inWin) (daily[r.date] ||= []).push(Number(r.normalized_value));
    const values = new Set(Object.values(daily).map((v) => (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)));
    const firstStored = rows[0]?.date;
    const judgeable = storedDays >= needDays || (firstStored && firstStored <= win);
    const moved = values.size > 1;
    // Days until the last miss leaves the 30-day window, and how many more
    // misses the 90% bar still allows (at most 3 in 30).
    const clearOn = missed.length > 3 ? shift(missed.at(-4), 30) : null;
    inputs[src] = { pillar: V2[src], delivered: delivered.size, pct: Math.round(pct * 1000) / 10, missed, misses_left: Math.max(0, 3 - missed.length),
      movement_window_days: MONTHLY.includes(src) ? 62 : 28, distinct_values: values.size, moved, judgeable: !!judgeable, clear_on: clearOn };
    if (pct < 0.9) gaps.push(`${src} delivered ${delivered.size}/30 days${clearOn ? ` (clears ${clearOn} if it misses no more)` : ''}`);
    if (!moved && judgeable) gaps.push(`${src} did not move in ${MONTHLY.includes(src) ? 62 : 28} days`);
    if (!moved && !judgeable) pending.push(`${src} (${storedDays} stored days, needs ${needDays} to judge movement)`);
  }
  if (PROBATIONARY.length) gaps.push(`probationary sources awaiting a decision: ${PROBATIONARY.join(', ')}`);
  const wrongCount = v2 && (cur?.contributors || []).filter((c) => c.scored !== false && sources.includes(c.source)).length !== sources.length;
  if (wrongCount) gaps.push(`contributors do not list all ${sources.length} composite inputs`);
  // Pending is not a pass: a point is 1 only when every input has been judged.
  // 1: every input passes and none is pending. 0.5 ("partly true, the gap
  // named"): at least 7 of 10 inputs pass every check. Otherwise 0.
  const failing = sources.filter((x) => gaps.some((g) => g.startsWith(`${x} `) || g.startsWith(`${x}:`)) || pending.some((p) => p.startsWith(`${x} `)));
  const passShare = (sources.length - failing.length) / sources.length;
  const value = failing.length === 0 && !PROBATIONARY.length && !wrongCount ? 1 : passShare >= 0.7 ? 0.5 : 0;
  score(2, 'Inputs collecting, continuous and moving', value,
    `${sources.length - failing.length} of ${sources.length} composite inputs pass every check (delivered on 27+ of 30 days, moved in their window)`,
    [...gaps, ...pending.map((p) => `pending: ${p}`)].join('; ') || null);
}

// ---- 3 Construction --------------------------------------------------------
{
  const m = cur?.meta?.method;
  const scored = (cur?.contributors || []).filter((c) => c.scored !== false);
  const perSource = new Set(scored.map((c) => c.source)).size === scored.length;
  const ok = v2 && m?.id?.startsWith('fwi-v2') && perSource && scored.length === sources.length;
  score(3, 'Built so a careful analyst accepts it', ok ? 1 : 0, `${m?.id ?? 'no method record'}; ${scored.length} scored contributors, one per source: ${perSource}`, ok ? null : 'method v2 with one vote per composite input is not what /current shows');
}

// ---- 4 Precision and band --------------------------------------------------
{
  const title = home.body?.match?.(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const top = feed.body?.items?.[0];
  const checks = {
    api: !!band && Number.isInteger(cur?.score?.overall) && band.low <= cur.score.overall && cur.score.overall <= band.high,
    citation: !!shown && (cur?.meta?.citation || '').includes(shown),
    title: !!shown && title.includes(shown),
    feed: !!shown && top?.date === asOf && (top?.title || '').includes(shown),
  };
  const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  score(4, 'Honest precision and a stated band', bad.length ? 0 : 1, `${shown ?? cur?.score?.overall} on API, citation, page title and RSS`, bad.length ? `no band on: ${bad.join(', ')}` : null);
}

// ---- 5 Sources per number --------------------------------------------------
{
  const c = cur?.contributors || [];
  const ok = c.length > 0 && c.every((x) => x.source && x.name && x.asOf && 'value' in x);
  score(5, 'Sources visible per number', ok ? 1 : 0, `${c.length} contributors with name, value and as-of date`, ok ? null : 'contributors missing or incomplete');
}

// ---- 6 Validation with n ---------------------------------------------------
{
  const raw = methodology.body || '';
  const at = raw.indexOf('id="validation"');
  const section = at < 0 ? '' : raw.slice(at, at + 6000).replace(/<[^>]*>/g, ' ');
  const dated = section.match(/As of (\d{1,2} [A-Z][a-z]+ \d{4})/)?.[1];
  const ok = /id="validation"/.test(methodology.body || '') && /r = -?\d/.test(section) && /\d+ weeks/.test(section) && !!dated && !!cur?.meta?.validation?.status;
  const age = dated ? Math.round((Date.now() - Date.parse(`${dated} UTC`)) / 86400000) : null;
  score(6, 'External validation stated with its n', ok ? 1 : 0, `/methodology#validation dated ${dated ?? 'none'} (${age ?? '?'} days old), r and n stated; API status "${cur?.meta?.validation?.status ?? 'none'}"`, ok ? null : 'validation statement missing r, n or a date');
}

// ---- 7 Methodology page ----------------------------------------------------
{
  const b = methodology.body || '';
  const ok = methodology.status === 200 && /<title>[^<]*made[^<]*<\/title>/i.test(b) && /One vote per source/.test(b);
  score(7, 'A methodology page people can quote', ok ? 1 : 0, `/methodology HTTP ${methodology.status}, server-rendered method text present: ${/One vote per source/.test(b)}`, ok ? null : 'methodology page missing, client-rendered or out of date');
}

// ---- 8 Changelog -----------------------------------------------------------
{
  const b = changelog.body || '';
  const ok = changelog.status === 200 && /26 October 2026: method v2/.test(b) && (!v2 || /Fixed at the first v2 run/.test(b)) && !/\{\{/.test(b);
  score(8, 'A changelog of methodology seams', ok ? 1 : 0, `/changelog HTTP ${changelog.status}; seam entry and its fixed link amount present`, ok ? null : 'changelog missing the seam entry, its link amount, or has an unfilled placeholder');
}

// ---- 9 Citation and machine access -----------------------------------------
{
  const checks = { citation: !!cur?.meta?.citation, history: hist.length > 0, llms: llms.status === 200 && /pulse\.fractionl\.ai/.test(llms.body || ''), mcp: mcp.status === 200 && /get_fractional_working_index/.test(mcp.text) };
  const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  score(9, 'Stable citation URL, suggested citation and machine access', bad.length ? 0 : 1, 'meta.citation, /fwi-api/history, llms.txt, MCP tools/list', bad.length ? `failing: ${bad.join(', ')}` : null);
}

// ---- 10 Owner and contact --------------------------------------------------
{
  const b = methodology.body || '';
  const ok = /Krish Raja/.test(b) && /hello@krishraja\.com/.test(b) && cur?.meta?.owner?.corrections === 'hello@krishraja.com' && !/@fractionl\.ai/.test(b);
  score(10, 'A named owner and a contact', ok ? 1 : 0, 'Krish Raja and hello@krishraja.com on /methodology and in meta.owner', ok ? null : 'owner or contact missing, or a dead fractionl.ai address shown');
}

const total = points.reduce((a, p) => a + p.value, 0);
const record = { date: today, score: total, as_of: asOf, reading: shown, points: Object.fromEntries(points.map((p) => [p.n, p.value])), gaps: points.filter((p) => p.gap).map((p) => `${p.n}: ${p.gap}`) };

// ---- record and streak -----------------------------------------------------
let log = existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
if (RECORD && !log.some((l) => l.date === today)) { appendFileSync(LOG, JSON.stringify(record) + '\n'); log.push(record); }
const byDate = Object.fromEntries(log.map((l) => [l.date, l.score]));
let streak = 0;
for (let d = byDate[today] != null ? today : shift(today, -1); byDate[d] === 10; d = shift(d, -1)) streak++;
const first10 = log.find((l) => l.score === 10)?.date ?? null;
// The target is the North Star metric block's (docs/NORTH_STAR.md), not a copy.
const target = Number(readFileSync(join(ROOT, 'docs/NORTH_STAR.md'), 'utf8').match(/```yaml north-star-metric[\s\S]*?\ntarget:\s*(\d+)/)?.[1]) || null;

if (JSON_MODE) console.log(JSON.stringify({ ...record, streak_days_at_10: streak, streak_target_days: target, first_10: first10, recorded_days: log.length, inputs, points }, null, 2));
else {
  console.log(`CITABILITY ${total} / 10 on ${today} (reading ${shown ?? asOf})\n`);
  for (const p of points) console.log(`${String(p.value).padEnd(3)} ${p.n}. ${p.name}\n      ${p.evidence}${p.gap ? `\n      gap: ${p.gap}` : ''}`);
  console.log('\nInputs (point 2):');
  for (const [src, i] of Object.entries(inputs)) console.log(`  ${src.padEnd(18)} ${String(i.delivered).padStart(2)}/30 delivered  misses left ${i.misses_left}  moved ${i.moved ? 'yes' : i.judgeable ? 'NO' : 'pending'} (${i.movement_window_days}d, ${i.distinct_values} values)${i.clear_on ? `  clears ${i.clear_on}` : ''}`);
  console.log(`\nStreak at 10/10: ${streak}${target ? ` of ${target}` : ''} day(s)${first10 ? `, first 10 on ${first10}` : ', not yet reached'}; ${log.length} day(s) recorded in docs/citability-log.jsonl`);
}
