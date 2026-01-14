-- Rename session_sandboxes to session_backend_state
-- Migration: 20260114220000_rename_session_backend_state.sql
-- Created: 2026-01-14
--
-- This migration generalizes the session_sandboxes table to support
-- multiple backend types (Vercel Sandbox, Docker, etc.)

-- ============================================================================
-- RENAME TABLE
-- ============================================================================

ALTER TABLE session_sandboxes RENAME TO session_backend_state;

-- ============================================================================
-- ADD BACKEND_TYPE COLUMN
-- ============================================================================

-- Add backend_type column for explicit backend tracking
ALTER TABLE session_backend_state
ADD COLUMN backend_type TEXT NOT NULL DEFAULT 'vercel-sandbox';

-- Rename sandbox_id to state_id for generality (different backends store different IDs)
ALTER TABLE session_backend_state
RENAME COLUMN sandbox_id TO state_id;

-- ============================================================================
-- UPDATE COMMENTS
-- ============================================================================

COMMENT ON TABLE session_backend_state IS 'Backend state per session for code execution';
COMMENT ON COLUMN session_backend_state.backend_type IS 'Backend type: vercel-sandbox, local-python, docker, etc.';
COMMENT ON COLUMN session_backend_state.state_id IS 'Backend-specific identifier (sandbox ID, container ID, etc.)';
