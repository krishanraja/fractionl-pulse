import { motion } from 'framer-motion';
import { Radar, TrendingUp, TrendingDown, Sparkles, Copy, Lock, Download, HelpCircle, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useContentRadar, type RadarTopic } from '@/hooks/useContentRadar';
import { useProGate } from '@/lib/entitlements';
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase';
import { emitEvent } from '@/lib/attribution';
import { staggerContainer, fadeInUp } from '@/lib/motion';

const FORMAT_LABEL: Record<string, string> = { linkedin: 'LinkedIn', newsletter: 'Newsletter', podcast: 'Podcast', blog: 'Blog' };

function ScorePill({ score, breakout }: { score: number; breakout?: boolean }) {
  const color = score >= 75 ? 'text-emerald-600 bg-emerald-500/10' : score >= 50 ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-muted';
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${color}`}>
      {breakout && <Rocket size={11} />}{score}
    </span>
  );
}

function TopicCard({ t, index }: { t: RadarTopic; index: number }) {
  const up = (t.velocity ?? 0) >= 0;
  return (
    <motion.div variants={fadeInUp} className="glass-card p-4 hover-lift">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xs font-bold text-muted-foreground/50 tabular-nums">{index + 1}</span>
          <h3 className="font-semibold text-foreground text-[13px] tracking-tight">{t.label}</h3>
        </div>
        <ScorePill score={Math.round(t.radar_score)} breakout={t.is_breakout} />
      </div>
      {t.summary && <p className="text-xs text-muted-foreground leading-relaxed mb-2">{t.summary}</p>}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
        <span className={`inline-flex items-center gap-0.5 font-medium ${up ? 'stat-up' : 'stat-down'}`}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? '+' : ''}{Math.round((t.velocity ?? 0) * 10) / 10}
        </span>
        {t.taxonomy && <span className="capitalize">{t.taxonomy}</span>}
        {t.role && t.role !== 'general' && <span className="uppercase">{t.role}</span>}
      </div>
      {t.example_docs && t.example_docs.length > 0 && (
        <p className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground/60 leading-relaxed line-clamp-2">
          why: {t.example_docs.slice(0, 2).map((e) => e.text).join(' · ')}
        </p>
      )}
    </motion.div>
  );
}

const ContentRadar = () => {
  const { radar, isLoading } = useContentRadar();
  const { locked } = useProGate();

  if (isLoading) {
    return (
      <div className="container-width py-5 space-y-4" aria-busy="true">
        <div className="skeleton-line h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="glass-card p-4 h-28 skeleton-line rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!radar.hasRadar) {
    return (
      <div className="container-width py-12 text-center space-y-3">
        <Radar size={28} className="mx-auto text-muted-foreground/30" />
        <h2 className="text-lg font-semibold text-foreground">The Content Radar is warming up</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Rising topics, breakout questions, and ready-to-write angles for fractional execs appear after the first weekly harvest. The first meaningful velocity reading lands in week two.
        </p>
      </div>
    );
  }

  const visibleTopics = locked ? radar.topics.slice(0, 3) : radar.topics;
  const downloadBrief = () => {
    void emitEvent('activated', { via: 'content_brief' });
    window.open(`${SUPABASE_FUNCTIONS_URL}/content-api/brief?format=markdown`, '_blank');
  };
  const copyAngle = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast.success('Angle copied')).catch(() => toast.error('Could not copy'));
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="container-width py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10"><Radar size={16} className="text-primary" /></div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground">Content Radar</h2>
            <p className="text-[10px] text-muted-foreground">
              What to publish this week{radar.weekStart ? ` · week of ${radar.weekStart}` : ''}
              {radar.confidence != null ? ` · ${Math.round(radar.confidence * 100)}% sources` : ''}
            </p>
          </div>
        </div>
        {!locked && (
          <button onClick={downloadBrief} className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-lg px-2.5 py-1.5 transition-colors shrink-0">
            <Download size={13} /> Brief
          </button>
        )}
      </div>

      {/* Rising topics */}
      <section>
        <div className="section-label mb-2">Rising topics</div>
        <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleTopics.map((t, i) => <TopicCard key={t.slug} t={t} index={i} />)}
        </motion.div>
      </section>

      {locked ? (
        <Link to="/pricing" className="block glass-card p-5 text-center hover-lift">
          <Lock size={18} className="mx-auto text-primary mb-2" />
          <div className="font-semibold text-foreground text-sm">Unlock the full Content Radar with Pro</div>
          <p className="text-xs text-muted-foreground mt-1">
            {radar.topics.length} rising topics, every breakout question, and ready-to-write angles with where to publish each one.
          </p>
        </Link>
      ) : (
        <>
          {/* Priority angles */}
          {radar.angles.length > 0 && (
            <section>
              <div className="section-label mb-2 flex items-center gap-1.5"><Sparkles size={12} /> Priority angles</div>
              <div className="space-y-2">
                {radar.angles.map((a, i) => (
                  <motion.div key={i} variants={fadeInUp} className="glass-card p-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{a.angle}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{a.rationale}</div>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                        <span className="data-badge bg-muted">{FORMAT_LABEL[a.format] || a.format}</span>
                        {a.topic && <span className="truncate">{a.topic}</span>}
                      </div>
                    </div>
                    <button onClick={() => copyAngle(a.angle)} aria-label="Copy angle" className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                      <Copy size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Breakout questions */}
          {radar.questions.length > 0 && (
            <section>
              <div className="section-label mb-2 flex items-center gap-1.5"><HelpCircle size={12} /> Breakout questions</div>
              <div className="glass-card p-4 space-y-1.5">
                {radar.questions.slice(0, 14).map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <span className="text-primary/60 mt-0.5">·</span>
                    <span>{q.question}{q.is_new && <span className="ml-1.5 text-[9px] uppercase font-bold text-emerald-600">new</span>}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Saturated */}
          {radar.saturated.length > 0 && (
            <section>
              <div className="section-label mb-2">Skip (saturated)</div>
              <div className="flex flex-wrap gap-1.5">
                {radar.saturated.map((s, i) => (
                  <span key={i} className="data-badge bg-muted text-muted-foreground line-through decoration-muted-foreground/40">{s}</span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </motion.div>
  );
};

export default ContentRadar;
