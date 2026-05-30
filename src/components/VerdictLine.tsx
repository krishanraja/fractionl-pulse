import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase';
import { emitEvent } from '@/lib/attribution';

const SUGGESTIONS = [
  'Fractional CMO in the US, deciding whether to raise my rates',
  'Fractional CFO, is now a good time to find new clients',
  'Boutique agency, should I hire more fractional execs this quarter',
];

// The Verdict Line: a visitor types one line about their situation and Pulse
// streams back a personalized, chart-evidenced verdict grounded in this week's
// real FWI. This is the magic moment and the primary activation surface.
const VerdictLine = () => {
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [asked, setAsked] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = async (situation: string) => {
    const text = situation.trim();
    if (!text || streaming) return;
    setAsked(true);
    setStreaming(true);
    setVerdict('');
    void emitEvent('activated', { via: 'verdict_line' });

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/fwi-verdict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation: text }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        setVerdict('The index is catching its breath. Check the live number below, or try again in a moment.');
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const chunk = JSON.parse(payload);
            if (typeof chunk === 'string') setVerdict((v) => v + chunk);
          } catch { /* ignore */ }
        }
      }
    } catch {
      if (!ac.signal.aborted) setVerdict('The index is catching its breath. Try again in a moment.');
    } finally {
      setStreaming(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card-elevated p-5 sm:p-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Ask the index</h2>
        <span className="text-[11px] text-muted-foreground">your situation, this week's read</span>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); run(input); }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Fractional CMO in the US, deciding whether to raise rates"
          maxLength={280}
          className="flex-1 bg-background/60 border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="Get verdict"
          className="shrink-0 h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition"
        >
          {streaming ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        </button>
      </form>

      {!asked && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); run(s); }}
              className="text-[11px] text-muted-foreground hover:text-primary border border-border hover:border-primary/40 rounded-full px-2.5 py-1 transition-colors"
            >
              {s.length > 42 ? s.slice(0, 42) + '...' : s}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {asked && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-4 border-t border-border"
          >
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {verdict}
              {streaming && <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-primary animate-pulse" />}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-3">
              Grounded in this week's FWI. A weekly index, not financial advice.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VerdictLine;
