-- ============================================================================
-- GRANT MUTATION PERMISSIONS TO AUTHENTICATED ROLE
-- ============================================================================
-- This migration adds INSERT/UPDATE/DELETE grants to the authenticated role,
-- enabling RLS-backed access control as defense-in-depth.
--
-- Previously: All mutations went through API routes using service_role (bypasses RLS)
-- Now: Repositories can use authenticated client, with RLS policies enforcing access
--
-- RLS policies (defined in 00001_initial_schema.sql) control what rows users can:
-- - namespaces: Only system-admins can modify
-- - user_profiles: Users update own profile, admins create users
-- - classes: Instructors create/update/delete own classes
-- - sections: Section instructors manage their sections
-- - section_memberships: Users join/leave, instructors manage members
-- - problems: Authors manage their problems
-- - sessions: Creators and section instructors manage sessions
-- - session_students: Users manage own session state
-- - revisions: Users create revisions (immutable history)
-- - invitations: Namespace admins manage instructor invitations
-- ============================================================================

-- namespaces: Users can read own namespace, only system-admin can modify (RLS enforced)
GRANT SELECT, INSERT, UPDATE ON namespaces TO authenticated;
-- No DELETE - namespaces are never deleted (would cascade to all data)

-- user_profiles: Users update own, admins create (RLS enforced)
-- SELECT already granted in 00003_grant_user_profiles_select.sql
GRANT INSERT, UPDATE ON user_profiles TO authenticated;
-- No DELETE - user deletion goes through auth.users CASCADE

-- classes: Instructors manage own classes (RLS enforced)
GRANT SELECT, INSERT, UPDATE, DELETE ON classes TO authenticated;

-- sections: Section instructors manage (RLS enforced)
GRANT SELECT, INSERT, UPDATE, DELETE ON sections TO authenticated;

-- section_memberships: Users join/leave, instructors manage (RLS enforced)
GRANT SELECT, INSERT, DELETE ON section_memberships TO authenticated;
-- No UPDATE - memberships are join/leave only

-- problems: Authors manage own problems (RLS enforced)
GRANT SELECT, INSERT, UPDATE, DELETE ON problems TO authenticated;

-- sessions: Creators and instructors manage (RLS enforced)
-- SELECT already granted in 00002_grant_table_permissions.sql
GRANT INSERT, UPDATE ON sessions TO authenticated;
-- No DELETE - sessions are ended, not deleted

-- session_students: Users manage own state, instructors can update (RLS enforced)
-- SELECT already granted in 00002_grant_table_permissions.sql
GRANT INSERT, UPDATE ON session_students TO authenticated;
-- DELETE handled by session CASCADE

-- revisions: Users create revisions (RLS enforced)
-- SELECT already granted in 00002_grant_table_permissions.sql
-- Revisions are immutable history - no UPDATE or DELETE
GRANT INSERT ON revisions TO authenticated;

-- session_backend_state: Server-managed, service_role only
-- No grants for authenticated (API manages via service_role)

-- invitations: Admins manage (RLS enforced)
GRANT SELECT, INSERT, UPDATE, DELETE ON invitations TO authenticated;

-- Grant USAGE on sequences for INSERT operations
-- This is required for tables that use gen_random_uuid() or serial IDs
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
