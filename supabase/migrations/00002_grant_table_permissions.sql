-- ============================================================================
-- GRANT TABLE PERMISSIONS
-- ============================================================================
-- Grant necessary permissions to service_role and authenticated roles.
--
-- service_role: Used by the server (via SUPABASE_SECRET_KEY) - needs full access
-- authenticated: Minimal grants for client-side Realtime subscriptions only
--
-- All mutations go through API routes using service_role, so authenticated
-- users only need SELECT for Realtime subscriptions.
-- ============================================================================

-- service_role needs full access (bypasses RLS anyway)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Ensure future tables also get service_role permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- ============================================================================
-- AUTHENTICATED USER GRANTS (minimal - Realtime subscriptions only)
-- ============================================================================
-- Client-side code only subscribes to these tables for real-time updates.
-- All mutations go through API routes with service_role.

GRANT SELECT ON sessions TO authenticated;
GRANT SELECT ON session_students TO authenticated;
GRANT SELECT ON revisions TO authenticated;
