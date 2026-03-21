-- Defensible signal stack migration for Fractionl Pulse
-- Creates tables for 4-source data collection: Adzuna + Google Trends + SEC EDGAR + NewsAPI

-- Updated signals table with metadata support
DROP TABLE IF EXISTS signals CASCADE;
CREATE TABLE signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  source text NOT NULL, -- 'adzuna', 'google_trends', 'sec_edgar', 'newsapi'
  signal_type text NOT NULL CHECK (signal_type IN ('demand', 'supply', 'momentum')),
  category text NOT NULL, -- role names, 'vc_pipeline', 'search_interest', etc.
  normalized_value numeric(5,2) NOT NULL CHECK (normalized_value >= 0 AND normalized_value <= 100),
  raw_value numeric(10,2),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX signals_date_source_category_idx 
ON signals(date, source, signal_type, category);

CREATE INDEX signals_date_type_idx ON signals(date, signal_type);

-- Enhanced fwi_scores table
DROP TABLE IF EXISTS fwi_scores CASCADE;
CREATE TABLE fwi_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  overall_score numeric(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  demand_score numeric(5,2) NOT NULL CHECK (demand_score >= 0 AND demand_score <= 100),
  supply_score numeric(5,2) NOT NULL CHECK (supply_score >= 0 AND supply_score <= 100),
  momentum_score numeric(5,2) NOT NULL CHECK (momentum_score >= 0 AND momentum_score <= 100),
  weights jsonb DEFAULT '{"demand": 0.5, "supply": 0.2, "momentum": 0.3}',
  confidence numeric(3,2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Movers table (updated to use 'skill' column consistently)
DROP TABLE IF EXISTS movers CASCADE;
CREATE TABLE movers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  skill text NOT NULL, -- 'Fractional CFO', 'VC Funding Pipeline', etc.
  signal_type text NOT NULL CHECK (signal_type IN ('demand', 'supply', 'momentum')),
  change_pct numeric(6,2),
  note text,
  rank integer CHECK (rank >= 1),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX movers_date_rank_idx ON movers(date, rank);

-- Cached insights table (AI-generated insights)
DROP TABLE IF EXISTS cached_insights CASCADE;
CREATE TABLE cached_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  insights_json jsonb NOT NULL,
  generated_at timestamptz DEFAULT now(),
  valid_until timestamptz,
  model text DEFAULT 'gpt-4o-mini',
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX cached_insights_valid_until_idx ON cached_insights(valid_until);

-- Pipeline execution tracking
DROP TABLE IF EXISTS pipeline_runs CASCADE;
CREATE TABLE pipeline_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL, -- 'ingest-signals', 'calculate-fwi', 'generate-insights'
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  records_inserted integer DEFAULT 0,
  confidence numeric(3,2),
  error text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX pipeline_runs_started_at_idx ON pipeline_runs(started_at DESC);
CREATE INDEX pipeline_runs_source_status_idx ON pipeline_runs(source, status);

-- Data source health monitoring
DROP TABLE IF EXISTS data_source_health CASCADE;
CREATE TABLE data_source_health (
  source text PRIMARY KEY, -- 'adzuna', 'google_trends', 'sec_edgar', 'newsapi'
  last_checked timestamptz,
  last_success timestamptz,
  status text DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'failed', 'unknown')),
  error_count integer DEFAULT 0,
  avg_response_time_ms numeric(8,2),
  metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- API keys table for future agent access
DROP TABLE IF EXISTS api_keys CASCADE;
CREATE TABLE api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key_hash text NOT NULL UNIQUE,
  label text,
  tier text DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  requests_used integer DEFAULT 0,
  requests_limit integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  is_active boolean DEFAULT true
);

CREATE INDEX api_keys_hash_idx ON api_keys(key_hash) WHERE is_active = true;

-- Row Level Security (RLS) policies
ALTER TABLE fwi_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE movers ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Public read access for FWI data (agent-friendly)
CREATE POLICY "Public read fwi_scores" 
ON fwi_scores FOR SELECT 
USING (true);

CREATE POLICY "Public read movers" 
ON movers FOR SELECT 
USING (true);

CREATE POLICY "Public read cached_insights" 
ON cached_insights FOR SELECT 
USING (true);

CREATE POLICY "Public read data_source_health" 
ON data_source_health FOR SELECT 
USING (true);

-- Service role access for data ingestion
CREATE POLICY "Service full access signals" 
ON signals FOR ALL 
USING (true);

CREATE POLICY "Service full access fwi_scores" 
ON fwi_scores FOR ALL 
USING (true);

CREATE POLICY "Service full access movers" 
ON movers FOR ALL 
USING (true);

CREATE POLICY "Service full access cached_insights" 
ON cached_insights FOR ALL 
USING (true);

CREATE POLICY "Service full access pipeline_runs" 
ON pipeline_runs FOR ALL 
USING (true);

CREATE POLICY "Service full access data_source_health" 
ON data_source_health FOR ALL 
USING (true);

CREATE POLICY "Service read api_keys" 
ON api_keys FOR SELECT 
USING (true);

-- Insert initial data source health records
INSERT INTO data_source_health (source, status, metadata) VALUES 
('adzuna', 'unknown', '{"description": "Job postings API for fractional roles", "rate_limit": "200/hour"}'),
('google_trends', 'unknown', '{"description": "Search interest trends via Apify", "estimated_runtime": "30-60s"}'),
('sec_edgar', 'unknown', '{"description": "SEC Form D filings for VC activity", "rate_limit": "10/second"}'),
('newsapi', 'unknown', '{"description": "News article coverage", "rate_limit": "1000/day"}');