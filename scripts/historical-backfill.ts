/**
 * One-time historical backfill script.
 * Queries APIs that serve historical data (FRED, SEC EDGAR, Guardian, HN, Census)
 * and inserts real signals for the past 12 Mondays.
 * 
 * Run: npx tsx scripts/historical-backfill.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY, FRED_API_KEY, GUARDIAN_API_KEY env vars
 */

const SUPABASE_URL = 'https://dtlcprcpvdomrehbejhw.supabase.co';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

async function main() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const fredKey = process.env.FRED_API_KEY;
  const guardianKey = process.env.GUARDIAN_API_KEY;

  if (!serviceKey) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

  const mondays: string[] = [];
  const today = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (i * 7));
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
    mondays.push(d.toISOString().slice(0, 10));
  }
  mondays.reverse();
  console.log(`Backfilling ${mondays.length} weeks: ${mondays[0]} to ${mondays[mondays.length - 1]}`);

  const allSignals: Array<Record<string, unknown>> = [];

  for (const date of mondays) {
    console.log(`\n--- ${date} ---`);

    // SEC EDGAR: historical Form D filings
    try {
      const endDate = new Date(date);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 90);
      const url = `https://efts.sec.gov/LATEST/search-index?forms=D&dateRange=custom&startdt=${startDate.toISOString().slice(0, 10)}&enddt=${endDate.toISOString().slice(0, 10)}&q=%22software%22+OR+%22technology%22+OR+%22SaaS%22`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'FWI-Pulse/1.0 research@fractionl.ai' } });
      if (resp.ok) {
        const data = await resp.json();
        const count = data.hits?.total?.value || 0;
        const baseline = 800;
        const normalized = Math.min(100, Math.round((count / baseline) * 50));
        allSignals.push({ date, source: 'sec_edgar', signal_type: 'demand', category: 'vc_pipeline',
          raw_value: count, normalized_value: normalized,
          metadata: { window_days: 90, backfill: true } });
        console.log(`  SEC EDGAR: ${count} filings -> ${normalized}`);
      }
    } catch (error: unknown) { console.error(`  SEC EDGAR failed: ${errorMessage(error)}`); }

    // Guardian: historical prestige media
    if (guardianKey) {
      try {
        const endDate = new Date(date);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 90);
        const url = `https://content.guardianapis.com/search?q=%22fractional+executive%22+OR+%22fractional+CFO%22&from-date=${startDate.toISOString().slice(0, 10)}&to-date=${endDate.toISOString().slice(0, 10)}&page-size=10&api-key=${guardianKey}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          const count = data.response?.total || 0;
          let normalized = 5;
          if (count > 0 && count <= 2) normalized = 30;
          else if (count <= 5) normalized = 55;
          else if (count <= 10) normalized = 75;
          else if (count > 10) normalized = Math.min(100, 75 + count);
          allSignals.push({ date, source: 'guardian', signal_type: 'momentum', category: 'prestige_media',
            raw_value: count, normalized_value: normalized,
            metadata: { window_days: 90, backfill: true } });
          console.log(`  Guardian: ${count} articles -> ${normalized}`);
        }
        await new Promise(r => setTimeout(r, 1200));
      } catch (error: unknown) { console.error(`  Guardian failed: ${errorMessage(error)}`); }
    }

    // Hacker News: historical discourse
    try {
      const cutoff = Math.floor(new Date(date).getTime() / 1000) - 30 * 86400;
      const dateCutoff = Math.floor(new Date(date).getTime() / 1000);
      const url = `https://hn.algolia.com/api/v1/search?query=%22fractional%22&tags=story&hitsPerPage=50&numericFilters=created_at_i>${cutoff},created_at_i<${dateCutoff}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const hits = data.hits || [];
        const totalHits = data.nbHits || hits.length;
        const avgPoints = hits.length > 0 ? hits.reduce((sum: number, hit: { points?: number }) => sum + (hit.points || 0), 0) / hits.length : 0;
        const postSignal = Math.min(50, Math.sqrt(totalHits) * 8);
        const engSignal = Math.min(50, Math.sqrt(avgPoints) * 5);
        const normalized = Math.min(100, Math.round(postSignal + engSignal));
        allSignals.push({ date, source: 'hn', signal_type: 'momentum', category: 'community_discourse',
          raw_value: totalHits, normalized_value: normalized,
          metadata: { avg_points: Math.round(avgPoints), window: 'past_month', backfill: true } });
        console.log(`  HN: ${totalHits} stories, avg ${avgPoints.toFixed(0)} pts -> ${normalized}`);
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (error: unknown) { console.error(`  HN failed: ${errorMessage(error)}`); }

    // FRED: macro context (same data for all weeks -- FRED updates monthly)
    if (fredKey) {
      const series = [
        { id: 'JTSJOL', name: 'JOLTS Job Openings' },
        { id: 'UNRATE', name: 'Unemployment Rate' },
        { id: 'ICSA', name: 'Initial Jobless Claims' },
      ];
      for (const s of series) {
        try {
          const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=4&observation_end=${date}`;
          const resp = await fetch(url);
          if (resp.ok) {
            const data = await resp.json();
            const obs = data.observations?.[0];
            const value = parseFloat(obs?.value) || 0;
            allSignals.push({ date, source: 'fred', signal_type: 'context', category: s.id.toLowerCase(),
              raw_value: value, normalized_value: 50,
              metadata: { series_name: s.name, observation_date: obs?.date, backfill: true } });
            console.log(`  FRED ${s.name}: ${value} (${obs?.date})`);
          }
          await new Promise(r => setTimeout(r, 300));
        } catch (error: unknown) { console.error(`  FRED ${s.name} failed: ${errorMessage(error)}`); }
      }
    }

    // Census ACS: same year data for all weeks
    try {
      const url = 'https://api.census.gov/data/2023/acs/acs1?get=B19053_001E,B19053_002E&for=us:1';
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const row = data[1];
        const total = parseInt(row?.[0]) || 0;
        const selfEmp = parseInt(row?.[1]) || 0;
        const pct = total > 0 ? Math.round((selfEmp / total) * 10000) / 100 : 0;
        allSignals.push({ date, source: 'census_acs', signal_type: 'context', category: 'self_employment',
          raw_value: selfEmp, normalized_value: 50,
          metadata: { total_households: total, self_employment_pct: pct, year: 2023, backfill: true } });
        console.log(`  Census ACS: ${pct}% self-employment`);
      }
    } catch (error: unknown) { console.error(`  Census failed: ${errorMessage(error)}`); }
  }

  console.log(`\nTotal signals to upsert: ${allSignals.length}`);

  // Batch upsert to Supabase
  const batchSize = 50;
  for (let i = 0; i < allSignals.length; i += batchSize) {
    const batch = allSignals.slice(i, i + batchSize);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error(`Upsert batch ${i} failed: ${err}`);
    } else {
      console.log(`Upserted batch ${i}-${i + batch.length}`);
    }
  }

  console.log('\nBackfill complete. Run calculate-fwi for each date to generate historical FWI scores.');

  // Trigger calculate-fwi for each backfilled date
  for (const date of mondays) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/calculate-fwi?date=${date}`, {
        headers: { 'Authorization': `Bearer ${serviceKey}` },
      });
      if (resp.ok) {
        const result = await resp.json();
        console.log(`  FWI ${date}: ${result.overall_score}`);
      } else {
        console.error(`  FWI calc failed for ${date}: ${resp.status}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch (error: unknown) {
      console.error(`  FWI calc error for ${date}: ${errorMessage(error)}`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
