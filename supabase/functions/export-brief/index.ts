import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function getLabel(score: number): string {
  if (score >= 75) return 'Surging';
  if (score >= 60) return 'Growing';
  if (score >= 45) return 'Stable';
  if (score >= 30) return 'Cooling';
  return 'Contracting';
}

function getDirection(changePct: number): string {
  if (changePct > 5) return 'up';
  if (changePct < -5) return 'down';
  return 'flat';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { data: latest } = await supabase
      .from('fwi_scores')
      .select('*')
      .order('date', { ascending: false })
      .limit(2);

    if (!latest || latest.length === 0) {
      return new Response(JSON.stringify({ error: 'No FWI data available' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const current = latest[0];
    const prior = latest.length > 1 ? latest[1] : null;

    const overallDelta = prior ? current.overall_score - prior.overall_score : 0;
    const demandDelta = prior ? current.demand_score - prior.demand_score : 0;
    const supplyDelta = prior ? current.supply_score - prior.supply_score : 0;
    const cultureDelta = prior ? current.momentum_score - prior.momentum_score : 0;

    const { data: movers } = await supabase
      .from('movers')
      .select('*')
      .eq('date', current.date)
      .order('rank', { ascending: true })
      .limit(5);

    const { data: insights } = await supabase
      .from('cached_insights')
      .select('insight_type, content')
      .order('generated_at', { ascending: false })
      .limit(4);

    const { data: healthData } = await supabase
      .from('data_source_health')
      .select('source, status')
      .eq('status', 'healthy');

    const healthyCount = healthData?.length || 0;

    const delta = (n: number) => n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
    const arrow = (n: number) => n > 0 ? '↑' : n < 0 ? '↓' : '→';

    const moversSection = (movers || []).map((m: any, i: number) =>
      `${i + 1}. **${m.skill}** — ${m.change_pct > 0 ? '+' : ''}${m.change_pct}% ${arrow(m.change_pct)} ${m.note || ''}`
    ).join('\n');

    const insightsSection = (insights || []).map((ins: any) => {
      const content = typeof ins.content === 'string' ? JSON.parse(ins.content) : ins.content;
      return `- **${content.title || ins.insight_type}:** ${content.summary || content.content || ''}`;
    }).join('\n');

    const brief = `# Fractional Working Index — Weekly Market Intelligence Brief

**Week of ${current.date}** | Published by Pulse by Fractionl

---

## Headline

The Fractional Working Index stands at **${current.overall_score.toFixed(1)}** (${getLabel(current.overall_score)})${prior ? `, ${delta(overallDelta)} ${arrow(overallDelta)} from last week's ${prior.overall_score.toFixed(1)}` : ''}.

---

## Index Components

| Dimension | Score | Change | Direction |
|-----------|-------|--------|-----------|
| **Overall FWI** | ${current.overall_score.toFixed(1)} | ${delta(overallDelta)} | ${arrow(overallDelta)} ${getLabel(current.overall_score)} |
| Hiring Activity (Demand) | ${current.demand_score.toFixed(1)} | ${delta(demandDelta)} | ${arrow(demandDelta)} |
| Talent Availability (Supply) | ${current.supply_score.toFixed(1)} | ${delta(supplyDelta)} | ${arrow(supplyDelta)} |
| Market Momentum (Culture) | ${current.momentum_score.toFixed(1)} | ${delta(cultureDelta)} | ${arrow(cultureDelta)} |

**Data confidence:** ${((current.confidence || 0) * 100).toFixed(0)}% | **Sources reporting:** ${healthyCount}/21

---

## Top Movers This Week

${moversSection || '_No significant movers this week._'}

---

## AI-Generated Insights

${insightsSection || '_Insights will be generated after the next pipeline run._'}

---

## About This Data

The Fractional Working Index aggregates 21 independent data sources across three dimensions:

- **Demand (50%):** Adzuna job postings, SerpAPI Google Jobs, SEC EDGAR Form D filings
- **Supply (20%):** People Data Labs profiles, SerpAPI LinkedIn proxy, GoFractional marketplace, supply-intent trends
- **Culture (30%):** Google Trends, NewsAPI, Mediastack, Brave Search, Guardian, NYT, Podchaser, Reddit, Hacker News

All signals are normalized to a 0-100 scale. An anomaly guard rejects data points more than 3 standard deviations from their 8-week rolling average.

---

## Citation

> Fractional Working Index (FWI), Pulse by Fractionl. Week of ${current.date}. Data from 21 sources including Adzuna, SEC EDGAR, Google Trends, and People Data Labs. https://pulse.fractionl.ai

---

## How to Use This Data

**For press/media:** This brief may be quoted with attribution to "Pulse by Fractionl" and a link to https://pulse.fractionl.ai.

**For analysts:** Raw JSON data is available at https://dtlcprcpvdomrehbejhw.supabase.co/functions/v1/fwi-api/current

**For AI agents:** Full API documentation at the endpoint above. No authentication required for public data.

---

*Generated automatically by Pulse by Fractionl. Data licensing: data@fractionl.ai*
`;

    const format = new URL(req.url).searchParams.get('format') || 'markdown';
    
    if (format === 'json') {
      return new Response(JSON.stringify({
        date: current.date,
        overall: current.overall_score,
        demand: current.demand_score,
        supply: current.supply_score,
        culture: current.momentum_score,
        confidence: current.confidence,
        delta: { overall: overallDelta, demand: demandDelta, supply: supplyDelta, culture: cultureDelta },
        movers: movers || [],
        insights: insights || [],
        sources_healthy: healthyCount,
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(brief, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="FWI-Brief-${current.date}.md"`,
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
