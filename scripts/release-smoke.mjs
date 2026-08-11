import assert from 'node:assert/strict';

const FUNCTIONS = 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1';
const SITE = process.env.PULSE_URL || 'https://pulse.fractionl.ai';
const SKIP_SITE = process.env.SKIP_SITE === '1' || process.argv.includes('--skip-site');
const results = [];

async function check(name, run) {
  const started = Date.now();
  try {
    await run();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`PASS ${name} (${Date.now() - started}ms)`);
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function json(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }
  return { response, text, body };
}

await check('public current index contract', async () => {
  const { response, body } = await json(`${FUNCTIONS}/fwi-api/current`);
  assert.equal(response.status, 200);
  assert.equal(typeof body?.score?.overall, 'number');
  assert.equal(response.headers.get('x-fwi-score'), String(body.score.overall));
  assert.ok(body.meta.dataCompleteness >= 0 && body.meta.dataCompleteness <= 1);
  assert.ok(Object.hasOwn(body.score, 'delta30dComparedWith'));
  assert.match(body.meta.dataCompletenessNote, /not all statistically independent/i);
  assert.match(body.signals.demand.leadingIndicator, /not been validated/i);
});

await check('mixed-frequency history exposes provenance', async () => {
  const { response, body } = await json(`${FUNCTIONS}/fwi-api/history?months=12`);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body?.history) && body.history.length > 0);
  assert.ok(body.history.every((row) => Object.hasOwn(row, 'dataQuality')));
});

await check('six-role demand contract', async () => {
  const { response, body, text } = await json(`${FUNCTIONS}/fwi-roles`);
  assert.equal(response.status, 200);
  assert.equal(body?.roles?.length, 6);
  assert.equal(body.rolesMeasured <= 6, true);
  assert.doesNotMatch(text, /predicts fractional demand|leading indicator of demand/i);
  assert.match(body.note, /not been validated/i);
});

await check('brief count and methodology contract', async () => {
  const { response, body, text } = await json(`${FUNCTIONS}/export-brief?format=json`);
  assert.equal(response.status, 200);
  assert.equal(body?.tracked_inputs, 21);
  assert.ok(body.sources_healthy >= 0 && body.sources_healthy <= body.tracked_inputs);
  assert.doesNotMatch(text, /People Data Labs|NY Times|\bPDL\b|\bNYT\b/i);
});

await check('public FWI feed', async () => {
  const { response, body } = await json(`${FUNCTIONS}/fwi-feed?format=json`);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body?.items) && body.items.length > 0);
});

await check('pipeline trigger rejects anonymous callers', async () => {
  const { response } = await json(`${FUNCTIONS}/fwi-api/trigger`, { method: 'POST' });
  assert.equal(response.status, 401);
});

await check('insight generator rejects anonymous callers', async () => {
  const response = await fetch(`${FUNCTIONS}/generate-pulse-insights`, { method: 'POST', signal: AbortSignal.timeout(30000) });
  assert.ok([401, 403].includes(response.status));
});

await check('MCP descriptor and four tools', async () => {
  const { response, body } = await json(`${FUNCTIONS}/mcp`);
  assert.equal(response.status, 200);
  assert.equal(body.protocolVersion, '2026-07-28');
  assert.deepEqual(body.tools, ['get_fractional_working_index', 'get_fwi_weekly_brief', 'get_content_radar', 'get_content_brief']);
});

await check('MCP legacy initialize', async () => {
  const { response, body } = await json(`${FUNCTIONS}/mcp`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'pulse-release-smoke', version: '1' } } }),
  });
  assert.equal(response.status, 200);
  assert.equal(body?.result?.protocolVersion, '2024-11-05');
});

await check('MCP current discovery', async () => {
  const { response, body } = await json(`${FUNCTIONS}/mcp`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'server/discover' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'server/discover', params: {} }),
  });
  assert.equal(response.status, 200);
  assert.equal(body?.result?.resultType, 'complete');
  assert.ok(body.result.supportedVersions.includes('2026-07-28'));
});

await check('MCP current tool call', async () => {
  const { response, body } = await json(`${FUNCTIONS}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/call', 'mcp-name': 'get_fractional_working_index' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_fractional_working_index', arguments: {} } }),
  });
  assert.equal(response.status, 200);
  assert.equal(body?.result?.resultType, 'complete');
  assert.equal(body.result.isError, undefined);
  assert.match(body.result.content?.[0]?.text || '', /Fractional Working Index/);
});

await check('MCP input validation stays inside tool result', async () => {
  const { response, body } = await json(`${FUNCTIONS}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/call', 'mcp-name': 'get_fractional_working_index' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_fractional_working_index', arguments: { months: 13 } } }),
  });
  assert.equal(response.status, 200);
  assert.equal(body?.result?.isError, true);
});

await check('MCP rejects routing mismatch and browser origin abuse', async () => {
  const mismatch = await fetch(`${FUNCTIONS}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/list-wrong' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} }),
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(mismatch.status, 400);
  const forbidden = await fetch(`${FUNCTIONS}/mcp`, { headers: { origin: 'https://attacker.invalid' }, signal: AbortSignal.timeout(30000) });
  assert.equal(forbidden.status, 403);
});

await check('Ask Pulse origin and validation boundaries', async () => {
  const allowed = await fetch(`${FUNCTIONS}/fwi-verdict`, { method: 'OPTIONS', headers: { origin: SITE }, signal: AbortSignal.timeout(30000) });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), SITE);
  const missing = await fetch(`${FUNCTIONS}/fwi-verdict`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000) });
  assert.equal(missing.status, 403);
  const forbidden = await fetch(`${FUNCTIONS}/fwi-verdict`, { method: 'POST', headers: { origin: 'https://attacker.invalid', 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000) });
  assert.equal(forbidden.status, 403);
  const invalid = await fetch(`${FUNCTIONS}/fwi-verdict`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json' }, body: '{', signal: AbortSignal.timeout(30000) });
  assert.equal(invalid.status, 400);
});

await check('Ask Pulse streams an evidence-bounded answer', async () => {
  let last = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch(`${FUNCTIONS}/fwi-verdict`, {
      method: 'POST',
      headers: { origin: SITE, 'content-type': 'application/json' },
      body: JSON.stringify({ situation: 'Fractional CMO in the US. What market evidence should inform a rate review?' }),
      signal: AbortSignal.timeout(45000),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type')?.startsWith('text/event-stream'), true);
    assert.equal(response.headers.get('x-ratelimit-limit'), '12');
    const raw = await response.text();
    last = raw.split('\n').filter((line) => line.startsWith('data: ')).map((line) => {
      const value = line.slice(6);
      if (value === '[DONE]') return '';
      try { return JSON.parse(value); } catch { return ''; }
    }).join('');
    if (/FACT:/i.test(last) && /INTERPRETATION:/i.test(last) && /ACTION:/i.test(last)) break;
  }
  assert.match(last, /FACT:/i);
  assert.match(last, /INTERPRETATION:/i);
  assert.match(last, /ACTION:/i);
  assert.doesNotMatch(last, /real-time|backtested|predictive accuracy/i);
});

if (!SKIP_SITE) {
  await check('public site routes and discovery files', async () => {
    for (const path of ['/', '/login', '/pricing', '/fractional-cmo', '/product-truth.json', '/llms.txt', '/.well-known/ai-plugin.json', '/sitemap.xml']) {
      const response = await fetch(`${SITE}${path}`, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, `${path} returned ${response.status}`);
    }
  });

  await check('site metadata and static role truth', async () => {
    const home = await (await fetch(`${SITE}/`, { signal: AbortSignal.timeout(30000) })).text();
    assert.match(home, /Fractional Working Index/i);
    assert.doesNotMatch(home, /fractionl\.com|21 independent/i);
    const role = await (await fetch(`${SITE}/fractional-cmo`, { signal: AbortSignal.timeout(30000) })).text();
    assert.match(role, /sources may overlap|not described as independent/i);
    assert.doesNotMatch(role, /Pro at \$39|fractionl\.com|rising weeks are when outreach lands/i);
    const truth = await (await fetch(`${SITE}/product-truth.json`, { signal: AbortSignal.timeout(30000) })).text();
    assert.doesNotMatch(truth, /UK-secondary|United Kingdom secondary/i);
  });
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} release smoke checks passed for ${SITE}`);
if (failed.length) process.exit(1);
