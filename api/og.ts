// Dynamic Open Graph card for the FWI. Renders the current week's score + band so
// fleet-posted links unfurl with this week's real reading. Edge runtime, no JSX
// (React.createElement) to keep the build robust in a non-Next Vite project.
import React from 'react';
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const API = 'https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current';

function band(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Surging', color: '#10b981' };
  if (score >= 60) return { label: 'Growing', color: '#22c55e' };
  if (score >= 45) return { label: 'Stable', color: '#eab308' };
  if (score >= 30) return { label: 'Cooling', color: '#f97316' };
  return { label: 'Contracting', color: '#ef4444' };
}

const h = React.createElement;

export default async function handler() {
  let score: number | null = null;
  let asOf = '';
  try {
    const r = await fetch(API);
    if (r.ok) {
      const d = await r.json();
      score = d?.score?.overall ?? null;
      asOf = d?.meta?.asOf ?? '';
    }
  } catch {
    /* fall back to brandline */
  }
  // The index is a 0–100 gauge, so the card shows a whole number to match the app.
  const shown = score != null ? Math.round(score) : null;
  const b = shown != null ? band(shown) : { label: 'The Fractional Working Index', color: '#4338ca' };

  const el = h(
    'div',
    {
      style: {
        height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', backgroundColor: '#0b1020', color: '#fff',
        padding: '72px', fontFamily: 'sans-serif',
      },
    },
    h('div', { style: { display: 'flex', alignItems: 'center', fontSize: 30, color: '#94a3b8', letterSpacing: 2 } }, 'PULSE BY FRACTIONL'),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 24 } },
        h('div', { style: { fontSize: shown != null ? 200 : 84, fontWeight: 700, color: b.color, lineHeight: 1 } }, shown != null ? String(shown) : 'FWI'),
        shown != null ? h('div', { style: { fontSize: 56, fontWeight: 600, color: b.color, paddingBottom: 28 } }, b.label) : null,
      ),
      h('div', { style: { display: 'flex', fontSize: 36, color: '#cbd5e1', marginTop: 8 } }, 'Fractional Working Index'),
    ),
    h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 26, color: '#64748b' } },
      h('div', { style: { display: 'flex' } }, 'Weekly market health for the fractional executive economy'),
      h('div', { style: { display: 'flex' } }, asOf ? `as of ${asOf}` : ''),
    ),
  );

  return new ImageResponse(el, { width: 1200, height: 630 });
}
