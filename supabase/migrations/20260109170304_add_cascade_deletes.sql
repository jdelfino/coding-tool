-- Add CASCADE deletes to all foreign key constraints
-- Migration: 20260109170304_add_cascade_deletes.sql
--
-- This enables proper cleanup when deleting namespaces or users.
-- Deleting a namespace will cascade to all related data.
-- Deleting a user will cascade to all content they created.

-- ============================================================================
-- NAMESPACE CASCADE DELETES
-- ============================================================================
-- When a namespace is deleted, all data within it should be deleted.

-- user_profiles.namespace_id → namespaces(id)
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_namespace_id_fkey,
  ADD CONSTRAINT user_profiles_namespace_id_fkey
    FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE;

-- classes.namespace_id → namespaces(id)
ALTER TABLE classes
  DROP CONSTRAINT IF EXISTS classes_namespace_id_fkey,
  ADD CONSTRAINT classes_namespace_id_fkey
    FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE;

-- sections.namespace_id → namespaces(id)
ALTER TABLE sections
  DROP CONSTRAINT IF EXISTS sections_namespace_id_fkey,
  ADD CONSTRAINT sections_namespace_id_fkey
    FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE;

-- problems.namespace_id → namespaces(id)
ALTER TABLE problems
  DROP CONSTRAINT IF EXISTS problems_namespace_id_fkey,
  ADD CONSTRAINT problems_namespace_id_fkey
    FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE;

-- sessions.namespace_id → namespaces(id)
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_namespace_id_fkey,
  ADD CONSTRAINT sessions_namespace_id_fkey
    FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE;

-- revisions.namespace_id → namespaces(id)
ALTER TABLE revisions
  DROP CONSTRAINT IF EXISTS revisions_namespace_id_fkey,
  ADD CONSTRAINT revisions_namespace_id_fkey
    FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE;

-- ============================================================================
-- USER CASCADE DELETES
-- ============================================================================
-- When a user is deleted, content they created should be deleted.

-- namespaces.created_by → auth.users(id)
ALTER TABLE namespaces
  DROP CONSTRAINT IF EXISTS namespaces_created_by_fkey,
  ADD CONSTRAINT namespaces_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- classes.created_by → auth.users(id)
ALTER TABLE classes
  DROP CONSTRAINT IF EXISTS classes_created_by_fkey,
  ADD CONSTRAINT classes_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- problems.author_id → auth.users(id)
ALTER TABLE problems
  DROP CONSTRAINT IF EXISTS problems_author_id_fkey,
  ADD CONSTRAINT problems_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- sessions.creator_id → auth.users(id)
ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_creator_id_fkey,
  ADD CONSTRAINT sessions_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
