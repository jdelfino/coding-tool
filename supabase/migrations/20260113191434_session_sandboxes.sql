-- Add session_sandboxes table for Vercel Sandbox integration
-- Migration: 20260113191434_session_sandboxes.sql
-- Created: 2026-01-13
--
-- This table stores sandbox IDs per session for reconnection across
-- serverless function invocations.

-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE session_sandboxes (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  sandbox_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE session_sandboxes IS 'Vercel Sandbox IDs per session for reconnection';
COMMENT ON COLUMN session_sandboxes.sandbox_id IS 'Vercel Sandbox instance ID';

-- ============================================================================
-- ENABLE RLS (deny all - service role bypasses)
-- ============================================================================

-- RLS enabled with no policies = deny all for authenticated/anon roles.
-- All access goes through API with service role which bypasses RLS.
-- If admin interfaces are needed later, add system-admin policies.
ALTER TABLE session_sandboxes ENABLE ROW LEVEL SECURITY;
