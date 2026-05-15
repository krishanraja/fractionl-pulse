import { createClient } from '@supabase/supabase-js';

// Public Supabase identifiers. The anon key is intended to be exposed in
// client bundles (RLS is the security boundary), so we keep safe defaults so
// the app loads even if env vars are missing on a deployment target.
const DEFAULT_SUPABASE_URL = 'https://dtlcprcpvdomrehbejhw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bGNwcmNwdmRvbXJlaGJlamh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4MTM3ODEsImV4cCI6MjA2OTM4OTc4MX0.bSvVAJb5Y2Tszq_AcvAHaNeJs5m--kFlRH4XZ2dfP_8';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
