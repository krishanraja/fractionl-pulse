import { useState, useEffect, createContext, useContext, createElement } from 'react';
import { createClient, type User, type Session } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dtlcprcpvdomrehbejhw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bGNwcmNwdmRvbXJlaGJlamh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MTM3ODEsImV4cCI6MjA2OTM4OTc4MX0.bSvVAJb5Y2Tszq_AcvAHaNeJs5m--kFlRH4XZ2dfP_8'
);

export { supabase };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  joinWaitlist: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Waitlist: just insert email into a waitlist table (no auth required)
  const joinWaitlist = async (email: string) => {
    const { error } = await supabase
      .from('waitlist')
      .upsert({ email, joined_at: new Date().toISOString() }, { onConflict: 'email' });
    return { error: error?.message ?? null };
  };

  const value: AuthContextType = {
    user, session, isLoading,
    signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, joinWaitlist,
  };

  return createElement(AuthContext.Provider, { value }, props.children);
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
