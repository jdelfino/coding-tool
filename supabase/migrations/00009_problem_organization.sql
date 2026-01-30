-- ============================================================================
-- PROBLEM ORGANIZATION: REQUIRE class_id AND ADD TAGS
-- ============================================================================
-- This migration:
-- 1. Makes class_id NOT NULL (was nullable) — problems must belong to a class
-- 2. Adds a tags TEXT[] column for categorizing problems
-- 3. Creates a GIN index on tags for efficient array queries
--
-- IMPORTANT: Any existing problems with NULL class_id must be assigned
-- a class_id before running this migration.
-- ============================================================================

-- Delete any problems with NULL class_id (minimal prod data; safe to clean up)
DELETE FROM problems WHERE class_id IS NULL;

-- Make class_id required
ALTER TABLE problems ALTER COLUMN class_id SET NOT NULL;

-- Add tags column with empty array default
ALTER TABLE problems ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

-- GIN index for efficient tag queries (e.g., WHERE tags @> ARRAY['loops'])
CREATE INDEX idx_problems_tags ON problems USING GIN (tags);
