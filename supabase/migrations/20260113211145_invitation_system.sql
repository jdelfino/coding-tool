-- Migration: Invitation-based registration system
-- Epic: a0k - Replace open registration with controlled, invite/code-based onboarding

-- ============================================================================
-- 1. Add capacity columns to namespaces
-- ============================================================================

ALTER TABLE namespaces
  ADD COLUMN max_instructors INTEGER,  -- NULL = unlimited
  ADD COLUMN max_students INTEGER;     -- NULL = unlimited

COMMENT ON COLUMN namespaces.max_instructors IS 'Maximum instructors allowed (NULL = unlimited)';
COMMENT ON COLUMN namespaces.max_students IS 'Maximum students allowed (NULL = unlimited)';

-- ============================================================================
-- 2. Create invitations table
-- ============================================================================

-- Stores metadata for email invitations. Tokens are managed by Supabase Auth.
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  supabase_user_id UUID,  -- Links to auth.users after inviteUserByEmail() called
  target_role TEXT NOT NULL CHECK (target_role IN ('namespace-admin', 'instructor')),
  namespace_id TEXT NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,  -- Our 7-day tracking (vs Supabase 24h token expiry)
  consumed_at TIMESTAMPTZ,
  consumed_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ
);

COMMENT ON TABLE invitations IS 'Email invitation metadata - tokens managed by Supabase Auth';
COMMENT ON COLUMN invitations.supabase_user_id IS 'Supabase auth.users.id after inviteUserByEmail() called';
COMMENT ON COLUMN invitations.target_role IS 'Role to assign on acceptance: namespace-admin or instructor';
COMMENT ON COLUMN invitations.expires_at IS 'Our expiry window (7 days), independent of Supabase token (24h)';

-- Indexes for common query patterns
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_namespace ON invitations(namespace_id);
CREATE INDEX idx_invitations_supabase_user ON invitations(supabase_user_id);
CREATE INDEX idx_invitations_created_by ON invitations(created_by);
CREATE INDEX idx_invitations_status ON invitations(consumed_at, revoked_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;  -- Pending invitations

-- ============================================================================
-- 3. Enable RLS
-- ============================================================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS Policies for invitations
-- ============================================================================

-- System admins can see all invitations
-- Namespace admins can see invitations in their namespace
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (
    is_system_admin()
    OR (
      has_role('namespace-admin')
      AND namespace_id = get_user_namespace_id()
    )
  );

-- System admins can create invitations for any namespace/role
-- Namespace admins can create instructor invitations in their namespace
CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (
    is_system_admin()
    OR (
      has_role('namespace-admin')
      AND namespace_id = get_user_namespace_id()
      AND target_role = 'instructor'  -- Namespace admins can only invite instructors
    )
  );

-- System admins can update any invitation
-- Namespace admins can update invitations in their namespace
CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE USING (
    is_system_admin()
    OR (
      has_role('namespace-admin')
      AND namespace_id = get_user_namespace_id()
    )
  );

-- Only system admins can delete invitations
CREATE POLICY "invitations_delete" ON invitations
  FOR DELETE USING (is_system_admin());
