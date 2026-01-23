-- ============================================================================
-- MAKE user_id REQUIRED IN session_students
-- ============================================================================
-- This migration makes user_id NOT NULL in session_students table.
-- The user_id is required for RLS policies to allow students to update their own rows.
--
-- IMPORTANT: This migration will fail if there's existing data with NULL user_id.
-- Existing data should be deleted before applying (we're not live yet).
-- ============================================================================

-- Make user_id NOT NULL
ALTER TABLE session_students ALTER COLUMN user_id SET NOT NULL;
