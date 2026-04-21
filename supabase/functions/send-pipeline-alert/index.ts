import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const ALERT_EMAIL = 'krish@fractionl.ai';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const { severity, subject, details } = await req.json() as {
      severity: 'critical' | 'warning';
      subject: string;
      details: Record<string, string>;
    };

    if (!RESEND_API_KEY) {
      console.warn('[Alert] RESEND_API_KEY not set');
      return new Response(JSON.stringify({ ok: false, error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isCritical = severity === 'critical';
    const detailRows = Object.entries(details || {})
      .map(([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">${k}</td><td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #f3f4f6;">${v ?? 'N/A'}</td></tr>`
      )
      .join('');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:${isCritical ? '#dc2626' : '#f59e0b'};color:white;padding:16px 20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:16px;">${isCritical ? 'Pipeline Failed' : 'Pipeline Warning'}: Pulse by Fractionl</h2>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
          <p style="margin:0 0 16px;color:#374151;font-size:14px;">${subject}</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;">
            <tbody>${detailRows}</tbody>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
            Check status: <a href="https://pulse.fractionl.ai/api/health" style="color:#6366f1;">pulse.fractionl.ai/api/health</a>
          </p>
        </div>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pulse Alerts <alerts@fractionl.ai>',
        to: [ALERT_EMAIL],
        subject: `[${severity.toUpperCase()}] ${subject}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Alert] Resend error:', res.status, errText);
      return new Response(JSON.stringify({ ok: false, error: errText }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await res.json();
    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Alert] Error:', error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
