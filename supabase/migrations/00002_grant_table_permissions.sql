-- ============================================================================
-- GRANT TABLE PERMISSIONS
-- ============================================================================
-- Grant necessary permissions to service_role and authenticated roles.
-- service_role: Used by the server (via SUPABASE_SECRET_KEY) - needs full access
-- authenticated: Used by logged-in users - grants match RLS policies (least privilege)
-- ============================================================================

-- service_role needs full access (bypasses RLS anyway)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Ensure future tables also get service_role permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- ============================================================================
-- AUTHENTICATED USER GRANTS (least privilege - matches RLS policies)
-- ============================================================================

-- Tables with SELECT, INSERT, UPDATE, DELETE policies
GRANT SELECT, INSERT, UPDATE, DELETE ON classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON problems TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON invitations TO authenticated;

-- Tables with SELECT, INSERT, UPDATE (no DELETE)
GRANT SELECT, INSERT, UPDATE ON namespaces TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON sections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON session_students TO authenticated;

-- Tables with SELECT, INSERT, DELETE (no UPDATE)
GRANT SELECT, INSERT, DELETE ON section_memberships TO authenticated;

-- Tables with SELECT, INSERT only
GRANT SELECT, INSERT ON revisions TO authenticated;

-- Sequences for auto-increment IDs
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
