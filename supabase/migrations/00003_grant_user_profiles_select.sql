-- ============================================================================
-- GRANT SELECT ON USER_PROFILES TO AUTHENTICATED
-- ============================================================================
-- This grant was missing from 00002_grant_table_permissions.sql when it was
-- first applied to production. The grant was added manually, but we need this
-- migration to ensure future deployments and fresh environments get it.
--
-- RLS policy "user_profiles_select" restricts access to:
-- - Own profile (id = auth.uid())
-- - Same namespace profiles
-- - System admins see all
-- ============================================================================

GRANT SELECT ON user_profiles TO authenticated;
