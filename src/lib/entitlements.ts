import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { CHECKOUT_ENABLED } from '@/lib/checkout';

// Entitlements layer for Pulse Pro.
//
// Source of truth is the subscriptions table (one row per Stripe subscription,
// written only by the service role in the stripe-webhook). RLS narrows reads to
// the caller's own row, so this client read is safe. A subscription counts as
// Pro while it is active or trialing.

const ACTIVE_STATUSES = ['active', 'trialing'];

export interface Entitlement {
  isPro: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
}

const EMPTY: Entitlement = { isPro: false, status: null, currentPeriodEnd: null };

// Fetch the current user's entitlement directly (for non-hook call sites).
export async function fetchEntitlement(userId: string): Promise<Entitlement> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .in('status', ACTIVE_STATUSES)
    .maybeSingle();
  if (!data) return EMPTY;
  return {
    isPro: ACTIVE_STATUSES.includes(data.status),
    status: data.status ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
  };
}

// React hook form: exposes the signed-in user's Pro status to the client.
export function useEntitlement(): Entitlement & { isLoading: boolean } {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['entitlement', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchEntitlement(user!.id),
  });
  return {
    ...(data ?? EMPTY),
    isLoading: !!user && isLoading,
  };
}

export interface ProGate {
  isPro: boolean;
  isLoading: boolean;
  checkoutLive: boolean;
  locked: boolean;
}

// The single Pro gate. Every Pro-only surface asks the same question through
// this hook: is this content locked for the current viewer?
//   locked = self-serve checkout is live AND the viewer is not entitled.
// Entitled users always pass through. While checkout is not yet live (the
// waitlist phase) nothing is locked, so behavior is unchanged until launch.
export function useProGate(): ProGate {
  const { isPro, isLoading } = useEntitlement();
  return {
    isPro,
    isLoading,
    checkoutLive: CHECKOUT_ENABLED,
    locked: CHECKOUT_ENABLED && !isPro,
  };
}
