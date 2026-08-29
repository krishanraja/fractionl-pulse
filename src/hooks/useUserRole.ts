import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// The user's primary fractional role. This is the one piece of personal signal
// the product captures, and it is what turns a global market index into a
// personal read ("your lane is +44% vs market"). Stored in localStorage for an
// instant client-side read, and best-effort persisted to user_profiles when the
// viewer is signed in (writing the business_type field that was previously
// captured nowhere and used nowhere).
export const FRACTIONAL_ROLES = [
  'Fractional CMO',
  'Fractional CFO',
  'Fractional CTO',
  'Fractional COO',
  'Fractional CRO',
  'Interim CEO',
] as const;

export type FractionalRole = (typeof FRACTIONAL_ROLES)[number];

const STORAGE_KEY = 'fwi_role';

export function useUserRole() {
  const [role, setRoleState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  // Hydrate from the server profile if the client has no role yet.
  useEffect(() => {
    if (role) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('user_profiles')
        .select('business_type')
        .eq('user_id', user.id)
        .maybeSingle();
      const stored = data?.business_type || user.user_metadata?.business_type;
      if (stored && !cancelled) {
        setRoleState(stored);
        try { localStorage.setItem(STORAGE_KEY, stored); } catch { /* ignore */ }
        if (!data?.business_type) {
          await supabase
            .from('user_profiles')
            .upsert({ user_id: user.id, email: user.email, business_type: stored }, { onConflict: 'user_id' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  const setRole = useCallback(async (next: string) => {
    setRoleState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    // Best-effort server persist so the role survives a new device. RLS scopes
    // the upsert to the caller's own row.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_profiles')
        .upsert({ user_id: user.id, email: user.email, business_type: next }, { onConflict: 'user_id' });
    }
  }, []);

  return { role, setRole };
}
