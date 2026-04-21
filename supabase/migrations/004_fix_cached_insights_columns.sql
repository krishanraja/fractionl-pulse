-- Fix schema drift: generate-pulse-insights writes `model_used` and `context`
-- but the original migration (001) defines `model` and `metadata`.
-- This migration adds the missing columns so both naming conventions work.

-- Add model_used as an alias column (keep original `model` for backwards compat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cached_insights' AND column_name = 'model_used'
  ) THEN
    ALTER TABLE cached_insights ADD COLUMN model_used text;
  END IF;
END $$;

-- Add context column (the edge function stores FWI context here)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cached_insights' AND column_name = 'context'
  ) THEN
    ALTER TABLE cached_insights ADD COLUMN context jsonb DEFAULT '{}';
  END IF;
END $$;

-- Backfill model_used from model where null
UPDATE cached_insights SET model_used = model WHERE model_used IS NULL AND model IS NOT NULL;

-- Create a sync trigger so writes to either column stay consistent
CREATE OR REPLACE FUNCTION sync_cached_insights_model()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.model_used IS NOT NULL AND NEW.model IS NULL THEN
    NEW.model := NEW.model_used;
  ELSIF NEW.model IS NOT NULL AND NEW.model_used IS NULL THEN
    NEW.model_used := NEW.model;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_model ON cached_insights;
CREATE TRIGGER trg_sync_model
  BEFORE INSERT OR UPDATE ON cached_insights
  FOR EACH ROW EXECUTE FUNCTION sync_cached_insights_model();
