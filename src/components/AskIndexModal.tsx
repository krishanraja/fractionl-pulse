import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Loader2, MessageCircleQuestion, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { useMediaQuery } from '@/hooks/use-mobile';
import { emitEvent } from '@/lib/attribution';
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase';

const SUGGESTIONS = [
  'I am a fractional CMO in the US. Should I raise my rates?',
  'I am a fractional CFO. Is this a good time to find new clients?',
  'I run a boutique agency. Should I hire more fractional executives this quarter?',
];

interface AskIndexModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRole?: string | null;
  initialPrompt?: string;
}

const AskIndexModal = ({ open, onOpenChange, defaultRole, initialPrompt = '' }: AskIndexModalProps) => {
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [asked, setAsked] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const answerRef = useRef<HTMLDivElement | null>(null);

  const isCompact = useMediaQuery('(max-width: 1023.98px)');
  const visualViewport = useVisualViewport(open);
  const compactViewportStyle = isCompact && visualViewport.height
    ? { height: visualViewport.height, maxHeight: visualViewport.height, top: visualViewport.offsetTop }
    : undefined;

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setStreaming(false);
      return;
    }
    setInput(initialPrompt);
    setAsked(false);
    setVerdict('');
  }, [initialPrompt, open]);

  useEffect(() => {
    if (!asked) return;
    const frame = window.requestAnimationFrame(() => {
      answerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [asked]);

  const run = async (situation: string) => {
    let text = situation.trim();
    if (!text || streaming) return;

    if (defaultRole && !/\b(cmo|cfo|cto|coo|cro|ceo|fractional|interim)\b/i.test(text)) {
      text = `${text} (I am a ${defaultRole})`;
    }

    inputRef.current?.blur();
    setAsked(true);
    setStreaming(true);
    setVerdict('');
    void emitEvent('activated', { via: 'verdict_line' });

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/fwi-verdict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation: text }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        setVerdict('The index is catching its breath. Check the current score or try again in a moment.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const chunk = JSON.parse(payload);
            if (typeof chunk === 'string') setVerdict((current) => current + chunk);
          } catch {
            // Ignore incomplete server-sent event chunks and continue streaming.
          }
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        setVerdict('The index is catching its breath. Try again in a moment.');
      }
    } finally {
      if (!controller.signal.aborted) setStreaming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="pulse-overlay-theme pulse-ask-surface"
        overlayClassName="pulse-overlay-backdrop"
        hideDefaultClose
        style={compactViewportStyle}
      >
        <header className="pulse-overlay-header">
          <div className="pulse-overlay-heading-mark" aria-hidden="true">
            <MessageCircleQuestion />
          </div>
          <div>
            <DialogTitle>Ask the Index</DialogTitle>
            <DialogDescription>Describe the decision you are making. Pulse will explain what this week's data can support.</DialogDescription>
          </div>
          <DialogClose className="pulse-overlay-close" aria-label="Close Ask the Index">
            <X aria-hidden="true" />
          </DialogClose>
        </header>

        <div className="pulse-ask-scroll">
          {!asked && (
            <section className="pulse-ask-intro" aria-labelledby="ask-suggestions-heading">
              <p id="ask-suggestions-heading">Start with your role, location, and the decision in front of you.</p>
              <div className="pulse-ask-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInput(suggestion);
                      void run(suggestion);
                    }}
                  >
                    <span>{suggestion}</span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <AnimatePresence initial={false}>
            {asked && (
              <motion.div
                ref={answerRef}
                className="pulse-ask-answer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                role="region"
                aria-live="polite"
                aria-busy={streaming}
              >
                <span>What the data suggests</span>
                <p>
                  {verdict || (streaming ? "Reading this week's data..." : '')}
                  {streaming && verdict && <i aria-hidden="true" />}
                </p>
                <small>Based on this week's Fractional Working Index. This is a market reading, not financial advice.</small>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form
          className="pulse-ask-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void run(input);
          }}
        >
          <label htmlFor="ask-index-situation">What are you deciding?</label>
          <div>
            <input
              ref={inputRef}
              id="ask-index-situation"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Should I raise my rates?"
              maxLength={280}
              autoFocus
              autoComplete="off"
              enterKeyHint="go"
            />
            <button type="submit" disabled={streaming || !input.trim()} aria-label="Ask the Index">
              {streaming ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            </button>
          </div>
          <small>{input.length}/280</small>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AskIndexModal;
