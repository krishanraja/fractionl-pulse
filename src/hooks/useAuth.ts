import { useState, useEffect, createContext, useContext, createElement } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { emitEvent } from '@/lib/attribution';

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
  // The table has joined_at with a default, so we only need to send email
  // Using insert instead of upsert because RLS only allows INSERT, not UPDATE
  const joinWaitlist = async (email: string) => {
    const { error } = await supabase
      .from('waitlist')
      .insert({ email });
    // If email already exists, treat as success (they're already on the list)
    if (!error || error.code === '23505') {
      // Record the conversion with first-touch attribution (no-ops until wired).
      void emitEvent('signed_up', { email });
      return { error: null };
    }
    return { error: error.message ?? null };
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
