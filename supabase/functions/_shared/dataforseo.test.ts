import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DataForSeoError,
  dataForSeoPost,
  parseGoogleJobs,
  parseOrganicCount,
  parsePeopleAlsoAsk,
  parseRelatedQueries,
  parseTrendsSeries,
  requireTaskResult,
  validateDataForSeoEnvelope,
} from './dataforseo.ts';

test('parses valid Trends, related-query, organic, PAA, and Jobs fixtures', () => {
  const graphTask = {
    status_code: 20000,
    result: [{ items: [{ type: 'google_trends_graph', data: [{ values: [25, 50] }, { values: [30, 60] }] }] }],
  };
  assert.deepEqual(parseTrendsSeries(graphTask), [[25, 50], [30, 60]]);

  const relatedTask = {
    status_code: 20000,
    result: [{ items: [{
      type: 'google_trends_queries_list',
      data: {
        top: [{ query: 'fractional cfo cost', value: 80 }],
        rising: [{ query: 'fractional ai officer', value: 120 }],
      },
    }] }],
  };
  assert.deepEqual(parseRelatedQueries(relatedTask), [
    { query: 'fractional cfo cost', value: 80 },
    { query: 'fractional ai officer', value: 120 },
  ]);

  const organicTask = {
    status_code: 20000,
    result: [{
      se_results_count: 321,
      items: [{ type: 'people_also_ask', items: [{ title: 'What does a fractional CFO cost?', url: 'https://example.com' }] }],
    }],
  };
  assert.equal(parseOrganicCount(organicTask), 321);
  assert.deepEqual(parsePeopleAlsoAsk(organicTask), [{ question: 'What does a fractional CFO cost?', url: 'https://example.com' }]);

  const jobsTask = { status_code: 20000, result: [{ items: [{ type: 'google_jobs', title: 'Fractional CFO' }] }] };
  assert.equal(parseGoogleJobs(jobsTask).length, 1);
});

test('accepts valid empty results without inventing data', () => {
  const emptyTask = { status_code: 20000, result: [{ items: [], se_results_count: 0 }] };
  assert.deepEqual(parseTrendsSeries(emptyTask), []);
  assert.deepEqual(parseRelatedQueries(emptyTask), []);
  assert.deepEqual(parsePeopleAlsoAsk(emptyTask), []);
  assert.deepEqual(parseGoogleJobs(emptyTask), []);
  assert.equal(parseOrganicCount(emptyTask), 0);
});

test('rejects missing tasks', () => {
  assert.throws(
    () => validateDataForSeoEnvelope({ status_code: 20000, tasks: [] }),
    /did not contain any tasks/,
  );
});

test('rejects delayed or missing task results', () => {
  assert.throws(
    () => requireTaskResult({ status_code: 20000, result: null }),
    /missing or delayed/,
  );
});

test('does not retry a rate-limited paid POST', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ status_code: 40203, status_message: 'Rate limit exceeded', tasks: [] }), { status: 429 });
  };
  await assert.rejects(
    dataForSeoPost('/serp/google/organic/live/advanced', [{ keyword: 'fractional CFO' }],
      { login: 'login', password: 'password' }, { fetchImpl }),
    (error: unknown) => error instanceof DataForSeoError && error.httpStatus === 429,
  );
  assert.equal(calls, 1);
});

test('rejects HTTP 200 when a task has an error status', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    status_code: 20000,
    status_message: 'Ok.',
    tasks_error: 1,
    tasks: [{ status_code: 40501, status_message: 'Invalid Field', result: null }],
  }), { status: 200 });
  await assert.rejects(
    dataForSeoPost('/keywords_data/google_trends/explore/live', [{ keywords: ['fractional CFO'] }],
      { login: 'login', password: 'password' }, { fetchImpl }),
    /DataForSEO task failed \(40501\)/,
  );
});
