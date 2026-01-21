-- Migration: 00004_remove_username.sql
-- Purpose: Remove username field from user_profiles
--
-- The username field was dropped as a concept - email is now used for
-- identification and displayName for display purposes.

-- Drop the username index first
DROP INDEX IF EXISTS idx_user_profiles_username;

-- Remove the username column
ALTER TABLE user_profiles DROP COLUMN IF EXISTS username;
