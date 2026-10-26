// The OpenAlex research-interest query, shared by ingest-signals (the held-out
// openalex context input) and collect-trials ?diagnose=openalex, so the
// diagnosis runs exactly the production query.
export const OPENALEX_PHRASES = [
  '"fractional CFO"',
  '"fractional CMO"',
  '"fractional CTO"',
  '"fractional executive"',
  '"interim executive"',
];

// Business OR Economics OR Management, works from the trailing year.
export const OPENALEX_CONCEPTS = 'C144133560|C162324750|C39389867';

export function openAlexUrl(phrase: string, since: string, withConcepts = true): string {
  const filter = `from_publication_date:${since}${withConcepts ? `,concepts.id:${OPENALEX_CONCEPTS}` : ''}`;
  return `https://api.openalex.org/works?search=${encodeURIComponent(phrase)}&filter=${filter}&per-page=1&mailto=hello@krishraja.com`;
}

// OpenAlex meters keyless requests on a daily budget shared by every caller on
// the IP; Supabase's shared egress spends it (HTTP 429 from 2026-10-24).
export function openAlexHeaders(key: string): Record<string, string> {
  return key ? { Authorization: `Bearer ${key}` } : {};
}
