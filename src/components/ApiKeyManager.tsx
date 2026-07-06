import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, KeyRound, Trash2, Loader2 } from 'lucide-react';
import { supabase, SUPABASE_FUNCTIONS_URL } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface ApiKeyRow {
  id: string;
  label: string;
  tier: string;
  requests_used: number;
  requests_limit: number | null;
  is_active: boolean;
}

interface ApiKeyManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Self-serve API key issuance. The dashboard is free; the API is the paid wedge.
// A signed-in user mints a free-tier key (1k req/day) here and manages it. The
// plaintext key is shown exactly once.
const ApiKeyManager = ({ open, onOpenChange }: ApiKeyManagerProps) => {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function authFetch(method: string, body?: unknown, query = '') {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(`${SUPABASE_FUNCTIONS_URL}/manage-api-key${query}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function refresh() {
    setLoading(true);
    try {
      const res = await authFetch('GET');
      const j = await res.json();
      setKeys(j.keys ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (open && user) refresh(); if (!open) { setFreshKey(null); setCopied(false); } }, [open, user]);

  async function mint() {
    setMinting(true);
    try {
      const res = await authFetch('POST', { label: 'API key' });
      const j = await res.json();
      if (j.key) { setFreshKey(j.key); await refresh(); }
    } finally { setMinting(false); }
  }

  async function revoke(id: string) {
    await authFetch('DELETE', undefined, `?id=${encodeURIComponent(id)}`);
    await refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5 sm:p-6">
        <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound size={15} className="text-primary" /> API keys
        </DialogTitle>
        <p className="text-[11px] text-muted-foreground mt-1">
          The dashboard is free. Build on the metered API: free keys get 1,000 requests a day. For higher limits or data licensing, talk to us.
        </p>

        {!user ? (
          <div className="mt-5 text-center space-y-3 py-6">
            <p className="text-sm text-muted-foreground">Sign in to generate an API key.</p>
            <Link to="/login"><Button size="sm">Sign in</Button></Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {freshKey && (
              <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-3">
                <p className="text-[11px] font-semibold text-foreground">Your new key (shown once, copy it now)</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 text-[11px] break-all bg-muted/50 rounded px-2 py-1.5">{freshKey}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(freshKey); setCopied(true); }}
                    className="shrink-0 h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                    aria-label="Copy key"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">Use it as the <code>x-api-key</code> header on the API endpoints.</p>
              </div>
            )}

            <div className="space-y-2">
              {loading ? (
                <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Loading keys...</div>
              ) : keys.filter(k => k.is_active).length === 0 ? (
                <p className="text-xs text-muted-foreground">No active keys yet.</p>
              ) : (
                keys.filter(k => k.is_active).map((k) => (
                  <div key={k.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-foreground">{k.label}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground tabular-nums">
                        {k.tier} · {k.requests_used}/{k.requests_limit ?? '∞'} today
                      </span>
                    </div>
                    <button onClick={() => revoke(k.id)} className="shrink-0 text-muted-foreground hover:text-red-500" aria-label="Revoke key">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <Button onClick={mint} disabled={minting} className="w-full" size="sm">
              {minting ? <Loader2 size={15} className="animate-spin mr-2" /> : <KeyRound size={15} className="mr-2" />}
              Generate a new key
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeyManager;
