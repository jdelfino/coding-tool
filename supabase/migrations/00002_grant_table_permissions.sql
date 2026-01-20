-- ============================================================================
-- GRANT TABLE PERMISSIONS
-- ============================================================================
-- Grant necessary permissions to service_role and authenticated roles.
-- service_role: Used by the server (via SUPABASE_SECRET_KEY) - needs full access
-- authenticated: Used by logged-in users - access controlled by RLS policies
-- ============================================================================

-- Grant all permissions on all existing tables to service_role
-- This allows the server to bypass RLS and perform any operation
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant basic permissions to authenticated users
-- Actual access is controlled by RLS policies defined in 00001_initial_schema.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure future tables also get proper permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
