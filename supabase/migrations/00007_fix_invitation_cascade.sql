-- Migration: Fix supabase_user_id cascade behavior
--
-- The previous migration used CASCADE which deletes the invitation when
-- the orphaned auth user is cleaned up. We want SET NULL instead so the
-- invitation record is preserved and can be re-used.

ALTER TABLE invitations
  DROP CONSTRAINT invitations_supabase_user_id_fkey;

ALTER TABLE invitations
  ADD CONSTRAINT invitations_supabase_user_id_fkey
  FOREIGN KEY (supabase_user_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;
