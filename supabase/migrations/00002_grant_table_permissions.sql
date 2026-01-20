-- ============================================================================
-- GRANT TABLE PERMISSIONS
-- ============================================================================
-- Grant necessary permissions to service_role and authenticated roles.
--
-- service_role: Used by the server (via SUPABASE_SECRET_KEY) - needs full access
-- authenticated: Minimal grants for client-side Realtime subscriptions only
-- anon: No table access (all operations require authentication)
--
-- All mutations go through API routes using service_role, so authenticated
-- users only need SELECT for Realtime subscriptions.
--
-- This migration first REVOKEs all permissions to ensure a clean slate,
-- then applies only the minimal required grants. This ensures dev/prod parity.
-- ============================================================================

-- ============================================================================
-- REVOKE ALL (clean slate for consistent permissions)
-- ============================================================================

-- Revoke all table permissions from authenticated and anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Clear default privileges for authenticated and anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- ============================================================================
-- SERVICE_ROLE GRANTS (full access for server-side operations)
-- ============================================================================

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
