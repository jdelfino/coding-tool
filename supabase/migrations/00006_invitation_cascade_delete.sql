-- Migration: Add cascading deletes to invitations table
-- When auth.users are deleted, clean up related invitations

-- 1. Add FK on supabase_user_id with CASCADE
--    (When invited user is deleted from auth.users, delete the invitation)
ALTER TABLE invitations
  ADD CONSTRAINT invitations_supabase_user_id_fkey
  FOREIGN KEY (supabase_user_id) REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- 2. Update created_by FK to SET NULL
--    (When admin who created invite is deleted, keep invitation but lose audit trail)
ALTER TABLE invitations
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE invitations
  DROP CONSTRAINT invitations_created_by_fkey;

ALTER TABLE invitations
  ADD CONSTRAINT invitations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- 3. Update consumed_by FK to SET NULL
--    (When user who accepted is deleted, keep invitation record but clear consumed_by)
ALTER TABLE invitations
  DROP CONSTRAINT invitations_consumed_by_fkey;

ALTER TABLE invitations
  ADD CONSTRAINT invitations_consumed_by_fkey
  FOREIGN KEY (consumed_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;
