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
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="relative glass-card-elevated p-5 sm:p-6 overflow-hidden"
    >
      {/* soft brand wash anchoring the magic-moment surface */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-2.5 mb-1">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary shrink-0">
          <Sparkles size={15} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground tracking-tight leading-none">Ask the index</h2>
          <span className="text-[11px] text-muted-foreground">Your situation, this week's read</span>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); run(input); }}
        className="relative mt-4 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Fractional CMO in the US, deciding whether to raise rates"
          maxLength={280}
          className="flex-1 bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/55 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-surface transition-all"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="Get verdict"
          className="shrink-0 h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm disabled:opacity-40 disabled:shadow-none enabled:hover:-translate-y-0.5 enabled:hover:shadow-md transition-all"
        >
          {streaming ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
        </button>
      </form>

      {!asked && (
        <div className="relative flex flex-wrap gap-1.5 mt-3.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); run(s); }}
              className="group inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary bg-muted/40 hover:bg-primary/[0.06] border border-border hover:border-primary/40 rounded-full px-3 py-1.5 transition-all"
            >
              <span className="opacity-50 group-hover:opacity-100 transition-opacity">+</span>
              {s.length > 40 ? s.slice(0, 40) + '...' : s}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {asked && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="relative mt-4 pt-4 border-t border-hairline"
          >
            <p className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {verdict}
              {streaming && <span className="inline-block w-[3px] h-[1.05em] -mb-[0.15em] ml-0.5 rounded-full bg-primary animate-pulse" />}
            </p>
            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 mt-3.5">
              <span className="w-1 h-1 rounded-full bg-success" />
              Grounded in this week's FWI. A weekly index, not financial advice.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VerdictLine;
