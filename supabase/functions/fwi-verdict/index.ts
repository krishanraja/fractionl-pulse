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

const PULSE_PREVIEW_ORIGIN = /^https:\/\/fractionl-pulse-[a-z0-9-]+-krish-rajas-projects\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): origin is string {
  return Boolean(origin && (ALLOWED_ORIGINS.includes(origin) || PULSE_PREVIEW_ORIGIN.test(origin)));
}

function corsFor(origin: string | null) {
  const allow = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const FUNCTIONS_BASE = 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const HOURLY_LIMIT = 12;

interface ComponentScore { score?: number }
type ComponentValue = number | ComponentScore;
interface VerdictMover { role?: string; skill?: string; changePct?: number; change_pct?: number }
interface VerdictContext {
  meta?: { asOf?: string };
  score?: {
    overall?: number;
    label?: string;
    delta30d?: number;
    delta30dComparedWith?: string | null;
    components?: { demand?: ComponentValue; supply?: ComponentValue; culture?: ComponentValue };
  };
  topMovers?: VerdictMover[];
}

const componentScore = (value: ComponentValue | undefined) =>
  typeof value === 'number' ? value : value?.score;

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

const SYSTEM = `You are the analyst voice of Pulse, publisher of the Fractional Working Index (FWI). A fractional executive describes their situation in one line. Give a crisp, decisive, chart-evidenced verdict in exactly three short labeled lines.

Rules you must never break (truth-discipline):
- Use ONLY the live FWI data provided in the user message. Do not invent numbers.
- Never say "real-time data", "backtested", "years of data", or any predictive-accuracy percentage. The FWI is a weekly index (daily ingest, weekly settle).
- Only the 6 C-suite roles exist (fractional CFO, CMO, CTO, COO, CRO, interim CEO). US primary. Publisher is Fractionl, not an official index.
- A role mover is a cross-sectional comparison with the current market average. It is NEVER a week-over-week increase, decline, surge, or drop.
- If the user is outside the US, say the index cannot measure their local market and do not convert US evidence into a local verdict.
- Treat 30-44 as Cooling, 45-59 as Stable, 60-74 as Growing, and 75+ as Surging for every component score.
- Do not claim that community buzz, media coverage, or a single mover proves pricing power or causes a rate decision.
- If the situation is a rate decision, never issue RAISE, HOLD, or DEFEND as a personal instruction. State what the market evidence supports, what it cannot establish, and which missing first-party fact (for example win rate, pipeline quality, or achieved fees) must decide the action.
- Structure the response as three compact labeled lines: FACT, INTERPRETATION, ACTION. Cite the index date and label the mover "vs market average".
- No hedging filler, no "as an AI", no disclaimers beyond what the data warrants. Confident, specific, useful. No em dashes.`;

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function consumeRateLimit(req: Request): Promise<{ allowed: boolean; remaining: number; resetAt: string } | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  const networkKey = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const keyHash = await sha256(`${SERVICE_ROLE_KEY.slice(-24)}:${networkKey}`);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_ai_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_key_hash: keyHash, p_limit: HOURLY_LIMIT, p_window_seconds: 3600 }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const row = (await response.json())?.[0];
  if (!row) return null;
  return { allowed: Boolean(row.allowed), remaining: Number(row.remaining), resetAt: String(row.reset_at) };
}

function sse(data: string) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  if (!isAllowedOrigin(origin)) {
    return new Response('Forbidden origin', { status: 403, headers: { Vary: 'Origin' } });
  }
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

  const rate = await consumeRateLimit(req).catch(() => null);
  if (!rate) return new Response('verdict temporarily unavailable', { status: 503, headers: cors });
  const rateHeaders = {
    'X-RateLimit-Limit': String(HOURLY_LIMIT),
    'X-RateLimit-Remaining': String(rate.remaining),
    'X-RateLimit-Reset': rate.resetAt,
  };
  if (!rate.allowed) {
    const retryAfter = Math.max(1, Math.ceil((new Date(rate.resetAt).getTime() - Date.now()) / 1000));
    return new Response('rate limit exceeded', {
      status: 429,
      headers: { ...cors, ...rateHeaders, 'Retry-After': String(retryAfter) },
    });
  }

  // Pull live data from the public API (cached, no auth).
  let ctx: VerdictContext | null = null;
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/fwi-api/current`, { signal: AbortSignal.timeout(10000) });
    if (res.ok) ctx = await res.json() as VerdictContext;
  } catch { /* fall through with no ctx */ }

  if (!ctx?.meta?.asOf || typeof ctx.score?.overall !== 'number' || !ctx.score.label) {
    return new Response('live index unavailable', { status: 503, headers: { ...cors, ...rateHeaders } });
  }

  const role = detectRole(situation);
  const score = ctx?.score?.overall;
  const label = ctx?.score?.label;
  const delta = ctx?.score?.delta30d ?? 0;
  // The /fwi-api/current payload emits movers as { role, changePct, ... } (camelCase).
  // Reading snake_case here previously produced "Fractional CMO undefined%" for every
  // mover, so the model got no role signal and every verdict collapsed to a generic read.
  const movers = (ctx?.topMovers || []).slice(0, 5)
    .map((m) => {
      const who = m.role ?? m.skill ?? '';
      const chg = m.changePct ?? m.change_pct;
      return chg == null ? who : `${who} ${chg > 0 ? '+' : ''}${chg}%`;
    })
    .filter((s: string) => s.trim())
    .join(', ');
  const demand = componentScore(ctx?.score?.components?.demand);
  const supply = componentScore(ctx?.score?.components?.supply);
  const culture = componentScore(ctx?.score?.components?.culture);

  const dataBlock = `Live FWI data (as of ${ctx.meta.asOf}):
- Overall FWI: ${score} of 100 (${label}), 30-day change ${delta >= 0 ? '+' : ''}${delta}, compared with ${ctx?.score?.delta30dComparedWith || 'the nearest available observation 30 days earlier'}
- Demand pillar: ${demand}; Supply: ${supply}; Culture: ${culture}
- Cross-sectional movers vs the current market average (NOT time changes): ${movers || 'n/a'}
- SEC Form D filing velocity is financing context. Do not claim it predicts future fractional demand; that relationship has not been validated.
${role ? `- The user appears to be a ${role}.` : ''}`;

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
    return new Response('verdict unavailable', { status: 502, headers: { ...cors, ...rateHeaders } });
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
      } catch {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...cors, ...rateHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
});
