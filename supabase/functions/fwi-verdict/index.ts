// fwi-verdict: the Verdict Line magic moment.
//
// A visitor types one line ("fractional CMO in the US, deciding whether to raise
// rates"). This streams back a personalized, chart-evidenced verdict grounded
// ONLY in this week's real FWI, the relevant role's signal, and the movers, with
// the Do-Not-Say truth-discipline enforced in the system prompt.
//
// Safety: origin-restricted to the Pulse site (not an open LLM proxy), short
// input cap, max_tokens cap, gpt-4o-mini. Streams Server-Sent-Events text.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ALLOWED_ORIGINS = [
  'https://pulse.fractionl.ai',
  'http://localhost:5173',
  'http://localhost:8080',
];

function corsFor(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const FUNCTIONS_BASE = 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';

const ROLES: Record<string, string> = {
  cfo: 'Fractional CFO', cmo: 'Fractional CMO', cto: 'Fractional CTO',
  coo: 'Fractional COO', cro: 'Fractional CRO', ceo: 'Interim CEO',
};

function detectRole(text: string): string | null {
  const t = text.toLowerCase();
  for (const key of Object.keys(ROLES)) {
    if (t.includes(key) || t.includes(ROLES[key].toLowerCase())) return ROLES[key];
  }
  if (t.includes('interim ceo') || t.includes('ceo')) return ROLES.ceo;
  return null;
}

const SYSTEM = `You are the analyst voice of Pulse, publisher of the Fractional Working Index (FWI). A fractional executive describes their situation in one line. Give a crisp, decisive, chart-evidenced verdict in 3 to 4 short sentences.

Rules you must never break (truth-discipline):
- Use ONLY the live FWI data provided in the user message. Do not invent numbers.
- Never say "real-time data", "backtested", "years of data", or any predictive-accuracy percentage. The FWI is a weekly index (daily ingest, weekly settle).
- Only the 6 C-suite roles exist (fractional CFO, CMO, CTO, COO, CRO, interim CEO). US primary. Publisher is Fractionl, not an official index.
- If the situation is a rate decision, open with one word in caps: RAISE, HOLD, or DEFEND, then justify with a cited FWI number and the relevant mover.
- No hedging filler, no "as an AI", no disclaimers beyond what the data warrants. Confident, specific, useful. No em dashes.`;

function sse(data: string) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsFor(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  if (!OPENAI_KEY) return new Response('verdict unavailable', { status: 503, headers: cors });

  let situation = '';
  try {
    const body = await req.json();
    situation = String(body.situation || '').slice(0, 280);
  } catch {
    return new Response('invalid json', { status: 400, headers: cors });
  }
  if (!situation.trim()) return new Response('empty situation', { status: 400, headers: cors });

  // Pull live data from the public API (cached, no auth).
  let ctx: any = null;
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/fwi-api/current`, { signal: AbortSignal.timeout(10000) });
    if (res.ok) ctx = await res.json();
  } catch { /* fall through with no ctx */ }

  const role = detectRole(situation);
  const score = ctx?.score?.overall;
  const label = ctx?.score?.label;
  const delta = ctx?.score?.delta30d;
  const movers = (ctx?.topMovers || []).slice(0, 5)
    .map((m: any) => `${m.skill || m.role || ''} ${m.change_pct > 0 ? '+' : ''}${m.change_pct}%`).join(', ');
  const demand = ctx?.score?.components?.demand?.score ?? ctx?.score?.components?.demand;
  const supply = ctx?.score?.components?.supply?.score ?? ctx?.score?.components?.supply;
  const culture = ctx?.score?.components?.culture?.score ?? ctx?.score?.components?.culture;

  const dataBlock = ctx
    ? `Live FWI data (as of ${ctx?.meta?.asOf}):
- Overall FWI: ${score} of 100 (${label}), 30-day change ${delta >= 0 ? '+' : ''}${delta}
- Demand pillar: ${demand}; Supply: ${supply}; Culture: ${culture}
- Top movers this week: ${movers || 'n/a'}
- The Form D Lead: SEC Form D filing velocity is a 1 to 3 month leading indicator of fractional demand.
${role ? `- The user appears to be a ${role}.` : ''}`
    : 'Live FWI data is temporarily unavailable; give a careful, general read and invite the user to check the live number on the dashboard.';

  const userMsg = `Situation: "${situation}"\n\n${dataBlock}`;

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      stream: true,
      temperature: 0.5,
      max_tokens: 350,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userMsg },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!openaiRes.ok || !openaiRes.body) {
    return new Response('verdict unavailable', { status: 502, headers: cors });
  }

  // Re-stream OpenAI SSE as simple text-delta SSE the client can read.
  const reader = openaiRes.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') { controller.enqueue(encoder.encode('data: [DONE]\n\n')); continue; }
            try {
              const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(sse(delta)));
            } catch { /* skip keepalives */ }
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode(sse(`\n[stream error]`)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
});
