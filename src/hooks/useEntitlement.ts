// Pulse Pro entitlement hook. The implementation now lives in the shared
// entitlements layer (src/lib/entitlements.ts) so the client read and the Pro
// gate have a single source of truth. Re-exported here to keep the existing
// import path stable.
export { useEntitlement } from '@/lib/entitlements';
