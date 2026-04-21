import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type ChangeCallback = (payload: { table: string; eventType: string; new: any; old: any }) => void;

const MONITORED_TABLES = ['fwi_scores', 'signals', 'cached_insights', 'data_source_health'] as const;

let channel: RealtimeChannel | null = null;
const listeners = new Set<ChangeCallback>();

function ensureChannel() {
  if (channel) return;

  channel = supabase
    .channel('pulse-data-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fwi_scores' },
      (payload) => broadcast('fwi_scores', payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'signals' },
      (payload) => broadcast('signals', payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cached_insights' },
      (payload) => broadcast('cached_insights', payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'data_source_health' },
      (payload) => broadcast('data_source_health', payload),
    )
    .subscribe();
}

function broadcast(table: string, payload: any) {
  for (const cb of listeners) {
    try {
      cb({ table, eventType: payload.eventType, new: payload.new, old: payload.old });
    } catch {
      // Swallow per-listener errors to avoid breaking others
    }
  }
}

/**
 * Subscribe to real-time database changes across all monitored tables.
 * Returns an unsubscribe function. The shared channel is torn down when
 * the last listener departs.
 */
export function onDataChange(cb: ChangeCallback): () => void {
  listeners.add(cb);
  ensureChannel();

  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}
