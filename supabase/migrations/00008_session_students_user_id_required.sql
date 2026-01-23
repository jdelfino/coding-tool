-- ============================================================================
-- SIMPLIFY session_students: REMOVE student_id, USE user_id AS IDENTIFIER
-- ============================================================================
-- Previously session_students had both student_id (TEXT) and user_id (UUID).
-- This was redundant since:
-- 1. The app requires authentication to join sessions
-- 2. student_id was always set to user.id anyway
--
-- This migration:
-- 1. Makes user_id NOT NULL (was nullable)
-- 2. Removes the redundant student_id column
-- 3. Updates the unique constraint to use user_id
--
-- IMPORTANT: This migration will fail if there's existing data.
-- Delete existing session_students before applying (we're not live yet).
-- ============================================================================

-- Drop the old unique constraint
ALTER TABLE session_students DROP CONSTRAINT IF EXISTS session_students_session_id_student_id_key;

-- Make user_id NOT NULL
ALTER TABLE session_students ALTER COLUMN user_id SET NOT NULL;

-- Add new unique constraint on (session_id, user_id)
ALTER TABLE session_students ADD CONSTRAINT session_students_session_id_user_id_key UNIQUE (session_id, user_id);

-- Drop the redundant student_id column
ALTER TABLE session_students DROP COLUMN student_id;
