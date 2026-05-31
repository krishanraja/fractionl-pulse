// The Content Radar tab is gated behind a flag so it only appears once the weekly
// harvest + radar generation have been verified end to end. Default off: set
// VITE_RADAR_ENABLED="true" in the Vercel env to surface the tab.
export const RADAR_ENABLED = import.meta.env.VITE_RADAR_ENABLED === 'true';
