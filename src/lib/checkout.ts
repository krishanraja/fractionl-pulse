import { toast } from 'sonner';
import { supabase, SUPABASE_FUNCTIONS_URL } from './supabase';
import { getAnonymousId, captureFirstTouch } from './attribution';

// Live checkout is gated behind a flag so the paid tier only appears once it has
// been verified end to end. Default off: the app behaves exactly as before
// (waitlist) until VITE_PULSE_CHECKOUT_ENABLED is set to "true" in the Vercel env.
export const CHECKOUT_ENABLED = import.meta.env.VITE_PULSE_CHECKOUT_ENABLED === 'true';

export async function startCheckout(plan: 'monthly' | 'annual', fwiScore?: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/login';
    return;
  }
  const touch = captureFirstTouch();
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        plan,
        attribution: {
          anonymous_id: getAnonymousId(),
          utm_source: touch.utm_source ?? '',
          utm_medium: touch.utm_medium ?? '',
          utm_campaign: touch.utm_campaign ?? '',
          utm_content: touch.utm_content ?? '',
          utm_term: touch.utm_term ?? '',
          fwi_score: fwiScore ?? '',
        },
      }),
    });
    const json = await res.json();
    if (json.url) {
      window.location.href = json.url;
    } else {
      toast.error('Could not start checkout. Please try again in a moment.');
    }
  } catch {
    toast.error('Could not reach checkout. Please try again.');
  }
}
