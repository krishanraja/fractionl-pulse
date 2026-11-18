// The input watch: which index inputs need someone today, and why.
//
// Found 2026-11-18: DataForSEO stopped accepting Pulse's login on 13 November.
// Three of the ten index inputs went dark, the North Star streak slipped a day
// for every day it lasted, and for six days no issue was assigned to anyone.
// The daily check only opened one when the publication check failed or the
// score fell from 10, and the score had never been 10. This names the failure
// on the day it happens.
//
// Two rules, both read from evidence a stranger can check (the citability
// record and the public `data_source_health` table):
//   account  the provider refused Pulse's account today (login, key or
//            billing). Only Krish can fix it, so it fires on day one.
//   missed   the input delivered nothing today or yesterday, whatever the
//            cause. One missed day is noise; two in a row is an incident.
// Pure: no network, no clock. scripts/input-watch.mjs supplies the evidence.

// A provider refusing the account, not a transient failure. 429 and 5xx are
// left out on purpose: they recover by themselves and the missed rule catches
// them if they do not.
export const ACCOUNT_REFUSAL = new RegExp([
  String.raw`HTTP 40[123]\b`,
  String.raw`\(4010\d\)`, // DataForSEO envelope codes 40100 to 40109
  String.raw`\(402\d\d\)`, // DataForSEO payment and account codes
  'not authori[sz]ed',
  'unauthori[sz]ed',
  'forbidden',
  'payment required',
  'insufficient funds',
  String.raw`invalid (api )?key`,
  String.raw`api key (is )?(invalid|missing|expired|revoked)`,
  String.raw`credentials? (are |is )?(not configured|invalid|rejected|missing)`,
].join('|'), 'i');

const shift = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const day = (ts) => (typeof ts === 'string' ? ts.slice(0, 10) : null);

/**
 * @param {object} args
 * @param {string} args.today YYYY-MM-DD
 * @param {Record<string, {missed?: string[]}>} args.inputs citability --json `inputs`
 * @param {Array<{source: string, status?: string, last_success?: string, last_checked?: string, metadata?: {last_error?: string, provider?: string}}>} args.health
 * @returns {Array<{source: string, rule: 'account'|'missed', detail: string, last_success: string|null, provider: string|null}>}
 */
export function findInputAlerts({ today, inputs, health }) {
  const yesterday = shift(today, -1);
  const bySource = Object.fromEntries((health || []).map((h) => [h.source, h]));
  const alerts = [];
  for (const [source, input] of Object.entries(inputs || {})) {
    const h = bySource[source];
    const lastError = h?.metadata?.last_error || null;
    const lastSuccess = day(h?.last_success);
    const provider = h?.metadata?.provider || null;
    const missed = new Set(input?.missed || []);
    const refusedToday = !!lastError && ACCOUNT_REFUSAL.test(lastError)
      && day(h.last_checked) === today && h.status !== 'healthy' && lastSuccess !== today;
    if (refusedToday) {
      alerts.push({ source, rule: 'account', detail: lastError, last_success: lastSuccess, provider });
    } else if (missed.has(today) && missed.has(yesterday)) {
      alerts.push({ source, rule: 'missed', detail: lastError || 'no row collected and no error recorded', last_success: lastSuccess, provider });
    }
  }
  return alerts;
}

/** Markdown for the issue: what failed, and what only Krish can do. */
export function alertBody({ today, alerts, runUrl }) {
  const account = alerts.filter((a) => a.rule === 'account');
  const missed = alerts.filter((a) => a.rule === 'missed');
  const row = (a) => `| \`${a.source}\` | ${a.provider ?? '–'} | ${a.last_success ?? 'never'} | ${a.detail.replace(/\|/g, '\\|').slice(0, 220)} |`;
  const table = (list) => ['| Input | Provider | Last success | Last error |', '|---|---|---|---|', ...list.map(row)];
  return [
    `${alerts.length} index input${alerts.length === 1 ? '' : 's'} need${alerts.length === 1 ? 's' : ''} attention on ${today}.`,
    '',
    ...(account.length ? [
      '### Refused by the provider: only Krish can fix this',
      'The provider rejected Pulse\'s account (login, key or billing). Nothing in this repository can repair it. Sign in to the provider, then update the matching secret in the Supabase project\'s Edge Function secrets. No redeploy is needed. Every day this lasts is a missed day for each input below, and the 10/10 streak cannot start until each is delivering on 27 of 30 days again.',
      '',
      ...table(account),
      '',
    ] : []),
    ...(missed.length ? [
      '### Missed today and yesterday',
      'No reading for two days in a row. Inputs that share a provider usually share a cause: look there first.',
      '',
      ...table(missed),
      '',
    ] : []),
    runUrl ? `Run: ${runUrl}` : '',
    'Rules: `scripts/input-watch-lib.mjs`. This issue is commented on each day the failure lasts and closes itself on the first day every input is back.',
  ].filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n').trim();
}
