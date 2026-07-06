// send-content-brief: the weekly Content Radar email. Built but DORMANT by design.
// It NEVER sends unless explicitly armed: env CONTENT_EMAIL_ENABLED=true AND there are
// active content_brief_subscribers. Otherwise it returns the rendered preview HTML and
// sends nothing, so the cron can call it safely with no email going out until you decide.
//   GET ?preview=1  -> always returns rendered HTML, sends nothing
//   POST/GET (cron) -> sends only when armed; otherwise a no-op { dormant: true }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const EMAIL_ENABLED = (Deno.env.get('CONTENT_EMAIL_ENABLED') || '').toLowerCase() === 'true';
const FROM = 'Fractional Content Radar <radar@fractionl.ai>';
const SITE = 'https://pulse.fractionl.ai';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };

// Escape any LLM/scraped text before interpolating into the email HTML (stored-XSS guard).
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderHtml(bj: any, weekStart: string): string {
  const topics = (bj.rising_topics || []).slice(0, 5).map((t: any, i: number) =>
    `<tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;"><strong>${i + 1}. ${esc(t.label)}</strong>${t.is_breakout ? ' 🚀' : ''}<div style="color:#64748b;font-size:13px;margin-top:2px;">${esc(t.summary)}</div></td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#6366f1;font-weight:600;">${esc(t.radar_score)}</td></tr>`).join('');
  const questions = (bj.breakout_questions || []).slice(0, 5).map((q: string) => `<li style="margin:4px 0;">${esc(q)}</li>`).join('');
  const angles = (bj.priority_angles || []).slice(0, 4).map((a: any) => `<li style="margin:6px 0;"><strong>${esc(a.angle)}</strong> <span style="color:#94a3b8;">(${esc(a.format)})</span><br/><span style="color:#64748b;font-size:13px;">${esc(a.rationale)}</span></li>`).join('');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    <div style="background:#4f46e5;color:white;padding:18px 22px;border-radius:10px 10px 0 0;"><h2 style="margin:0;font-size:17px;">Fractional Content Radar</h2><div style="font-size:12px;opacity:.85;">Week of ${weekStart}</div></div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:20px 22px;border-radius:0 0 10px 10px;">
      <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#475569;margin:0 0 8px;">Rising topics</h3>
      <table style="width:100%;border-collapse:collapse;">${topics || '<tr><td>No topics this week.</td></tr>'}</table>
      <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#475569;margin:18px 0 6px;">Breakout questions</h3>
      <ul style="margin:0;padding-left:18px;color:#334155;font-size:14px;">${questions || '<li>None newly emerging.</li>'}</ul>
      <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#475569;margin:18px 0 6px;">Priority angles</h3>
      <ul style="margin:0;padding-left:18px;color:#334155;font-size:14px;">${angles || '<li>No angles this week.</li>'}</ul>
      <p style="margin:20px 0 0;"><a href="${SITE}" style="color:#6366f1;font-weight:600;">Open the full radar →</a></p>
      <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;">You are receiving this because you subscribed to the Fractional Content Radar.</p>
    </div></div>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const preview = new URL(req.url).searchParams.get('preview') === '1';

  const { data: brief } = await supabase.from('content_briefs').select('week_start, brief_json').order('week_start', { ascending: false }).limit(1).maybeSingle();
  if (!brief) return new Response(JSON.stringify({ ok: false, error: 'no_brief' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });

  const html = renderHtml(brief.brief_json, brief.week_start);
  if (preview) return new Response(html, { headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' } });

  // Dormant unless explicitly armed.
  if (!EMAIL_ENABLED) {
    return new Response(JSON.stringify({ ok: true, dormant: true, sent: 0, note: 'Set CONTENT_EMAIL_ENABLED=true to arm sends.', week_start: brief.week_start }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  if (!RESEND_API_KEY) return new Response(JSON.stringify({ ok: false, error: 'RESEND_API_KEY not set' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

  const { data: subs } = await supabase.from('content_brief_subscribers').select('email').eq('active', true);
  const recipients = (subs || []).map(s => s.email).filter(Boolean);
  if (recipients.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0, note: 'No active subscribers.' }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  let sent = 0;
  for (const to of recipients) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [to], subject: `Fractional Content Radar: week of ${brief.week_start}`, html }),
      });
      if (res.ok) sent++;
      await new Promise(r => setTimeout(r, 300));
    } catch { /* skip one bad address */ }
  }
  return new Response(JSON.stringify({ ok: true, sent, recipients: recipients.length, week_start: brief.week_start }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
