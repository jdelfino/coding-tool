-- Fix foreign key relationship for section_memberships
-- Migration: 20260106000000_fix_section_memberships_fk.sql
-- Created: 2026-01-06
--
-- Issue: section_memberships.user_id references auth.users(id), but Supabase
-- query joins with user_profiles. Since user_profiles.id is also a FK to
-- auth.users(id), we need to establish the relationship explicitly.
--
-- Solution: Add a foreign key from section_memberships.user_id to user_profiles(id)
-- This allows Supabase to understand the relationship for join queries.

-- Drop the existing constraint to auth.users
ALTER TABLE section_memberships
  DROP CONSTRAINT section_memberships_user_id_fkey;

-- Add new constraint to user_profiles instead
-- This works because user_profiles.id is a FK to auth.users(id) with ON DELETE CASCADE
-- So the cascade behavior is preserved
ALTER TABLE section_memberships
  ADD CONSTRAINT section_memberships_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES user_profiles(id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT section_memberships_user_id_fkey ON section_memberships IS
  'References user_profiles instead of auth.users for proper Supabase joins';
