import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { onDataChange } from '@/lib/realtime';

export interface RadarAngle { topic?: string; angle: string; format: string; rationale: string; }
export interface RadarTopic {
  label: string; slug: string; taxonomy?: string; summary?: string; role?: string;
  radar_score: number; velocity?: number; novelty?: number; is_breakout?: boolean;
  sources?: string[]; example_docs?: { text: string; url?: string; source?: string }[];
  angles?: RadarAngle[];
}
export interface RadarQuestion { question: string; topic_slug?: string | null; is_new?: boolean; }

export interface ContentRadarData {
  weekStart: string | null;
  hasRadar: boolean;
  confidence: number | null;
  generatedAt: string | null;
  topics: RadarTopic[];
  questions: RadarQuestion[];
  angles: RadarAngle[];
  saturated: string[];
  stats: Record<string, unknown> | null;
}

interface RadarBrief {
  rising_topics?: RadarTopic[];
  breakout_questions?: string[];
  priority_angles?: RadarAngle[];
  saturated?: string[];
  stats?: Record<string, unknown>;
}

const EMPTY: ContentRadarData = {
  weekStart: null, hasRadar: false, confidence: null, generatedAt: null,
  topics: [], questions: [], angles: [], saturated: [], stats: null,
};

async function fetchRadar(): Promise<ContentRadarData> {
  const { data: brief } = await supabase
    .from('content_briefs')
    .select('week_start, brief_json, confidence, generated_at')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brief) return EMPTY;

  const weekStart = brief.week_start as string;
  const bj = (brief.brief_json || {}) as RadarBrief;

  // Full ranked topic list + all questions for this week (Pro view); brief_json is the curated top set.
  const [{ data: topicRows }, { data: questionRows }] = await Promise.all([
    supabase.from('content_topics')
      .select('label, slug, taxonomy, summary, role, radar_score, velocity, novelty, is_breakout, sources, example_docs, angles')
      .eq('week_start', weekStart).eq('is_seed', false)
      .order('radar_score', { ascending: false }),
    supabase.from('content_questions')
      .select('question, topic_slug, is_new')
      .eq('week_start', weekStart)
      .order('is_new', { ascending: false }),
  ]);

  const topics: RadarTopic[] = (topicRows && topicRows.length)
    ? topicRows.map((topic) => ({ ...topic, radar_score: Number(topic.radar_score) || 0 }))
    : (bj.rising_topics || []).map((topic) => ({ ...topic, radar_score: Number(topic.radar_score) || 0 }));

  const questions: RadarQuestion[] = (questionRows && questionRows.length)
    ? questionRows
    : (bj.breakout_questions || []).map((q: string) => ({ question: q, is_new: true }));

  return {
    weekStart,
    hasRadar: topics.length > 0,
    confidence: brief.confidence != null ? Number(brief.confidence) : null,
    generatedAt: brief.generated_at as string,
    topics,
    questions,
    angles: (bj.priority_angles || []) as RadarAngle[],
    saturated: (bj.saturated || []) as string[],
    stats: bj.stats || null,
  };
}

export function useContentRadar() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['content-radar'],
    queryFn: fetchRadar,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const unsub = onDataChange((payload) => {
      if (payload.table === 'content_briefs' || payload.table === 'content_topics') {
        queryClient.invalidateQueries({ queryKey: ['content-radar'] });
      }
    });
    return unsub;
  }, [queryClient]);

  return {
    radar: data ?? EMPTY,
    isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['content-radar'] }),
  };
}
