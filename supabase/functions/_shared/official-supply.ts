// Official monthly supply series for FWI method v2 (Ruling, Krish, 2026-10-23).
// Both are keyless public files with full history, so the series as known on
// any past day can be rebuilt from the file itself: that is the backfill, read
// from the release record, never written into published history.
//
//   census_bfs_pbs   Census Business Formation Statistics, business applications,
//                    NAICS 54 professional, scientific and technical services,
//                    seasonally adjusted, monthly from 2004. New consultancies and
//                    one-person firms are where fractional executives incorporate.
//   bls_incorporated BLS Current Population Survey, incorporated self-employed,
//                    employment level (FRED LNU02048984), monthly from 1989,
//                    not seasonally adjusted, so it is scored on its
//                    year-over-year change.

export const CENSUS_BFS_MONTHLY_URL = 'https://www.census.gov/econ/bfs/csv/bfs_monthly.csv';
export const FRED_INCORPORATED_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=LNU02048984';
export const USER_AGENT = 'pulse-fwi/2.0 (+https://pulse.fractionl.ai/methodology)';

// Day of the following month from which a period counts as published. Census
// releases BFS monthly around the middle of the next month; BLS publishes the
// CPS on the first Friday. Both are set later than the agencies' calendars.
export const RELEASE_DAY = { census_bfs_pbs: 20, bls_incorporated: 12 } as const;

export type Point = { period: string; value: number };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseCensusBfs(csv: string, sector = 'NAICS54', series = 'BA_BA'): Point[] {
  const [head, ...lines] = csv.trim().split(/\r?\n/);
  const cols = head.split(',');
  const at = (name: string) => cols.indexOf(name);
  const out: Point[] = [];
  for (const line of lines) {
    const c = line.split(',');
    if (c[at('sa')] !== 'A' || c[at('naics_sector')] !== sector || c[at('series')] !== series || c[at('geo')] !== 'US') continue;
    const year = c[at('year')];
    MONTHS.forEach((m, i) => {
      const v = c[at(m)];
      if (v !== undefined && v !== '' && Number.isFinite(Number(v))) out.push({ period: `${year}-${String(i + 1).padStart(2, '0')}`, value: Number(v) });
    });
  }
  return out.sort((a, b) => a.period.localeCompare(b.period));
}

export function parseFredCsv(csv: string): Point[] {
  const [, ...lines] = csv.trim().split(/\r?\n/);
  return lines.flatMap((l) => {
    const [d, v] = l.split(',');
    const n = Number(v);
    return d && v !== '.' && Number.isFinite(n) ? [{ period: d.slice(0, 7), value: n }] : [];
  });
}

async function text(url: string): Promise<string> {
  let last = 0;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (r.ok) return await r.text();
    last = r.status;
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw new Error(`${url} -> HTTP ${last}`);
}

// BLS API response -> points. Monthly periods are M01..M12; M13 is an annual average.
export function parseBlsApi(json: { status?: string; message?: string[]; Results?: { series?: Array<{ data?: Array<{ year: string; period: string; value: string }> }> } }): Point[] {
  if (json.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS status=${json.status}: ${(json.message || []).join('; ')}`);
  const data = json.Results?.series?.[0]?.data || [];
  return data
    .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period) && Number.isFinite(Number(d.value)))
    .map((d) => ({ period: `${d.year}-${d.period.slice(1)}`, value: Number(d.value) }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// BLS's own API first (keyless, the same service the bls context collector
// already calls daily); FRED's CSV mirror of the same series as the fallback,
// because its endpoint answers 403/503 to some clients.
async function incorporatedSelfEmployed(): Promise<{ points: Point[]; via: string }> {
  const year = new Date().getUTCFullYear();
  try {
    const r = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ seriesid: ['LNU02048984'], startyear: String(year - 5), endyear: String(year) }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const points = parseBlsApi(await r.json());
    if (points.length >= 49) return { points, via: 'api.bls.gov' };
    throw new Error(`only ${points.length} months`);
  } catch (e) {
    console.warn(`[official-supply] BLS API unavailable (${(e as Error).message}); using FRED mirror`);
    return { points: parseFredCsv(await text(FRED_INCORPORATED_URL)), via: 'fred.stlouisfed.org' };
  }
}

export async function fetchOfficialSupply(): Promise<{ census_bfs_pbs: Point[]; bls_incorporated: Point[]; via: Record<string, string> }> {
  const [census, bls] = await Promise.all([text(CENSUS_BFS_MONTHLY_URL), incorporatedSelfEmployed()]);
  return { census_bfs_pbs: parseCensusBfs(census), bls_incorporated: bls.points, via: { census_bfs_pbs: 'census.gov', bls_incorporated: bls.via } };
}
