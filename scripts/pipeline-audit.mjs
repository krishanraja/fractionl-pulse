// Deterministic, read-only weekly audit of the Pulse data pipeline.
//
// WHY THIS EXISTS
// ---------------
// The weekly audit used to be prose in docs/WEEKLY_PIPELINE_AUDIT.md that an
// agent re-derived from scratch each Monday. That failed in three ways we can
// demonstrate rather than assert:
//
//   1. Vocabulary drift. The runbook said "count the estimated days". The flag
//      actually written by scripts/simulate-supply-backfill.ts is
//      metadata.data_quality.supply = 'simulated_estimate'. Anything grepping
//      for "estimated" returns 0 and reports a clean bill of health while 38
//      days of simulated supply sit in the published history. This script never
//      looks for a remembered word: it enumerates whatever provenance values
//      exist and diffs them against a committed baseline.
//
//   2. Remembered facts going stale. The runbook hardcoded the alert sender as
//      alerts@fractionl.ai. Since 22af761 the deliverable path is
//      onboarding@resend.dev to the Resend account owner, so that Gmail search
//      can never find an alert and the audit would misreport the alert path.
//      Every threshold, key, address and source weight below is parsed out of
//      the code that actually runs, so the audit cannot disagree with reality.
//
//   3. Cost. Reconciling three source sets by hand is a dozen paginated
//      queries before any thinking happens. That work is mechanical, so it
//      belongs in code, leaving the twenty-minute human budget for judgement.
//
// The standing rule from the runbook — read the body, not the status code — is
// the organising principle here. Every check reads content: a 200 that carries
// no rows is a failure, and a source marked healthy that has not delivered in
// two cadences is a failure.
//
// This script writes nothing, anywhere. It only needs public-read (anon) access,
// so it is safe to run unattended in CI with no secrets.
//
// Run:  node scripts/pipeline-audit.mjs            (human report)
//       node scripts/pipeline-audit.mjs --json     (machine report)
//       node scripts/pipeline-audit.mjs --update-baseline
//
// Exit: 0 = GREEN, 1 = AMBER, 2 = RED, 3 = the audit itself could not run.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(ROOT, 'docs', 'audit-baseline.json');

const JSON_MODE = process.argv.includes('--json');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');
const TODAY = process.env.AUDIT_TODAY || new Date().toISOString().slice(0, 10);

// Provenance vocabulary, in three buckets. The distinction matters more than it
// looks: a day whose supply was never measured and is stored as null is honest,
// whereas a day carrying an invented number presented as a reading is not. Only
// FABRICATED counts toward the integrity number the runbook escalates on.
//
// Anything matching none of these is reported as UNRECOGNISED rather than
// silently ignored — that is how a vocabulary invented next quarter gets caught
// without this file being updated first.
const FABRICATED = /simulat|estimat|imput|synthetic|modell?ed/i;
const ABSENT = /unmeasur|placeholder|nulled|missing|excluded/i;
const MEASURED = /^measured$|=measured$/i;

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const day = (d) => new Date(d + 'T00:00:00Z');
const daysBetween = (a, b) => Math.round((day(b) - day(a)) / 86400000);
const shift = (d, n) => new Date(day(d).getTime() + n * 86400000).toISOString().slice(0, 10);

// ------------------------------------------------------------------
// 1. Configuration discovery — parsed from the code that actually runs
// ------------------------------------------------------------------

function parseWeights() {
  const src = read('supabase/functions/ingest-signals/index.ts');
  const block = src.match(/SOURCE_CONFIDENCE_WEIGHTS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('SOURCE_CONFIDENCE_WEIGHTS not found in ingest-signals/index.ts');
  const weights = {};
  for (const [, k, v] of block[1].matchAll(/^\s*([a-z0-9_]+)\s*:\s*([0-9.]+)/gim)) {
    weights[k] = Number(v);
  }
  if (!Object.keys(weights).length) throw new Error('SOURCE_CONFIDENCE_WEIGHTS parsed empty');
  return weights;
}

function parseThresholds() {
  const src = read('api/cron/daily-ingest.ts');
  const num = (name, fallback) => {
    const m = src.match(new RegExp(`${name}\\s*=\\s*Number\\([^']*'([0-9.]+)'`));
    return m ? Number(m[1]) : fallback;
  };
  return {
    completeness: num('COMPLETENESS_ALERT_THRESHOLD', 0.75),
    minHealthySources: num('MIN_HEALTHY_SOURCES', 14),
    // The aspirational target lives in the roadmap's §6 table, not in code.
    target: (() => {
      const m = read('docs/DATA_SOURCES_ROADMAP.md').match(/Data completeness\s*\|\s*>?\s*([0-9.]+)/i);
      return m ? Number(m[1]) : 0.85;
    })(),
  };
}

function parseSupabase() {
  const src = read('src/lib/supabase.ts');
  const url = src.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/);
  const key = src.match(/(eyJ[A-Za-z0-9._-]+)/);
  if (!url || !key) throw new Error('Could not read Supabase URL/anon key from src/lib/supabase.ts');
  return { url: process.env.SUPABASE_URL || url[1], key: process.env.SUPABASE_ANON_KEY || key[1] };
}

// The alert path's real sender and recipients, so the audit reports what to
// search for instead of what someone remembered a year ago.
function parseAlertConfig() {
  const src = read('supabase/functions/send-pipeline-alert/index.ts');
  // Declarations look like either
  //   const X = Deno.env.get('X') || 'a@b,c@d'
  //   const X = (Deno.env.get('X') || 'a@b,c@d').split(',')...
  // so the optional paren matters — without it the multi-line recipient lists
  // parse as empty and the audit wrongly reports that nobody is on the alert.
  const str = (name) => {
    const m = src.match(new RegExp(`${name}\\s*=\\s*\\(?\\s*(?:Deno\\.env\\.get\\('[^']+'\\)\\s*\\|\\|\\s*)?'([^']+)'`));
    return m ? m[1] : null;
  };
  const addr = (s) => (s ? (s.match(/<([^>]+)>/)?.[1] ?? s) : null);
  return {
    primaryFrom: addr(str('ALERT_FROM')),
    fallbackFrom: addr(str('FALLBACK_FROM')),
    primaryTo: (str('ALERT_EMAILS') || '').split(',').map((s) => s.trim()).filter(Boolean),
    fallbackTo: (str('FALLBACK_TO') || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

// Which credential gates which source, derived by reading each collector rather
// than from a maintained list — so a source added next week is grouped
// correctly without touching this file. This is what turns "five sources are
// down" into "one vendor account is down and it costs 24% of the index".
function parseVendorMap(weights) {
  const src = read('supabase/functions/ingest-signals/index.ts');
  const CRED = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:API_KEY|APP_KEY|APP_ID|CLIENT_ID|CLIENT_SECRET|KEY|TOKEN))\b/g;
  const blocks = src.split(/\n(?=(?:async\s+)?function\s)/);
  const map = {};
  for (const block of blocks) {
    const sources = [...block.matchAll(/source:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
    if (!sources.length) continue;
    const creds = [...new Set([...block.matchAll(CRED)].map((m) => m[1]))]
      .filter((c) => !c.startsWith('SUPABASE_'));
    for (const s of sources) {
      if (!(s in weights)) continue;
      map[s] = [...new Set([...(map[s] || []), ...creds])];
    }
  }
  // Sources with no discoverable credential are keyless/public APIs.
  for (const s of Object.keys(weights)) if (!map[s]) map[s] = [];
  return map;
}

// ------------------------------------------------------------------
// 2. Live reads (public-read tables + public API)
// ------------------------------------------------------------------

let SB;
async function rest(path) {
  const res = await fetch(`${SB.url}/rest/v1/${path}`, {
    headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}` },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function restAll(path) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const sep = path.includes('?') ? '&' : '?';
    const batch = await rest(`${path}${sep}limit=1000&offset=${offset}`);
    out.push(...batch);
    if (batch.length < 1000) return out;
  }
}

async function probe(url, init) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { apikey: SB.key, Authorization: `Bearer ${SB.key}`, ...(init?.headers || {}) },
      signal: AbortSignal.timeout(30000),
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, text: String(e.message || e) };
  }
}

// ------------------------------------------------------------------
// 3. The audit
// ------------------------------------------------------------------

async function audit() {
  const findings = [];
  // sev: 'red' forces RED, 'amber' forces at least AMBER, 'info' is reported only.
  const add = (sev, area, title, detail, fix) =>
    findings.push({ severity: sev, area, title, detail, ...(fix ? { fix } : {}) });

  const weights = parseWeights();
  const thresholds = parseThresholds();
  const alertCfg = parseAlertConfig();
  const vendors = parseVendorMap(weights);
  SB = parseSupabase();

  const intended = Object.keys(weights);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const pct = (w) => `${Math.round((w / totalWeight) * 1000) / 10}%`;

  // --- Ground truth reads -------------------------------------------------
  const since30 = shift(TODAY, -30);
  const since60 = shift(TODAY, -60);
  const [health, signals, scores] = await Promise.all([
    restAll('data_source_health?select=source,status,last_success,last_checked,error_count,metadata&order=source.asc'),
    restAll(`signals?select=source,date,created_at&date=gte.${since60}&order=date.asc`),
    restAll('fwi_scores?select=date,confidence,overall_score,supply_score,metadata&order=date.asc'),
  ]);

  if (!scores.length) {
    add('red', 'schedule', 'fwi_scores is empty', 'The index has no stored history at all.');
    return { verdict: 'RED', findings, summary: {} };
  }

  const monitored = health.map((h) => h.source);
  const recent = signals.filter((s) => s.date >= since30);
  const delivering = [...new Set(recent.map((s) => s.source))];
  const latestCreatedAt = recent.reduce((m, s) => (s.created_at > m ? s.created_at : m), '');

  // --- A. Source universe reconciliation ---------------------------------
  const intendedNotDelivering = intended.filter((s) => !delivering.includes(s));
  const deliveringNotIntended = delivering.filter((s) => !intended.includes(s));
  const orphanHealth = monitored.filter((s) => !intended.includes(s) && !delivering.includes(s));

  if (intendedNotDelivering.length) {
    const lost = intendedNotDelivering.reduce((sum, s) => sum + weights[s], 0);
    add(
      'amber',
      'reconciliation',
      `${intendedNotDelivering.length} intended source(s) delivered nothing in 30 days — ${pct(lost)} of the index`,
      intendedNotDelivering.map((s) => `${s} (weight ${weights[s]}, ${pct(weights[s])})`).join(', '),
      'Either restore the source or remove it from SOURCE_CONFIDENCE_WEIGHTS. Left in place it sits in the denominator and permanently drags completeness.',
    );
  }
  if (deliveringNotIntended.length) {
    add(
      'amber',
      'reconciliation',
      `${deliveringNotIntended.length} source(s) writing signals but absent from the weights`,
      `${deliveringNotIntended.join(', ')} — these rows are stored but contribute nothing to the composite.`,
      'Add a weight in ingest-signals/index.ts or stop writing the signal.',
    );
  }
  if (orphanHealth.length) {
    add(
      'info',
      'reconciliation',
      `${orphanHealth.length} stale health row(s)`,
      `${orphanHealth.join(', ')} — monitored but neither intended nor delivering.`,
      'Delete the rows so failed-source counts mean something.',
    );
  }

  // Doc drift. The roadmap's §2 table mirrors SOURCE_CONFIDENCE_WEIGHTS but
  // names sources in prose ("SerpAPI Jobs", "Hacker News"), so matching on the
  // snake_case key produces nothing but false positives. Compare the shape of
  // the table instead — row count and the multiset of weights — which catches a
  // source added, dropped or re-weighted in code without the doc following.
  const roadmap = read('docs/DATA_SOURCES_ROADMAP.md');
  const tableWeights = [...roadmap.matchAll(/^\|\s*([A-Za-z][^|]*?)\s*\|\s*(0\.[0-9]+)\s*\|/gm)]
    .map((m) => ({ name: m[1].trim(), weight: Number(m[2]) }));
  if (tableWeights.length) {
    const codeSorted = Object.values(weights).sort((a, b) => a - b).join(',');
    const docSorted = tableWeights.map((t) => t.weight).sort((a, b) => a - b).join(',');
    if (tableWeights.length !== intended.length || codeSorted !== docSorted) {
      const codeSum = totalWeight.toFixed(2);
      const docSum = tableWeights.reduce((a, b) => a + b.weight, 0).toFixed(2);
      add('amber', 'reconciliation', 'DATA_SOURCES_ROADMAP.md §2 no longer mirrors SOURCE_CONFIDENCE_WEIGHTS',
        `code: ${intended.length} sources summing to ${codeSum} · doc table: ${tableWeights.length} rows summing to ${docSum}.`,
        'Update the §2 table — it is the sales-facing statement of what the index measures.');
    }
  }
  const claimed = roadmap.match(/Live Source Inventory\s*\((\d+)\s*sources?\)/i);
  if (claimed && Number(claimed[1]) !== intended.length) {
    add('amber', 'reconciliation', 'Roadmap source count disagrees with the code',
      `DATA_SOURCES_ROADMAP.md §1 claims ${claimed[1]} sources; SOURCE_CONFIDENCE_WEIGHTS has ${intended.length}.`,
      'Correct the heading — it is a sales-facing claim.');
  }

  // --- B. Schedule adherence ---------------------------------------------
  const signalDates = new Set(recent.map((s) => s.date));
  const missingDays = [];
  for (let i = 0; i < 30; i++) {
    const d = shift(TODAY, -i);
    if (!signalDates.has(d)) missingDays.push(d);
  }
  if (missingDays.length) {
    add('red', 'schedule', `${missingDays.length} day(s) with no signals in the last 30`,
      missingDays.join(', '),
      'The scheduler failed quietly. Check the pg_cron job (supabase/migrations/008_daily_refresh_cron.sql) and the Vercel cron.');
  }

  const ageHours = latestCreatedAt
    ? Math.round((Date.now() - new Date(latestCreatedAt).getTime()) / 3600000)
    : Infinity;
  if (ageHours > 24) {
    add('red', 'schedule', `Newest signal is ${ageHours}h old`, `latest created_at = ${latestCreatedAt || 'none'}`,
      'The daily ingest has stopped writing.');
  }

  const scoreDates = new Set(scores.map((s) => s.date));
  if (!scoreDates.has(TODAY) && !scoreDates.has(shift(TODAY, -1))) {
    add('red', 'schedule', 'No fwi_scores row for today or yesterday',
      `latest = ${scores[scores.length - 1].date}`, 'calculate-fwi did not run or failed.');
  }

  // Gaps in published history.
  const sortedScoreDates = [...scoreDates].sort();
  const bigGaps = [];
  for (let i = 1; i < sortedScoreDates.length; i++) {
    const g = daysBetween(sortedScoreDates[i - 1], sortedScoreDates[i]);
    if (g > 7) bigGaps.push(`${sortedScoreDates[i - 1]} → ${sortedScoreDates[i]} (${g}d)`);
  }
  if (bigGaps.length) {
    add('amber', 'schedule', `${bigGaps.length} gap(s) longer than 7 days in fwi_scores`, bigGaps.join('; '));
  }

  // --- C. Per-source health and inferred cadence -------------------------
  // Cadence is inferred from each source's own history: a weekly source is not
  // late on day two, and a daily source is late on day three.
  const perSource = {};
  for (const s of [...new Set([...intended, ...delivering])]) {
    const dates = [...new Set(signals.filter((x) => x.source === s).map((x) => x.date))].sort();
    const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d)).sort((a, b) => a - b);
    const cadence = gaps.length ? Math.max(1, gaps[Math.floor(gaps.length / 2)]) : 1;
    const last = dates[dates.length - 1] || null;
    const staleDays = last ? daysBetween(last, TODAY) : null;
    const h = health.find((x) => x.source === s);
    perSource[s] = {
      weight: weights[s] ?? 0,
      cadenceDays: cadence,
      lastSignal: last,
      staleDays,
      status: h?.status ?? 'unmonitored',
      lastError: h?.metadata?.last_error ?? null,
      lastSuccess: h?.last_success ?? null,
      credentials: vendors[s] ?? [],
    };
  }

  const failed = Object.entries(perSource).filter(([, v]) => v.status === 'failed');
  for (const [s, v] of failed) {
    const sinceSuccess = v.lastSuccess ? daysBetween(v.lastSuccess.slice(0, 10), TODAY) : null;
    add('amber', 'source', `${s} failed (${pct(v.weight)} of the index)`,
      `last_error: ${v.lastError || 'unknown'} · last success ${v.lastSuccess?.slice(0, 10) || 'never'}${
        sinceSuccess !== null ? ` (${sinceSuccess}d ago)` : ''
      }`);
  }

  // Healthy-but-silent: the case a status column can never catch, because a
  // source that is skipped updates neither status nor last_success.
  const silent = Object.entries(perSource).filter(
    ([, v]) => v.status !== 'failed' && v.staleDays !== null && v.staleDays > 2 * v.cadenceDays,
  );
  for (const [s, v] of silent) {
    add('amber', 'source', `${s} is marked ${v.status} but has not delivered in ${v.staleDays}d`,
      `inferred cadence ${v.cadenceDays}d, so this is ${(v.staleDays / v.cadenceDays).toFixed(1)}× overdue · ${pct(v.weight)} of the index`);
  }

  // Rotting in the denominator: down long enough that it is now a permanent tax.
  const rotting = Object.entries(perSource).filter(
    ([s, v]) => intended.includes(s) && v.staleDays !== null && v.staleDays > 14,
  );
  const neverDelivered = intended.filter((s) => perSource[s].lastSignal === null);
  if (rotting.length || neverDelivered.length) {
    const cost = [...rotting.map(([s]) => s), ...neverDelivered].reduce((sum, s) => sum + weights[s], 0);
    add('amber', 'quality', `${rotting.length + neverDelivered.length} source(s) are a permanent completeness tax of ${pct(cost)}`,
      [...rotting.map(([s, v]) => `${s} (${v.staleDays}d silent)`), ...neverDelivered.map((s) => `${s} (never delivered)`)].join(', '),
      'Fix or retire. Every day these stay weighted, published completeness understates the index that is actually being measured.');
  }

  // --- D. Provider concentration -----------------------------------------
  const byCredential = {};
  for (const [s, v] of Object.entries(perSource)) {
    for (const c of v.credentials) (byCredential[c] ||= []).push(s);
  }
  const concentration = Object.entries(byCredential)
    .map(([cred, srcs]) => {
      const w = srcs.reduce((sum, s) => sum + (weights[s] ?? 0), 0);
      const down = srcs.filter((s) => perSource[s].status === 'failed' || (perSource[s].staleDays ?? 0) > 2 * perSource[s].cadenceDays);
      return { credential: cred, sources: srcs, weight: w, share: w / totalWeight, down };
    })
    .sort((a, b) => b.weight - a.weight);

  for (const c of concentration) {
    if (c.down.length >= 2 && c.down.length === c.sources.length) {
      add('amber', 'source', `Single root cause: every source on ${c.credential} is down`,
        `${c.down.join(', ')} — one credential, ${pct(c.weight)} of the index.`,
        `Treat as one incident: check the ${c.credential} account quota/plan/key rather than debugging ${c.down.length} sources.`);
    }
  }
  const topConcentration = concentration[0];
  if (topConcentration && topConcentration.share > 0.2) {
    add('info', 'commercial', `Vendor concentration: ${topConcentration.credential} controls ${pct(topConcentration.weight)} of the index`,
      `${topConcentration.sources.join(', ')}`,
      'One account suspension takes a fifth of the index with it. This is the structural risk behind most completeness drops.');
  }

  // --- E. Composite quality ----------------------------------------------
  const todayScore = scores.find((s) => s.date === TODAY) || scores[scores.length - 1];
  const confidence = todayScore.confidence;
  const sourcesToday = todayScore.metadata?.sources?.length ?? null;

  if (confidence < thresholds.completeness) {
    add('red', 'quality', `Completeness ${confidence} is below the alert threshold ${thresholds.completeness}`,
      `${sourcesToday ?? '?'} sources contributed on ${todayScore.date}.`);
  } else if (confidence < thresholds.target) {
    add('amber', 'quality', `Completeness ${confidence} is below the ${thresholds.target} target`,
      `${sourcesToday ?? '?'} sources contributed on ${todayScore.date}.`);
  }
  if (sourcesToday !== null && sourcesToday < thresholds.minHealthySources) {
    add('red', 'quality', `Only ${sourcesToday} healthy sources (minimum ${thresholds.minHealthySources})`,
      `Configured: ${intended.length}.`);
  }

  const last7 = scores.slice(-7).map((s) => s.confidence);
  const prev7 = scores.slice(-14, -7).map((s) => s.confidence);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const trend = { last7: mean(last7), prior7: mean(prev7) };
  if (trend.last7 !== null && trend.prior7 !== null && trend.prior7 - trend.last7 > 0.1) {
    add('amber', 'quality', `Completeness fell ${((trend.prior7 - trend.last7) * 100).toFixed(0)} points week over week`,
      `${trend.prior7.toFixed(2)} → ${trend.last7.toFixed(2)}. A sharp drop is usually one vendor account taking several sources with it.`);
  }

  // --- F. Provenance integrity: is the index still honest? ---------------
  // The check the whole routine exists for. Enumerate whatever provenance
  // vocabulary is actually present, rather than looking for a word we expect.
  // Which stored column each pillar is published from, so an "unmeasured"
  // claim can be checked against what is actually stored for that day.
  const PILLAR_COLUMN = { supply: 'supply_score', culture: 'momentum_score', demand: 'demand_score' };

  const provenance = {};
  const fabricatedDays = [];
  const absentDays = [];
  const unrecognised = {};
  const absentButStored = [];

  for (const row of scores) {
    const dq = row.metadata?.data_quality;
    if (!dq) { provenance['<no data_quality>'] = (provenance['<no data_quality>'] || 0) + 1; continue; }
    const tokens = Object.entries(dq).filter(([, v]) => typeof v === 'string');
    if (!tokens.length) provenance['<no string fields>'] = (provenance['<no string fields>'] || 0) + 1;

    let fabricated = false;
    let absent = false;
    for (const [k, v] of tokens) {
      const label = `${k}=${v}`;
      provenance[label] = (provenance[label] || 0) + 1;
      if (FABRICATED.test(v)) fabricated = true;
      else if (ABSENT.test(v)) absent = true;
      else if (!MEASURED.test(v)) unrecognised[label] = (unrecognised[label] || 0) + 1;

      // A pillar declared unmeasured must not also carry a published number.
      const col = PILLAR_COLUMN[k];
      if (col && ABSENT.test(v) && typeof row[col] === 'number') {
        absentButStored.push(`${row.date} ${k}=${v} but ${col}=${row[col]}`);
      }
    }
    if (fabricated) fabricatedDays.push(row.date);
    else if (absent) absentDays.push(row.date);
  }

  if (Object.keys(unrecognised).length) {
    add('amber', 'integrity', `${Object.keys(unrecognised).length} unrecognised provenance value(s)`,
      Object.entries(unrecognised).map(([k, v]) => `${k} (${v} days)`).join(', '),
      'The audit cannot tell whether these days are measured. Classify them in scripts/pipeline-audit.mjs, or correct the data.');
  }
  if (absentButStored.length) {
    add('red', 'integrity', `${absentButStored.length} day(s) declare a pillar unmeasured while publishing a number for it`,
      absentButStored.slice(0, 8).join('; ') + (absentButStored.length > 8 ? ` … +${absentButStored.length - 8} more` : ''),
      'Either the flag or the value is wrong. Until it is resolved the index is publishing a figure it says it did not measure.');
  }

  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : null;
  const baselineCount = baseline?.provenance?.fabricatedDayCount ?? null;
  if (baselineCount === null) {
    add('info', 'integrity', 'No committed baseline to compare against',
      `${fabricatedDays.length} estimated day(s) found.`,
      'Run `npm run audit:baseline` once, review the file, and commit it. Without it a backfill cannot be detected.');
  } else if (fabricatedDays.length > baselineCount) {
    add('red', 'integrity', `Estimated-day count rose from ${baselineCount} to ${fabricatedDays.length}`,
      `New estimated days: ${fabricatedDays.filter((d) => !(baseline.provenance.days || []).includes(d)).join(', ')}`,
      'Someone ran a backfill or an estimation script against published history. This is an incident: establish who, why, and whether it was published.');
  } else if (fabricatedDays.length < baselineCount) {
    add('info', 'integrity', `Estimated-day count fell from ${baselineCount} to ${fabricatedDays.length}`,
      'Days were recomputed from measured data or removed. Confirm this was intended, then refresh the baseline.');
  }

  // Now the surfacing check: pull a known non-measured day through every public
  // surface. Each one must say it is estimated. A number that is modelled and
  // presented as measured is the failure this product cannot survive.
  // A surface is only judged on days it actually carries. The feed and the MCP
  // tool publish the current reading, so they can only be judged when today is
  // itself estimated — reporting them as passing on a day they never showed
  // would be exactly the false assurance this audit exists to prevent.
  const probeDate = fabricatedDays[fabricatedDays.length - 1] || null;
  const anyDisclosure = (text) => FABRICATED.test(text) || /data_?quality|provenance/i.test(text);
  const surfaces = [];
  if (probeDate) {
    const monthsBack = Math.ceil(daysBetween(probeDate, TODAY) / 30) + 1;

    const hist = await probe(`${SB.url}/functions/v1/fwi-api/history?months=${monthsBack}`);
    let histPoint = null;
    try {
      histPoint = (JSON.parse(hist.text).history || []).find((p) => p.date === probeDate) ?? null;
    } catch { /* reported via carries:false */ }
    surfaces.push({
      surface: 'fwi-api /history',
      carries: !!histPoint,
      discloses: histPoint ? anyDisclosure(JSON.stringify(histPoint)) : null,
      sample: histPoint ? JSON.stringify(histPoint) : hist.text.slice(0, 120),
    });

    const todayEstimated = fabricatedDays.includes(TODAY);
    for (const [name, res] of [
      ['fwi-api /current', await probe(`${SB.url}/functions/v1/fwi-api/current`)],
      ['fwi-feed (RSS)', await probe(`${SB.url}/functions/v1/fwi-feed`)],
      ['mcp get_fractional_working_index', await probe(`${SB.url}/functions/v1/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'tools/call',
          params: { name: 'get_fractional_working_index', arguments: {} },
        }),
      })],
    ]) {
      const carries = res.text.includes(probeDate) || todayEstimated;
      surfaces.push({
        surface: name,
        carries,
        discloses: carries ? anyDisclosure(res.text) : null,
        sample: `HTTP ${res.status}, ${res.text.length} bytes`,
      });
    }

    const leaking = surfaces.filter((s) => s.carries && s.discloses === false);
    const unassessable = surfaces.filter((s) => !s.carries);
    if (leaking.length) {
      add('red', 'integrity',
        `${fabricatedDays.length} estimated day(s) are published as measured on ${leaking.length} public surface(s)`,
        `Probe day ${probeDate} carries no provenance marker on: ${leaking.map((s) => s.surface).join(', ')}. ` +
        `Estimated days are ${((fabricatedDays.length / scores.length) * 100).toFixed(0)}% of the published history ` +
        `(${fabricatedDays[0]} → ${fabricatedDays[fabricatedDays.length - 1]}).`,
        'Carry the data_quality flag into the API payload, the feed and the MCP tool, or withhold those days. Until then every consumer treats a simulated supply score as a market reading.');
    }
    if (unassessable.length) {
      add('info', 'integrity', `${unassessable.length} surface(s) could not be assessed for provenance`,
        `${unassessable.map((s) => s.surface).join(', ')} — these publish only the current reading, and today is not an estimated day. ` +
        'Their behaviour on an estimated day is unverified, not verified-good.');
    }
  }

  // --- G. Alert path ------------------------------------------------------
  const hadIncident = findings.some((f) => f.severity === 'red' && ['quality', 'schedule'].includes(f.area));
  const alertReachesAuditor = alertCfg.primaryTo.length > 0;
  if (hadIncident) {
    add('info', 'alerting', 'This week had an incident — verify an alert email actually exists',
      `Search both senders: from:${alertCfg.primaryFrom} OR from:${alertCfg.fallbackFrom}. ` +
      `Primary delivers to ${alertCfg.primaryTo.join(', ') || 'nobody'}; the fallback delivers only to ${alertCfg.fallbackTo.join(', ') || 'nobody'}.`,
      'An incident with no alert email means the alert path is broken, regardless of what the pipeline reports.');
  }
  if (alertCfg.fallbackTo.length && !alertCfg.fallbackTo.some((a) => alertCfg.primaryTo.includes(a))) {
    add('amber', 'alerting', 'Alert fallback delivers to an address that is not on the primary recipient list',
      `primary: ${alertCfg.primaryTo.join(', ') || 'none'} · fallback: ${alertCfg.fallbackTo.join(', ') || 'none'}. ` +
      'While the primary domain is unverified, every alert goes only to the fallback address.',
      'Verify the sending domain at resend.com/domains so alerts reach the primary list again.');
  }
  if (!alertReachesAuditor) {
    add('amber', 'alerting', 'No primary alert recipients configured', 'ALERT_EMAILS resolves to an empty list.');
  }

  // --- H. Public surface --------------------------------------------------
  const api = await probe(`${SB.url}/functions/v1/fwi-api/current`);
  let apiMeta = null;
  try { apiMeta = JSON.parse(api.text).meta; } catch { /* reported below */ }
  if (!api.ok || !apiMeta) {
    add('red', 'surface', `Public API is down (HTTP ${api.status})`, api.text.slice(0, 200));
  } else {
    if (apiMeta.asOf !== TODAY && apiMeta.asOf !== shift(TODAY, -1)) {
      add('red', 'surface', `Public API is serving stale data (asOf ${apiMeta.asOf})`, `today is ${TODAY}`);
    }
    if (typeof apiMeta.dataCompleteness === 'number' && Math.abs(apiMeta.dataCompleteness - confidence) > 0.01) {
      add('amber', 'surface', 'Public API completeness disagrees with the database',
        `API says ${apiMeta.dataCompleteness}, DB says ${confidence}.`);
    }
  }

  // Sitemap: every URL resolves and carries its own title.
  const sitemapPath = join(ROOT, 'public', 'sitemap.xml');
  const urls = existsSync(sitemapPath)
    ? [...readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    : [];
  const titles = new Map();
  const badUrls = [];
  for (const u of urls) {
    const r = await probe(u);
    if (!r.ok) { badUrls.push(`${u} (HTTP ${r.status})`); continue; }
    const t = r.text.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    titles.set(u, t);
  }
  if (badUrls.length) add('amber', 'surface', `${badUrls.length} sitemap URL(s) do not resolve`, badUrls.join(', '));
  const dupTitles = [...titles.entries()].reduce((acc, [u, t]) => { (acc[t] ||= []).push(u); return acc; }, {});
  const shared = Object.entries(dupTitles).filter(([, us]) => us.length > 1);
  if (shared.length) {
    add('amber', 'surface', 'Pages are sharing a title tag',
      shared.map(([t, us]) => `"${t.slice(0, 60)}" on ${us.length} pages`).join('; '),
      'Each page inheriting another page\'s title costs it its own search snippet.');
  }

  // The pre-rendered number must match live data, not a stale build.
  const home = [...titles.keys()].find((u) => new URL(u).pathname === '/');
  if (home) {
    const t = titles.get(home) || '';
    const baked = t.match(/([0-9]+\.[0-9])/)?.[1];
    if (baked && Math.abs(Number(baked) - todayScore.overall_score) > 0.05) {
      add('amber', 'surface', `Pre-rendered page shows ${baked} but the database says ${todayScore.overall_score}`,
        'The static build is stale.',
        'Check the pulse-daily-redeploy pg_cron job (supabase/migrations/009_redeploy_cron.sql).');
    }
  }

  // --- Verdict ------------------------------------------------------------
  const verdict = findings.some((f) => f.severity === 'red')
    ? 'RED'
    : findings.some((f) => f.severity === 'amber')
      ? 'AMBER'
      : 'GREEN';

  return {
    verdict,
    findings,
    summary: {
      date: TODAY,
      sourcesConfigured: intended.length,
      sourcesDelivering: delivering.length,
      sourcesFailed: failed.map(([s]) => s),
      sourcesSilent: silent.map(([s]) => s),
      signalRowsLast30d: recent.length,
      missingDays,
      completeness: confidence,
      completenessTrend: trend,
      thresholds,
      historyDepthDays: scores.length,
      fabricatedDayCount: fabricatedDays.length,
      fabricatedDays,
      absentDayCount: absentDays.length,
      unrecognisedProvenance: unrecognised,
      provenanceVocabulary: provenance,
      provenanceSurfaces: surfaces,
      concentration: concentration.slice(0, 3).map((c) => ({ credential: c.credential, share: c.share, sources: c.sources })),
      alertConfig: alertCfg,
      perSource,
    },
  };
}

// ------------------------------------------------------------------
// 4. Report
// ------------------------------------------------------------------

const EMOJI = { GREEN: '🟢', AMBER: '🟡', RED: '🔴' };

function report(result) {
  const { verdict, findings, summary: s } = result;
  const out = [];
  out.push(`${EMOJI[verdict]} ${verdict} — Pulse pipeline audit ${s.date}`);
  out.push('');
  // The five lines the runbook asks for.
  out.push(`Source coverage   ${s.sourcesDelivering}/${s.sourcesConfigured} delivering · completeness ${s.completeness} (threshold ${s.thresholds.completeness}, target ${s.thresholds.target})`);
  out.push(`Sources down      ${[...s.sourcesFailed, ...s.sourcesSilent].join(', ') || 'none'}`);
  out.push(`Rows written      ${s.signalRowsLast30d} signals/30d · ${s.missingDays.length} missing day(s) · history ${s.historyDepthDays} days`);
  out.push(`Estimated days    ${s.fabricatedDayCount} of ${s.historyDepthDays} carry an invented value · ${s.absentDayCount} are honestly unmeasured`);
  out.push(`Needs a decision  ${findings.filter((f) => f.severity !== 'info').length} item(s)`);
  out.push('');

  const order = { red: 0, amber: 1, info: 2 };
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
  if (!sorted.length) {
    out.push('No findings.');
  } else {
    out.push('FINDINGS');
    for (const f of sorted) {
      out.push(`  ${f.severity === 'red' ? '🔴' : f.severity === 'amber' ? '🟡' : '·'} [${f.area}] ${f.title}`);
      if (f.detail) out.push(`     ${f.detail}`);
      if (f.fix) out.push(`     fix: ${f.fix}`);
    }
  }

  if (s.provenanceSurfaces?.length) {
    out.push('');
    out.push('PROVENANCE THROUGH PUBLIC SURFACES');
    for (const p of s.provenanceSurfaces) {
      const mark = !p.carries ? '–' : p.discloses ? '✓' : '✗';
      const note = !p.carries ? ' (does not carry the probe day — unverified)' : p.discloses ? '' : '  ← publishes it as measured';
      out.push(`  ${mark} ${p.surface}${note}`);
    }
  }

  out.push('');
  out.push('PROVENANCE VOCABULARY IN fwi_scores');
  for (const [k, v] of Object.entries(s.provenanceVocabulary || {}).sort((a, b) => b[1] - a[1])) {
    out.push(`  ${String(v).padStart(4)}  ${k}`);
  }
  return out.join('\n');
}

// ------------------------------------------------------------------

try {
  const result = await audit();

  if (UPDATE_BASELINE) {
    const baseline = {
      updated: TODAY,
      note: 'Committed baseline for the weekly audit. fabricatedDayCount must never increase without a deliberate, recorded decision — an increase means an estimation or backfill script was run against published history, which the runbook treats as a same-day escalation.',
      provenance: {
        fabricatedDayCount: result.summary.fabricatedDayCount,
        days: result.summary.fabricatedDays,
        absentDayCount: result.summary.absentDayCount,
        vocabulary: result.summary.provenanceVocabulary,
      },
      sources: {
        configured: result.summary.sourcesConfigured,
        delivering: result.summary.sourcesDelivering,
      },
      completeness: result.summary.completeness,
      historyDepthDays: result.summary.historyDepthDays,
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`Baseline written to docs/audit-baseline.json (${baseline.provenance.fabricatedDayCount} estimated days).`);
    process.exit(0);
  }

  console.log(JSON_MODE ? JSON.stringify(result, null, 2) : report(result));
  process.exit(result.verdict === 'RED' ? 2 : result.verdict === 'AMBER' ? 1 : 0);
} catch (err) {
  console.error(`Audit could not run: ${err.message}`);
  console.error('This is itself a finding — the audit cannot confirm the pipeline is healthy.');
  process.exit(3);
}
