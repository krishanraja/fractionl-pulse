import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// Reads the signed-in user's Pulse Pro entitlement from the subscriptions table
// (RLS narrows to their own row). isPro drives Pro-feature gating in the app.
export function useEntitlement(): { isPro: boolean; isLoading: boolean } {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['entitlement', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('status, tier, current_period_end')
        .eq('user_id', user!.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      return data;
    },
  });

  const isPro = !!data && (data.status === 'active' || data.status === 'trialing');
  return { isPro, isLoading: !!user && isLoading };
}
