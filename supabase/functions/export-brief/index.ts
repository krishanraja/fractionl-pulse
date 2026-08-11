import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TRACKED_INPUTS = [
  'adzuna', 'serpapi_jobs', 'serpapi_trends', 'sec_edgar', 'newsapi',
  'brave_news', 'brave_web', 'mediastack', 'guardian', 'podchaser',
  'reddit', 'hn', 'serpapi_linkedin', 'brave_talent', 'gofractional',
  'serpapi_supply_trends', 'fred', 'census_acs', 'bls',
  'wikipedia_pageviews', 'openalex',
] as const;

interface MoverItem { skill: string; change_pct: number; note?: string | null }
interface InsightItem { title?: string; type?: string; body?: string }

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

function score(value: number | null | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'Unavailable';
}

function numeric(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

    const overallDelta = prior ? numeric(current.overall_score) - numeric(prior.overall_score) : 0;
    const demandDelta = prior ? numeric(current.demand_score) - numeric(prior.demand_score) : 0;
    const supplyDelta = prior ? numeric(current.supply_score) - numeric(prior.supply_score) : 0;
    const cultureDelta = prior ? numeric(current.momentum_score) - numeric(prior.momentum_score) : 0;

    const { data: movers } = await supabase
      .from('movers')
      .select('*')
      .eq('date', current.date)
      .order('rank', { ascending: true })
      .limit(5);

    const { data: insightsRow } = await supabase
      .from('cached_insights')
      .select('insights_json, generated_at')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const insights = insightsRow?.insights_json && Array.isArray(insightsRow.insights_json)
      ? insightsRow.insights_json.slice(0, 4)
      : [];

    const { data: healthData } = await supabase
      .from('data_source_health')
      .select('source, status')
      .eq('status', 'healthy')
      .in('source', [...TRACKED_INPUTS]);

    const healthyCount = healthData?.length || 0;

    const delta = (n: number) => n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
    const arrow = (n: number) => n > 0 ? '↑' : n < 0 ? '↓' : '→';

    const moversSection = ((movers || []) as MoverItem[]).map((m, i) =>
      `${i + 1}. **${m.skill}**: ${m.change_pct > 0 ? '+' : ''}${m.change_pct}% ${arrow(m.change_pct)} ${m.note || ''}`
    ).join('\n');

    const insightsSection = (insights as InsightItem[]).map((ins) => {
      return `- **${ins.title || ins.type || 'Insight'}:** ${ins.body || ''}`;
    }).join('\n');

    const brief = `# Fractional Working Index: Weekly Market Intelligence Brief

**Week of ${current.date}** | Published by Pulse by Fractionl

---

## Headline

The Fractional Working Index stands at **${score(current.overall_score)}** (${getLabel(numeric(current.overall_score))})${prior ? `, ${delta(overallDelta)} ${arrow(overallDelta)} from the prior observation of ${score(prior.overall_score)}` : ''}.

---

## Index Components

| Dimension | Score | Change | Direction |
|-----------|-------|--------|-----------|
| **Overall FWI** | ${score(current.overall_score)} | ${delta(overallDelta)} | ${arrow(overallDelta)} ${getLabel(numeric(current.overall_score))} |
| Hiring Activity (Demand) | ${score(current.demand_score)} | ${delta(demandDelta)} | ${arrow(demandDelta)} |
| Talent Availability (Supply) | ${score(current.supply_score)} | ${delta(supplyDelta)} | ${arrow(supplyDelta)} |
| Market Momentum (Culture) | ${score(current.momentum_score)} | ${delta(cultureDelta)} | ${arrow(cultureDelta)} |

**Data completeness:** ${(numeric(current.confidence) * 100).toFixed(0)}% | **Tracked inputs currently healthy:** ${healthyCount}/${TRACKED_INPUTS.length}

---

## Top Movers This Week

${moversSection || '_No significant movers this week._'}

---

## AI-Generated Insights

${insightsSection || '_Insights will be generated after the next pipeline run._'}

---

## About This Data

The Fractional Working Index tracks 21 inputs across three dimensions. Inputs are not all statistically independent, and availability varies by reading:

- **Demand (50%):** Adzuna job postings, SerpAPI Google Jobs, SEC EDGAR Form D filings
- **Supply (20%):** SerpAPI and Brave professional-profile proxies, GoFractional marketplace listings, SerpAPI supply-intent trends
- **Culture (30%):** SerpAPI Trends, NewsAPI, Mediastack, Brave Search, Guardian, Podchaser, Reddit, Hacker News, and Wikipedia pageviews

BLS, Census ACS, FRED, and OpenAlex provide context and are excluded from the composite. Historical coverage is mixed-frequency. The Form D input is financing context, not a validated prediction of future fractional hiring.

All signals are normalized to a 0-100 scale. An anomaly guard rejects data points more than 3 standard deviations from their 8-week rolling average.

---

## Citation

> Fractional Working Index (FWI), Pulse by Fractionl. Week of ${current.date}. A 0-100 private composite using 21 tracked inputs, with current completeness and methodology at https://pulse.fractionl.ai

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
        tracked_inputs: TRACKED_INPUTS.length,
        source_count_note: 'Tracked inputs are not all independent and do not all report on every reading.',
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
    const message = error instanceof Error ? error.message : 'Unknown export failure';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
