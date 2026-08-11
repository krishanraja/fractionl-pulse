// Hosted Pulse MCP server (Streamable HTTP transport, JSON-RPC 2.0).
//
// Promotes the doc-only MCP definitions into a real hosted endpoint any MCP host
// can attach by URL in one paste, no auth. It wraps the public no-auth FWI API,
// so it carries no secrets and inherits the same truth-discipline. Four tools:
//   - get_fractional_working_index: current score, or up to 12 months of history
//   - get_fwi_weekly_brief: the Markdown (or JSON) weekly brief
//   - get_content_radar: current structured content radar
//   - get_content_brief: current Markdown (or JSON) content brief
//
// Endpoint: POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp
// Deployed with verify_jwt=false (see supabase/config.toml).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ALLOWED_BROWSER_ORIGINS = new Set([
  'https://pulse.fractionl.ai',
  'http://localhost:5173',
  'http://localhost:8080',
]);
const PROTOCOL_VERSION = '2026-07-28';
const SUPPORTED_PROTOCOL_VERSIONS = [
  PROTOCOL_VERSION,
  '2025-11-25',
  '2025-06-18',
  '2024-11-05',
] as const;

function corsHeaders(origin: string | null) {
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-method, mcp-name',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Mcp-Protocol-Version': PROTOCOL_VERSION,
    'Vary': 'Origin, Mcp-Protocol-Version',
  };
}

const FUNCTIONS_BASE = 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1';
const SERVER_INFO = { name: 'fwi-pulse', version: '1.0.0' };

const TOOLS = [
  {
    name: 'get_fractional_working_index',
    description:
      'Get the Fractional Working Index (FWI), the 0-100 composite market-health instrument for the fractional executive market (fractional CFO, CMO, CTO, COO, CRO, interim CEO). With no argument or months<=1 returns the current reading; with months 2-12 returns observed score rows for the requested period. Truth-discipline: refreshed daily and interpreted weekly, not real-time, not backtested, 12 months of mixed-frequency history, US primary, published by Fractionl.',
    inputSchema: {
      type: 'object',
      properties: {
        months: { type: 'integer', minimum: 1, maximum: 12, description: 'Months of observed score history (1 = current only). Default 1.' },
      },
    },
  },
  {
    name: 'get_fwi_weekly_brief',
    description:
      'Get the Fractional Working Index weekly market brief: headline, component breakdown, top movers, methodology, and a citation block. Returns Markdown by default (ready to cite or repost) or JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Default markdown.' },
      },
    },
  },
  {
    name: 'get_content_radar',
    description:
      'Get the Fractional Content Radar: this week\'s RISING topics, breakout QUESTIONS, and ready-to-write content ANGLES for the fractional executive audience, with the source receipts that triggered each topic. This is what to publish about this week. Truth-discipline: surfaces relative weekly movement (not absolute search volume); first meaningful velocity from week 2; derived from a multi-source blend (DataForSEO rising queries and People Also Ask, news, Reddit, Hacker News, podcasts, job postings).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_content_brief',
    description:
      'Get the weekly Fractional Content Radar brief: ranked rising topics with scores, breakout questions, priority angles with suggested format and rationale, and a "skip these (saturated)" list. Returns Markdown by default (ready to paste into a content plan) or JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Default markdown.' },
      },
    },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}
function textContent(text: string, isError = false) {
  return { resultType: 'complete', content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}

function requestName(method: string | undefined, params: Record<string, unknown> | undefined): string | null {
  if (method === 'tools/call') return String(params?.name || '');
  if (method === 'resources/read') return String(params?.uri || '');
  if (method === 'prompts/get') return String(params?.name || '');
  return null;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'get_fractional_working_index') {
    const rawMonths = args?.months;
    if (rawMonths != null && (typeof rawMonths !== 'number' || !Number.isInteger(rawMonths) || rawMonths < 1 || rawMonths > 12)) {
      return textContent('Invalid months: expected an integer from 1 to 12.', true);
    }
    const months = rawMonths == null ? 1 : Number(rawMonths);
    const url = months <= 1 ? `${FUNCTIONS_BASE}/fwi-api/current` : `${FUNCTIONS_BASE}/fwi-api/history?months=${months}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    return textContent(body, !res.ok);
  }
  if (name === 'get_fwi_weekly_brief') {
    if (args?.format != null && args.format !== 'json' && args.format !== 'markdown') {
      return textContent('Invalid format: expected "markdown" or "json".', true);
    }
    const format = args?.format === 'json' ? 'json' : 'markdown';
    const res = await fetch(`${FUNCTIONS_BASE}/export-brief?format=${format}`, { signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    return textContent(body, !res.ok);
  }
  if (name === 'get_content_radar') {
    const res = await fetch(`${FUNCTIONS_BASE}/content-api/radar`, { signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    return textContent(body, !res.ok);
  }
  if (name === 'get_content_brief') {
    if (args?.format != null && args.format !== 'json' && args.format !== 'markdown') {
      return textContent('Invalid format: expected "markdown" or "json".', true);
    }
    const format = args?.format === 'json' ? 'json' : 'markdown';
    const res = await fetch(`${FUNCTIONS_BASE}/content-api/brief?format=${format}`, { signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    return textContent(body, !res.ok);
  }
  throw new Error(`Unknown tool: ${name}`);
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_BROWSER_ORIGINS.has(origin)) {
    return json(rpcError(null, -32000, 'Forbidden origin'), 403, null);
  }
  const cors = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // A bare GET returns a small descriptor so the endpoint is self-explaining.
  if (req.method === 'GET') {
    return json({
      server: SERVER_INFO,
      transport: 'streamable-http (JSON-RPC 2.0 over POST)',
      protocolVersion: PROTOCOL_VERSION,
      tools: TOOLS.map((t) => t.name),
      supportedVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
      usage: 'POST JSON-RPC 2.0 here. Current methods: server/discover, tools/list, tools/call. Legacy initialize is also supported.',
    }, 200, origin);
  }

  if (req.method !== 'POST') return json(rpcError(null, -32600, 'Method not allowed'), 405, origin);

  let msg: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    msg = await req.json();
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400, origin);
  }

  const { id, method, params } = msg;
  if (msg.jsonrpc !== '2.0' || !method) {
    return json(rpcError(id ?? null, -32600, 'Invalid JSON-RPC request'), 400, origin);
  }

  const protocolHeader = req.headers.get('mcp-protocol-version');
  if (protocolHeader && !SUPPORTED_PROTOCOL_VERSIONS.includes(protocolHeader as typeof SUPPORTED_PROTOCOL_VERSIONS[number])) {
    return json(rpcError(id, -32000, `Unsupported protocol version: ${protocolHeader}`), 400, origin);
  }

  // MCP 2026-07-28 mirrors body routing fields into headers. Validate them at
  // the application boundary so a gateway and the function cannot disagree.
  if (protocolHeader === PROTOCOL_VERSION) {
    const methodHeader = req.headers.get('mcp-method');
    if (!methodHeader || methodHeader !== method) {
      return json(rpcError(id, -32001, 'Missing or mismatched Mcp-Method header'), 400, origin);
    }
    const expectedName = requestName(method, params);
    const nameHeader = req.headers.get('mcp-name');
    if (expectedName !== null && (!nameHeader || nameHeader !== expectedName)) {
      return json(rpcError(id, -32001, 'Missing or mismatched Mcp-Name header'), 400, origin);
    }
  }

  // Notifications (no id) get a 202 with no body.
  if (method === 'notifications/initialized' || (method?.startsWith('notifications/'))) {
    return new Response(null, { status: 202, headers: cors });
  }

  try {
    if (method === 'initialize') {
      const requested = params?.protocolVersion as string | undefined;
      const negotiated = requested && requested !== PROTOCOL_VERSION
        && SUPPORTED_PROTOCOL_VERSIONS.includes(requested as typeof SUPPORTED_PROTOCOL_VERSIONS[number])
        ? requested
        : '2025-11-25';
      return json(rpcResult(id, {
        protocolVersion: negotiated,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: 'Pulse publishes the Fractional Working Index (FWI) and the Fractional Content Radar. Use get_fractional_working_index for the market-health score/history and get_fwi_weekly_brief for the cite-ready market brief. Use get_content_radar / get_content_brief for this week\'s rising content topics, breakout questions, and ready-to-write angles for fractional-exec content planning. Never claim real-time data, backtesting, years of history, or a predictive accuracy percentage.',
      }), 200, origin);
    }
    if (method === 'server/discover') {
      return json(rpcResult(id, {
        resultType: 'complete',
        supportedVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: 'Pulse exposes public, read-only fractional-leadership market context. Treat role movers as current comparisons versus the role average, not time-series growth.',
        ttlMs: 3600000,
        cacheScope: 'public',
      }), 200, origin);
    }
    if (method === 'ping') return json(rpcResult(id, {}), 200, origin);
    if (method === 'tools/list') return json(rpcResult(id, {
      resultType: 'complete',
      tools: TOOLS,
      ttlMs: 3600000,
      cacheScope: 'public',
    }), 200, origin);
    if (method === 'tools/call') {
      const name = String(params?.name || '');
      const args = (params?.arguments as Record<string, unknown>) || {};
      const result = await callTool(name, args);
      return json(rpcResult(id, result), 200, origin);
    }
    return json(rpcError(id, -32601, `Method not found: ${method}`), 200, origin);
  } catch (err) {
    return json(rpcError(id, -32603, `Internal error: ${String(err).slice(0, 300)}`), 500, origin);
  }
});
