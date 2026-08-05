// Fleet sibling links, single-sourced so the attribution never drifts.
//
// Pulse is the free market instrument and the documented lead funnel for
// Fractionl Circle (docs/FLEET_WIRING.md). Circle already consumes Pulse's
// fwi-api, so the warehouse can only close the loop if every outbound link
// carries the same UTM triple.
//
// Circle lives at circle.fractionl.ai. It is NOT at fractionl.com, which is an
// unrelated business; that mistake shipped in /llms.txt and /product-truth.json
// and was corrected on 2026-08-05.

export const CIRCLE_URL = 'https://circle.fractionl.ai';

export const CIRCLE_UTM = {
  utm_source: 'pulse',
  utm_medium: 'cross_sell',
  utm_campaign: 'fwi_dashboard',
} as const;

/**
 * Circle's URL with Pulse attribution. Pass a `content` slot to tell the two
 * placements apart in the warehouse without changing the campaign.
 */
export function circleUrl(content?: string): string {
  const url = new URL(CIRCLE_URL);
  for (const [k, v] of Object.entries(CIRCLE_UTM)) url.searchParams.set(k, v);
  if (content) url.searchParams.set('utm_content', content);
  return url.toString();
}
