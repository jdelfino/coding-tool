-- Migration: 00007_remove_instructor_ids.sql
-- Purpose: Remove instructor_ids column from sections table
--
-- The instructor_ids array was a legacy approach. All instructor assignments
-- should now go through section_memberships with role='instructor'.
--
-- Steps:
-- 1. Migrate existing instructor_ids entries to section_memberships
-- 2. Update is_section_instructor() RLS function to only check memberships
-- 3. Drop the instructor_ids column

-- ============================================================================
-- STEP 1: Migrate instructor_ids to section_memberships
-- ============================================================================
-- For each section, ensure all instructor_ids entries have corresponding
-- section_memberships rows with role='instructor'.
-- Uses INSERT ... ON CONFLICT to be idempotent (safe to re-run).

INSERT INTO section_memberships (user_id, section_id, role)
SELECT DISTINCT
  unnest(s.instructor_ids) AS user_id,
  s.id AS section_id,
  'instructor' AS role
FROM sections s
WHERE array_length(s.instructor_ids, 1) > 0
ON CONFLICT (user_id, section_id) DO UPDATE
  SET role = 'instructor'
  WHERE section_memberships.role != 'instructor';

-- ============================================================================
-- STEP 2: Update is_section_instructor() RLS function
-- ============================================================================
-- Remove the OR condition that checks instructor_ids array.
-- Now only checks section_memberships table.

CREATE OR REPLACE FUNCTION is_section_instructor(section_id_param UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM section_memberships
    WHERE section_id = section_id_param
    AND user_id = auth.uid()
    AND role = 'instructor'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_section_instructor IS 'Returns true if authenticated user is instructor of the section (via section_memberships)';

-- ============================================================================
-- STEP 3: Drop instructor_ids column
-- ============================================================================

ALTER TABLE sections DROP COLUMN instructor_ids;
