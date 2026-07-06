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

// The human dashboard is FREE. Pulse monetizes the metered agent/enterprise API,
// not a human paywall (the same read was already free and unauthenticated via the
// public API, so gating the UI protected nothing). This gate therefore never locks
// a human surface; it is retained so the entitlement plumbing and any future
// human tier can be reintroduced by flipping one function.
export function useProGate(): ProGate {
  const { isPro, isLoading } = useEntitlement();
  return {
    isPro,
    isLoading,
    checkoutLive: CHECKOUT_ENABLED,
    locked: false,
  };
}
