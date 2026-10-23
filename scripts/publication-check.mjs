// Daily publication check. Read-only, dependency-free, public data only.
//
// Replaces scheduled check-ins (Krish, 2026-10-23: "all of this needs to be
// antifragile, claude schedules suck"). .github/workflows/publication-check.yml
// runs it every day after the 06:00 ingest and the 06:40 rebuild; on failure it
// opens an issue assigned to Krish, and it closes that issue itself when the
// next run passes.
//
// It asserts what a reader would see, not what the pipeline says about itself:
//   - today's reading exists on the public API
//   - from the 2026-10-26 seam: method v2 with its link record, a band, a whole
//     number, no retired input among the contributors
//   - the page title carries the reading (and its band from the seam)
//   - the changelog states the fixed link amount once a v2 reading exists
//   - no retired or replaced source still has a health row after the seam, and
//     every promoted trial input has one
//
// Run:  node scripts/publication-check.mjs [--json] [--seam=YYYY-MM-DD]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://pulse.fractionl.ai';
const s = readFileSync(join(ROOT, 'src/lib/supabase.ts'), 'utf8');
const SB = { url: s.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)[1], key: s.match(/(eyJ[A-Za-z0-9._-]+)/)[1] };
const method = readFileSync(join(ROOT, 'supabase/functions/_shared/fwi-method.ts'), 'utf8');
// --seam=YYYY-MM-DD overrides the seam date, so the v2 checks can be shown to
// fail on a v1 day (a negative control) before the real seam arrives.
const SEAM = (process.argv.find((a) => a.startsWith('--seam=')) || '').split('=')[1] || method.match(/METHOD_V2_EFFECTIVE\s*=\s*'([^']+)'/)[1];
const list = (name) => [...method.match(new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`))[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
// Retired inputs and the two the promoted trials replaced (hn, wikipedia_pageviews):
// none may appear among the contributors or keep a health row after the seam.
const RETIRED = [...list('RETIRED_AT_V2'), ...list('REPLACED_AT_V2')];
const PROMOTED = (readFileSync(join(ROOT, 'supabase/functions/_shared/trials.ts'), 'utf8').match(/PROMOTED\s*=\s*\[([^\]]*)\]/)?.[1].match(/'([a-z0-9_]+)'/g) || []).map((x) => x.slice(1, -1));
const JSON_MODE = process.argv.includes('--json');

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });
async function get(url, json = true) {
  const r = await fetch(url, { headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}`, 'User-Agent': 'pulse-publication-check/1.0' }, signal: AbortSignal.timeout(30000) });
  return { status: r.status, body: json ? await r.json().catch(() => null) : await r.text() };
}

const today = new Date().toISOString().slice(0, 10);
const { status, body: cur } = await get(`${SB.url}/functions/v1/fwi-api/current`);
check('public API answers', status === 200 && cur?.score, `HTTP ${status}`);
const asOf = cur?.meta?.asOf;
check("today's reading is published", asOf === today, `asOf ${asOf}, today ${today}`);

if (asOf && asOf >= SEAM) {
  const m = cur.meta.method;
  check('reading uses method v2 with its link record', m?.id?.startsWith('fwi-v2') && typeof m.link_offset === 'number' && m.link_window?.n >= 25,
    m ? `${m.id}, link ${m.link_offset} over n = ${m.link_window?.n}` : 'no method record');
  const b = cur.score.band;
  check('reading is a whole number with a band', Number.isInteger(cur.score.overall) && b && b.low <= cur.score.overall && cur.score.overall <= b.high,
    `${cur.score.overall} (${b?.low} to ${b?.high})`);
  const retiredIn = (cur.contributors || []).filter((c) => RETIRED.includes(c.source)).map((c) => c.source);
  check('no retired input among the contributors', retiredIn.length === 0, retiredIn.join(', ') || `${(cur.contributors || []).length} contributors`);
  const changelog = (await get(`${SITE}/changelog`, false)).body;
  check('changelog states the fixed link amount', /Fixed at the first v2 run/.test(changelog), 'looked for "Fixed at the first v2 run" on /changelog');
  const health = (await get(`${SB.url}/rest/v1/data_source_health?select=source&pipeline=eq.fwi`)).body || [];
  const stale = health.map((h) => h.source).filter((x) => RETIRED.includes(x));
  check('no health row left for a retired or replaced input', stale.length === 0, stale.join(', ') || 'none');
  const unwatched = PROMOTED.filter((p) => !health.some((h) => h.source === p));
  check('every promoted input has a health row', PROMOTED.length > 0 && unwatched.length === 0, unwatched.join(', ') || PROMOTED.join(', '));
}

const home = (await get(`${SITE}/`, false)).body;
const title = home.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
const shown = cur?.score?.band ? `${cur.score.overall} (${cur.score.band.low} to ${cur.score.band.high})` : null;
check('page title carries the reading', shown ? title.includes(shown) : /Fractional Working Index: \d/.test(title), title);

const failed = results.filter((r) => !r.ok);
if (JSON_MODE) console.log(JSON.stringify({ date: today, seam: SEAM, ok: failed.length === 0, results }, null, 2));
else {
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
  console.log(`\n${results.length - failed.length}/${results.length} publication checks passed for ${today}`);
}
process.exit(failed.length ? 1 : 0);
