// Hosted Pulse MCP server (Streamable HTTP transport, JSON-RPC 2.0).
//
// Promotes the doc-only MCP definitions into a real hosted endpoint any MCP host
// can attach by URL in one paste, no auth. It wraps the public no-auth FWI API,
// so it carries no secrets and inherits the same truth-discipline. Two tools:
//   - get_fractional_working_index: current score, or up to 12 months of history
//   - get_fwi_weekly_brief: the Markdown (or JSON) weekly brief
//
// Endpoint: POST https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/mcp
// Deployed with verify_jwt=false (see supabase/config.toml).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const FUNCTIONS_BASE = 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1';
const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'fwi-pulse', version: '1.0.0' };

const TOOLS = [
  {
    name: 'get_fractional_working_index',
    description:
      'Get the Fractional Working Index (FWI), the weekly 0-100 composite market-health score for the fractional executive market (fractional CFO, CMO, CTO, COO, CRO, interim CEO). With no argument or months<=1 returns the current reading; with months 2-12 returns weekly history. Truth-discipline: this is a weekly index (daily ingest, weekly settle), not real-time data, not backtested, ~12 weeks of history and accumulating, US primary, published by Fractionl.',
    inputSchema: {
      type: 'object',
      properties: {
        months: { type: 'integer', minimum: 1, maximum: 12, description: 'Months of weekly history (1 = current only). Default 1.' },
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
];

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function textContent(text: string) {
  return { content: [{ type: 'text', text }] };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'get_fractional_working_index') {
    const months = Math.max(1, Math.min(12, Number(args?.months) || 1));
    const url = months <= 1 ? `${FUNCTIONS_BASE}/fwi-api/current` : `${FUNCTIONS_BASE}/fwi-api/history?months=${months}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    return textContent(body);
  }
  if (name === 'get_fwi_weekly_brief') {
    const format = args?.format === 'json' ? 'json' : 'markdown';
    const res = await fetch(`${FUNCTIONS_BASE}/export-brief?format=${format}`, { signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    return textContent(body);
  }
  throw new Error(`Unknown tool: ${name}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // A bare GET returns a small descriptor so the endpoint is self-explaining.
  if (req.method === 'GET') {
    return json({
      server: SERVER_INFO,
      transport: 'streamable-http (JSON-RPC 2.0 over POST)',
      protocolVersion: PROTOCOL_VERSION,
      tools: TOOLS.map((t) => t.name),
      usage: 'POST JSON-RPC 2.0 here. Methods: initialize, tools/list, tools/call.',
    });
  }

  if (req.method !== 'POST') return json(rpcError(null, -32600, 'Method not allowed'), 405);

  let msg: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    msg = await req.json();
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400);
  }

  const { id, method, params } = msg;

  // Notifications (no id) get a 202 with no body.
  if (method === 'notifications/initialized' || (method?.startsWith('notifications/'))) {
    return new Response(null, { status: 202, headers: corsHeaders });
  }

  try {
    if (method === 'initialize') {
      return json(rpcResult(id, {
        protocolVersion: (params?.protocolVersion as string) || PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: 'Pulse publishes the Fractional Working Index (FWI). Use get_fractional_working_index for the score/history and get_fwi_weekly_brief for the cite-ready brief. Never claim real-time data, backtesting, years of history, or a predictive accuracy percentage.',
      }));
    }
    if (method === 'ping') return json(rpcResult(id, {}));
    if (method === 'tools/list') return json(rpcResult(id, { tools: TOOLS }));
    if (method === 'tools/call') {
      const name = String(params?.name || '');
      const args = (params?.arguments as Record<string, unknown>) || {};
      const result = await callTool(name, args);
      return json(rpcResult(id, result));
    }
    return json(rpcError(id, -32601, `Method not found: ${method}`));
  } catch (err) {
    return json(rpcError(id, -32603, `Internal error: ${String(err).slice(0, 300)}`));
  }
});
