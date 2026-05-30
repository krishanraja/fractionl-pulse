// First-party attribution capture + lifecycle event emission (Pulse side).
//
// Design + safety:
// - A durable first-party anonymous_id is minted on first paint and persisted.
// - First-touch UTM / referrer / landing path are captured once and never
//   overwritten, so the original source survives through signup and (later)
//   into Stripe metadata.
// - Events are POSTed ONLY to the Pulse `emit-event` edge function, which holds
//   the warehouse ingest secret server-side. The browser never sees that secret.
// - If the emit endpoint is not configured (VITE_ATTRIBUTION_EMIT_URL unset),
//   every emit is a no-op. This is intentional: Pulse ships this contract before
//   the Mindmaker OS warehouse ingest is wired, and it must never break the app
//   or block a render while the cross-system wiring is completed by the OS.
//
// The canonical event shape and the app=pulse + stripe_account=fractionl_ai
// keying match docs/FLEET_WIRING.md and the master attribution contract.

const AID_KEY = 'pulse_aid';
const FIRST_TOUCH_KEY = 'pulse_first_touch';

export const APP = 'pulse' as const;
export const STRIPE_ACCOUNT = 'fractionl_ai' as const;

export type LifecycleEvent =
  | 'landed'
  | 'signed_up'
  | 'activated'
  | 'purchased'
  | 'refunded'
  | 'churned';

function makeUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to manual generation
  }
  // RFC4122-ish fallback. Not used for security, only for a stable client id.
  let seed = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (seed + Math.floor(Math.random() * 16)) % 16;
    seed = Math.floor(seed / 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Durable first-party id. Created once, reused for the life of the browser store. */
export function getAnonymousId(): string {
  try {
    let id = localStorage.getItem(AID_KEY);
    if (!id) {
      id = makeUuid();
      localStorage.setItem(AID_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked (private mode, etc): fall back to an ephemeral id.
    return makeUuid();
  }
}

export interface FirstTouch {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  campaign_id: string | null;
  agent: string | null;
  referrer: string | null;
  landing_path: string | null;
  captured_at: string | null;
}

const EMPTY_TOUCH: FirstTouch = {
  utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null,
  utm_term: null, campaign_id: null, agent: null, referrer: null,
  landing_path: null, captured_at: null,
};

/**
 * Capture first-touch attribution exactly once. On the first visit that carries
 * UTM params (or any visit if none stored yet) we persist the source and never
 * overwrite it, so a later same-browser visit keeps the original attribution.
 */
export function captureFirstTouch(): FirstTouch {
  try {
    const existing = localStorage.getItem(FIRST_TOUCH_KEY);
    if (existing) {
      try {
        return { ...EMPTY_TOUCH, ...(JSON.parse(existing) as Partial<FirstTouch>) };
      } catch {
        // corrupted; recapture below
      }
    }

    const params = new URLSearchParams(window.location.search);
    const get = (k: string) => params.get(k) || null;
    const touch: FirstTouch = {
      utm_source: get('utm_source'),
      utm_medium: get('utm_medium'),
      utm_campaign: get('utm_campaign'),
      utm_content: get('utm_content'),
      utm_term: get('utm_term'),
      campaign_id: get('campaign_id') || get('cid'),
      agent: get('agent') || get('fleet_agent'),
      referrer: document.referrer || null,
      landing_path: window.location.pathname + window.location.search,
      captured_at: new Date().toISOString(),
    };
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(touch));
    return touch;
  } catch {
    return EMPTY_TOUCH;
  }
}

const EMIT_URL = (import.meta.env.VITE_ATTRIBUTION_EMIT_URL as string | undefined) || '';

/** A stable-per-(event,day,anon) idempotency key so retries do not double-count. */
function dedupeKey(event: LifecycleEvent, anonymousId: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${APP}:${event}:${anonymousId}:${day}`;
}

/**
 * Emit a lifecycle event to the Pulse emit-event proxy. No-ops (resolves) if the
 * proxy URL is not configured, or on any network error, so callers can fire and
 * forget without guarding. Never throws.
 */
export async function emitEvent(
  event: LifecycleEvent,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!EMIT_URL) return; // not yet wired by the OS; safe no-op
  try {
    const anonymousId = getAnonymousId();
    const touch = captureFirstTouch();
    const body = JSON.stringify({
      app: APP,
      stripe_account: STRIPE_ACCOUNT,
      event,
      occurred_at: new Date().toISOString(),
      anonymous_id: anonymousId,
      dedupe_key: dedupeKey(event, anonymousId),
      ...touch,
      ...extra,
    });

    // Prefer keepalive so the event survives a navigation (e.g. landed -> click out).
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon(EMIT_URL, new Blob([body], { type: 'application/json' }));
      if (ok) return;
    }
    await fetch(EMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Attribution must never break the app. Swallow.
  }
}
