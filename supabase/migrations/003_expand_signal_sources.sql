-- Expand signal types to include 'context' for macro-economic enrichment signals (FRED, Census)
-- These signals are stored but excluded from the FWI composite score.

ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_signal_type_check;
ALTER TABLE signals ADD CONSTRAINT signals_signal_type_check 
  CHECK (signal_type IN ('demand', 'supply', 'momentum', 'context'));

-- Expand movers signal_type to include context
ALTER TABLE movers DROP CONSTRAINT IF EXISTS movers_signal_type_check;
ALTER TABLE movers ADD CONSTRAINT movers_signal_type_check 
  CHECK (signal_type IN ('demand', 'supply', 'momentum', 'context'));

-- Add initial data_source_health records for new sources (ON CONFLICT to be safe)
INSERT INTO data_source_health (source, status, metadata) VALUES
  ('serpapi_jobs', 'unknown', '{"description": "SerpAPI Google Jobs - demand cross-check"}'),
  ('serpapi_trends', 'unknown', '{"description": "SerpAPI Google Trends - faster than Apify"}'),
  ('serpapi_linkedin', 'unknown', '{"description": "SerpAPI LinkedIn supply proxy"}'),
  ('serpapi_supply_trends', 'unknown', '{"description": "SerpAPI supply-intent trends"}'),
  ('mediastack', 'unknown', '{"description": "Mediastack news API - culture cross-check"}'),
  ('guardian', 'unknown', '{"description": "The Guardian API - prestige media"}'),
  ('nyt', 'unknown', '{"description": "NYT Article Search - prestige media"}'),
  ('podchaser', 'unknown', '{"description": "Podchaser GraphQL - podcast mentions"}'),
  ('reddit', 'unknown', '{"description": "Reddit via Apify scraper - community discourse"}'),
  ('hn', 'unknown', '{"description": "Hacker News Algolia API - tech discourse"}'),
  ('gofractional', 'unknown', '{"description": "GoFractional marketplace via Apify - supply"}'),
  ('fred', 'unknown', '{"description": "FRED macro series - context enrichment"}'),
  ('census_acs', 'unknown', '{"description": "Census ACS self-employment - context enrichment"}'),
  ('brave_news', 'unknown', '{"description": "Brave News Search - media coverage"}'),
  ('brave_web', 'unknown', '{"description": "Brave Web Search - discourse volume"}'),
  ('people_data_labs', 'unknown', '{"description": "PDL professional profiles - supply"}'),
  ('supply_trends', 'unknown', '{"description": "Supply-side search interest via Apify Trends"}')
ON CONFLICT (source) DO NOTHING;
