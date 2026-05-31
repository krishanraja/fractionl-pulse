-- Content Radar: turns the raw text the pipeline already fetches into a weekly
-- content-insights surface (rising topics, breakout questions, angles, a brief).
-- Separate from the FWI: the FWI is a slow-moving LEVEL; the Radar is ranked DELTAS
-- over a vocabulary, which churn weekly even when the index sits flat.
-- Conventions mirror migrations 001/005/006: gen_random_uuid PK, jsonb metadata,
-- public-read RLS on curated outputs only, service-role full access on raw data.

-- 1. Raw harvested text items (the substrate). One row per document/term/question.
CREATE TABLE IF NOT EXISTS public.content_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL,                 -- ISO Monday, the radar period
  collected_at timestamptz DEFAULT now(),
  source text NOT NULL,                     -- serpapi_related, serpapi_paa, google_autocomplete, reddit, hn, newsapi, brave_news, brave_web, guardian, podchaser, ats_boards, youtube, marketplace
  doc_type text NOT NULL,                   -- search_term | headline | post_title | question | podcast_title | web_result | video_title | job_theme | listing
  text text NOT NULL,                       -- the actual headline / query / title
  url text,
  role text,                                -- cfo | cmo | cto | coo | cro | ceo | general (which fractional role the doc maps to, if any)
  rising_label text,                        -- e.g. '+250%' or 'Breakout' (Google rising bucket)
  rising_value numeric,                     -- extracted_value when present
  engagement numeric,                       -- reddit score / hn points / youtube views / null
  text_hash text NOT NULL,                  -- md5(lower(trim(text))) for dedup
  topic_id uuid,                            -- assigned during clustering, null until clustered
  raw jsonb DEFAULT '{}'::jsonb             -- provenance: query that found it, subreddit, etc.
);
CREATE UNIQUE INDEX IF NOT EXISTS content_signals_week_hash_idx ON public.content_signals(week_start, source, text_hash);
CREATE INDEX IF NOT EXISTS content_signals_week_idx ON public.content_signals(week_start);
CREATE INDEX IF NOT EXISTS content_signals_topic_idx ON public.content_signals(topic_id);

-- 2. Clustered + scored topics (the rising-topics output).
CREATE TABLE IF NOT EXISTS public.content_topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL,
  label text NOT NULL,                      -- LLM canonical label
  slug text NOT NULL,                       -- stable join key across weeks for velocity calc
  taxonomy text,                            -- seed bucket: pricing, ai, equity, fundraising, revops, hiring, tooling, regulation, other
  summary text,                             -- 1-2 sentence LLM summary of what changed
  doc_count integer DEFAULT 0,
  total_engagement numeric DEFAULT 0,
  velocity numeric,                         -- WoW delta in rank/volume, signed
  novelty numeric,                          -- 0-1, 1 = brand new this week
  radar_score numeric CHECK (radar_score >= 0 AND radar_score <= 100),
  is_breakout boolean DEFAULT false,        -- any member doc carried Google 'Breakout'
  is_seed boolean DEFAULT false,            -- taxonomy seed row, excluded from ranking
  role text,                                -- dominant fractional role for this topic, if any
  angles jsonb DEFAULT '[]'::jsonb,         -- [{angle, format, rationale}]
  sources text[],                           -- distinct sources contributing
  example_docs jsonb DEFAULT '[]'::jsonb,   -- [{text,url,source}] top few for UI/agent
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS content_topics_week_slug_idx ON public.content_topics(week_start, slug);
CREATE INDEX IF NOT EXISTS content_topics_week_score_idx ON public.content_topics(week_start, radar_score DESC);
CREATE INDEX IF NOT EXISTS content_topics_slug_idx ON public.content_topics(slug);

-- 3. Synthesized breakout questions.
CREATE TABLE IF NOT EXISTS public.content_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL,
  question text NOT NULL,                   -- canonical LLM-synthesized question
  topic_slug text,                          -- soft link to a topic
  role text,
  source_count integer DEFAULT 1,           -- how many raw docs collapsed into it
  is_new boolean DEFAULT true,              -- not seen in prior weeks
  rising_label text,                        -- carried from the rising bucket if applicable
  example_sources jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_questions_week_idx ON public.content_questions(week_start);

-- 4. The weekly agent-ready brief (one row per week).
CREATE TABLE IF NOT EXISTS public.content_briefs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL UNIQUE,
  brief_md text NOT NULL,                   -- rendered markdown
  brief_json jsonb NOT NULL,               -- {rising_topics[], breakout_questions[], priority_angles[], saturated[]}
  model text DEFAULT 'gpt-4o-mini',
  topic_count integer,
  question_count integer,
  doc_count integer,
  confidence numeric,                       -- share of expected sources that returned data
  generated_at timestamptz DEFAULT now(),
  valid_until timestamptz,                  -- same freshness discipline as cached_insights
  metadata jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS content_briefs_week_idx ON public.content_briefs(week_start DESC);

-- 5. Subscribers for the (dormant) weekly content-brief email.
CREATE TABLE IF NOT EXISTS public.content_brief_subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  source text DEFAULT 'manual',             -- where the subscriber came from
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS: public read on curated outputs only; raw signals + subscribers service-only.
-- ============================================================
ALTER TABLE public.content_signals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_topics           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_briefs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_brief_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read content_topics"    ON public.content_topics;
DROP POLICY IF EXISTS "Public read content_questions" ON public.content_questions;
DROP POLICY IF EXISTS "Public read content_briefs"    ON public.content_briefs;
CREATE POLICY "Public read content_topics"    ON public.content_topics    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read content_questions" ON public.content_questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read content_briefs"    ON public.content_briefs    FOR SELECT TO anon, authenticated USING (true);

-- Service role bypasses RLS, but be explicit (matches the rest of the schema's posture).
DROP POLICY IF EXISTS "Service all content_signals"           ON public.content_signals;
DROP POLICY IF EXISTS "Service all content_topics"            ON public.content_topics;
DROP POLICY IF EXISTS "Service all content_questions"         ON public.content_questions;
DROP POLICY IF EXISTS "Service all content_briefs"            ON public.content_briefs;
DROP POLICY IF EXISTS "Service all content_brief_subscribers" ON public.content_brief_subscribers;
CREATE POLICY "Service all content_signals"           ON public.content_signals           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service all content_topics"            ON public.content_topics            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service all content_questions"         ON public.content_questions         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service all content_briefs"            ON public.content_briefs            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service all content_brief_subscribers" ON public.content_brief_subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Register the new content-layer sources in the existing health table so the
-- Data Pipeline card and instrumentation pick them up.
INSERT INTO public.data_source_health (source, status, metadata) VALUES
  ('serpapi_related',    'unknown', '{"description":"SerpAPI Google Trends RELATED_QUERIES rising/breakout (content)"}'::jsonb),
  ('serpapi_paa',        'unknown', '{"description":"SerpAPI Google related_questions / People Also Ask (content)"}'::jsonb),
  ('google_autocomplete','unknown', '{"description":"Google autocomplete long-tail question expansion (content)"}'::jsonb),
  ('ats_boards',         'unknown', '{"description":"Public ATS boards (Greenhouse/Lever/Ashby/Workable) job text (content)"}'::jsonb),
  ('youtube',            'unknown', '{"description":"YouTube Data API rising video titles (content)"}'::jsonb),
  ('marketplace',        'unknown', '{"description":"Fractional marketplace listing counts (content/supply)"}'::jsonb),
  ('bls_oews',           'unknown', '{"description":"BLS OEWS wage baseline (content/context)"}'::jsonb)
ON CONFLICT (source) DO NOTHING;

-- Seed taxonomy so week-1 clustering is coherent before history accumulates.
INSERT INTO public.content_topics (week_start, label, slug, taxonomy, is_seed, radar_score)
VALUES
  ('2000-01-03', 'Pricing & rates for fractional execs', 'pricing-rates', 'pricing', true, 0),
  ('2000-01-03', 'AI inside the finance/marketing/ops function', 'ai-in-function', 'ai', true, 0),
  ('2000-01-03', 'Equity & comp for fractional roles', 'equity-comp', 'equity', true, 0),
  ('2000-01-03', 'Fundraising & runway (the demand trigger)', 'fundraising-runway', 'fundraising', true, 0),
  ('2000-01-03', 'RevOps & go-to-market leadership', 'revops-gtm', 'revops', true, 0),
  ('2000-01-03', 'Fractional vs full-time vs interim', 'fractional-vs-fulltime', 'hiring', true, 0),
  ('2000-01-03', 'Tooling & tech stack for fractional work', 'tooling-stack', 'tooling', true, 0),
  ('2000-01-03', 'Regulation, compliance & risk', 'regulation-risk', 'regulation', true, 0),
  ('2000-01-03', 'Building a fractional practice (the supply side)', 'building-a-practice', 'other', true, 0)
ON CONFLICT (week_start, slug) DO NOTHING;
