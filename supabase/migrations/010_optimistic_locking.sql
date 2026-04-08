-- Migration 010: Add version column to allocations for optimistic locking

ALTER TABLE allocations ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Trigger: auto-increment version on every UPDATE
CREATE OR REPLACE FUNCTION increment_allocation_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS allocations_version_trigger ON allocations;
CREATE TRIGGER allocations_version_trigger
  BEFORE UPDATE ON allocations
  FOR EACH ROW EXECUTE FUNCTION increment_allocation_version();
