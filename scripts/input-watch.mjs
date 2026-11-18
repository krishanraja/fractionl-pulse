// Which index inputs need someone today. Read-only; public key only.
//
//   node scripts/input-watch.mjs <citability.json>   JSON: { date, alerts, body }
//
// <citability.json> is `node scripts/citability.mjs --json`, so the watch uses
// the score's own definition of a delivered day. The provider's last error
// comes from the public `data_source_health` table. The rules are in
// scripts/input-watch-lib.mjs; .github/workflows/publication-check.yml opens,
// comments on and closes the issue from this output.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { alertBody, findInputAlerts } from './input-watch-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const citeFile = process.argv[2];
if (!citeFile) throw new Error('usage: node scripts/input-watch.mjs <citability.json>');
const cite = JSON.parse(readFileSync(citeFile, 'utf8'));
if (!cite?.date || !cite?.inputs) throw new Error(`${citeFile} is not citability --json output`);

const s = readFileSync(join(ROOT, 'src/lib/supabase.ts'), 'utf8');
const SB = { url: s.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)[1], key: s.match(/(eyJ[A-Za-z0-9._-]+)/)[1] };
const sources = Object.keys(cite.inputs);
const res = await fetch(`${SB.url}/rest/v1/data_source_health?select=source,status,last_success,last_checked,metadata&source=in.(${sources.join(',')})`, {
  headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}`, 'User-Agent': 'pulse-input-watch/1.0' },
  signal: AbortSignal.timeout(30000),
});
const health = await res.json();
// A health read that fails must not look like "nothing wrong": the missed rule
// still runs from the citability record, and the failure is named.
const healthError = Array.isArray(health) ? null : `data_source_health read failed: HTTP ${res.status}`;

const alerts = findInputAlerts({ today: cite.date, inputs: cite.inputs, health: healthError ? [] : health });
const body = alerts.length ? alertBody({ today: cite.date, alerts, runUrl: process.env.RUN_URL }) : null;
console.log(JSON.stringify({ date: cite.date, alerts, health_error: healthError, body }, null, 2));
