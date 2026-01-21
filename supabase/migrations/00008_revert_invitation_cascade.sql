-- Migration: Revert to CASCADE for supabase_user_id
--
-- We want CASCADE because the resend flow now:
-- 1. Deletes orphaned auth user (CASCADE deletes invitation)
-- 2. Creates a fresh invitation record
--
-- This gives a cleaner audit trail - each resend is a new record.

ALTER TABLE invitations
  DROP CONSTRAINT invitations_supabase_user_id_fkey;

ALTER TABLE invitations
  ADD CONSTRAINT invitations_supabase_user_id_fkey
  FOREIGN KEY (supabase_user_id) REFERENCES auth.users(id)
  ON DELETE CASCADE;
