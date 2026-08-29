import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
// Legacy subscription entitlement reader. Pulse has no consumer paywall, but the
// table reader remains for compatibility with historical accounts and migrations.

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

// The human dashboard and public API are free. This gate never locks a public
// surface. The paid-product hypothesis is a separate partner benchmark built from
// privacy-safe first-party engagement data, so it must not reuse this consumer gate.
export function useProGate(): ProGate {
  const { isPro, isLoading } = useEntitlement();
  return {
    isPro,
    isLoading,
    checkoutLive: false,
    locked: false,
  };
}
