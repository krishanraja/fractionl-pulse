// Controls for the input watch, built from the 2026-11-13 DataForSEO outage.
// Run with `npm run test:watch`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCOUNT_REFUSAL, alertBody, findInputAlerts } from './input-watch-lib.mjs';

const TODAY = '2026-11-13';
const healthy = (source) => ({ source, status: 'healthy', last_success: `${TODAY}T06:01:04Z`, last_checked: `${TODAY}T06:01:04Z`, metadata: { last_error: null } });
const failed = (source, last_error, extra = {}) => ({ source, status: 'failed', last_success: '2026-11-12T06:00:49Z', last_checked: `${TODAY}T06:01:04Z`, metadata: { last_error, ...extra } });
const LOGIN_401 = 'DataForSEO HTTP 401: You are not authorized to access this resource. See your login details here: https://app.dataforseo.com/api-access .';

test('a provider refusing the login alerts on the first day', () => {
  const alerts = findInputAlerts({
    today: TODAY,
    inputs: { serpapi_linkedin: { missed: [TODAY] }, adzuna: { missed: [] } },
    health: [failed('serpapi_linkedin', LOGIN_401, { provider: 'dataforseo' }), healthy('adzuna')],
  });
  assert.deepEqual(alerts.map((a) => [a.source, a.rule, a.provider]), [['serpapi_linkedin', 'account', 'dataforseo']]);
});

test('a single ordinary miss is noise, two in a row is an incident', () => {
  const health = [failed('serpapi_jobs', 'No prepared DataForSEO Jobs tasks for 2026-11-13')];
  assert.deepEqual(findInputAlerts({ today: TODAY, inputs: { serpapi_jobs: { missed: [TODAY] } }, health }), []);
  const two = findInputAlerts({ today: TODAY, inputs: { serpapi_jobs: { missed: ['2026-11-12', TODAY] } }, health });
  assert.deepEqual(two.map((a) => a.rule), ['missed']);
});

test('misses that are not consecutive and current do not alert', () => {
  const inputs = { newsapi: { missed: ['2026-11-01', '2026-11-02', '2026-11-11'] } };
  assert.deepEqual(findInputAlerts({ today: TODAY, inputs, health: [healthy('newsapi')] }), []);
});

test('a stale refusal does not alert once the input has recovered', () => {
  const recovered = { ...failed('serpapi_linkedin', LOGIN_401), status: 'healthy', last_success: `${TODAY}T06:01:04Z` };
  assert.deepEqual(findInputAlerts({ today: TODAY, inputs: { serpapi_linkedin: { missed: [] } }, health: [recovered] }), []);
  const old = { ...failed('serpapi_linkedin', LOGIN_401), last_checked: '2026-11-10T06:00:00Z' };
  assert.deepEqual(findInputAlerts({ today: TODAY, inputs: { serpapi_linkedin: { missed: [] } }, health: [old] }), []);
});

test('a missing health row still lets the missed rule fire', () => {
  const alerts = findInputAlerts({ today: TODAY, inputs: { trial_trends: { missed: ['2026-11-12', TODAY] } }, health: [] });
  assert.deepEqual(alerts.map((a) => [a.rule, a.detail]), [['missed', 'no row collected and no error recorded']]);
});

test('the refusal pattern separates account failures from transient ones', () => {
  for (const e of [LOGIN_401, 'DataForSEO request failed (40100): You are not authorized', 'DataForSEO HTTP 402: Payment Required',
    'DataForSEO task failed (40210): insufficient funds', 'HTTP 403 Forbidden', 'Invalid API key', 'DataForSEO credentials are not configured']) {
    assert.ok(ACCOUNT_REFUSAL.test(e), e);
  }
  for (const e of ['HTTP 429 Too Many Requests', 'HTTP 503 Service Unavailable', 'no Trends reading collected today',
    'No prepared DataForSEO Jobs tasks for 2026-11-13', 'zero works across all phrases', '403 results returned']) {
    assert.ok(!ACCOUNT_REFUSAL.test(e), e);
  }
});

test('the issue body says what only Krish can do and escapes table pipes', () => {
  const body = alertBody({ today: TODAY, alerts: [
    { source: 'serpapi_linkedin', rule: 'account', detail: LOGIN_401, last_success: '2026-11-12', provider: 'dataforseo' },
    { source: 'trial_trends', rule: 'missed', detail: 'a | b', last_success: '2026-11-12', provider: null },
  ] });
  assert.match(body, /only Krish can fix this/);
  assert.match(body, /Missed today and yesterday/);
  assert.match(body, /a \\\| b/);
  assert.doesNotMatch(body, /—/, 'no em dashes');
});
