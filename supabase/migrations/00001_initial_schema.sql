-- Initial schema for coding-tool Supabase integration
-- Migration: 00001_initial_schema.sql
-- Created: 2026-01-05
-- Last consolidated: 2026-01-19
--
-- This migration creates:
-- 1. All core tables (11 tables)
-- 2. Indexes for query performance
-- 3. RLS helper functions
-- 4. RLS policies for all tables
-- 5. Realtime configuration
-- 6. Updated_at triggers

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. namespaces - Multi-tenancy root
-- Each namespace represents an organization/institution
CREATE TABLE namespaces (
  id TEXT PRIMARY KEY,  -- URL-safe slug (e.g., 'stanford', 'mit')
  display_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  max_instructors INTEGER,  -- NULL = unlimited
  max_students INTEGER,     -- NULL = unlimited
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE namespaces IS 'Multi-tenancy root - each represents an organization';
COMMENT ON COLUMN namespaces.id IS 'URL-safe slug (kebab-case, e.g., stanford, mit)';
COMMENT ON COLUMN namespaces.max_instructors IS 'Maximum instructors allowed (NULL = unlimited)';
COMMENT ON COLUMN namespaces.max_students IS 'Maximum students allowed (NULL = unlimited)';

-- 2. user_profiles - Extends auth.users with application-specific data
-- Links to Supabase Auth users
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('system-admin', 'namespace-admin', 'instructor', 'student')),
  namespace_id TEXT REFERENCES namespaces(id) ON DELETE CASCADE,  -- NULL for system-admin
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,

  -- system-admin must NOT have namespace_id, others MUST have it
  CONSTRAINT valid_namespace_for_role CHECK (
    (role = 'system-admin' AND namespace_id IS NULL) OR
    (role != 'system-admin' AND namespace_id IS NOT NULL)
  )
);

COMMENT ON TABLE user_profiles IS 'Application user data extending Supabase Auth';
COMMENT ON COLUMN user_profiles.role IS 'User role: system-admin, namespace-admin, instructor, student';

CREATE INDEX idx_user_profiles_namespace ON user_profiles(namespace_id);
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- 3. classes - Course definitions
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id TEXT NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE classes IS 'Course definitions (e.g., CS 101, Data Structures)';

CREATE INDEX idx_classes_namespace ON classes(namespace_id);
CREATE INDEX idx_classes_created_by ON classes(created_by);

-- 4. sections - Class offerings with join codes
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id TEXT NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  semester TEXT,  -- e.g., 'Fall 2025', 'Spring 2026'
  instructor_ids UUID[] NOT NULL DEFAULT '{}',  -- Array of instructor user IDs
  join_code TEXT NOT NULL UNIQUE,  -- Format: ABC-123-XYZ
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sections IS 'Class sections - specific offerings with join codes';
COMMENT ON COLUMN sections.join_code IS 'Unique join code for students (format: ABC-123-XYZ)';

CREATE INDEX idx_sections_namespace ON sections(namespace_id);
CREATE INDEX idx_sections_class ON sections(class_id);
CREATE INDEX idx_sections_join_code ON sections(join_code);
CREATE INDEX idx_sections_active ON sections(active) WHERE active = true;

-- 5. section_memberships - Student/instructor enrollments
-- References user_profiles instead of auth.users for proper Supabase joins
CREATE TABLE section_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('instructor', 'student')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, section_id)
);

COMMENT ON TABLE section_memberships IS 'User enrollment in sections';
COMMENT ON CONSTRAINT section_memberships_user_id_fkey ON section_memberships IS
  'References user_profiles instead of auth.users for proper Supabase joins';

CREATE INDEX idx_memberships_user ON section_memberships(user_id);
CREATE INDEX idx_memberships_section ON section_memberships(section_id);
CREATE INDEX idx_memberships_role ON section_memberships(role);

-- 6. problems - Coding exercises
CREATE TABLE problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id TEXT NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starter_code TEXT,
  test_cases JSONB,  -- Array of test case objects (future: separate table)
  execution_settings JSONB,  -- ExecutionSettings: stdin, randomSeed, attachedFiles
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),  -- Optional: scope to specific class
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE problems IS 'Coding exercises/problems created by instructors';
COMMENT ON COLUMN problems.test_cases IS 'JSONB array of TestCase objects';
COMMENT ON COLUMN problems.execution_settings IS 'Default execution settings (stdin, etc.)';

CREATE INDEX idx_problems_namespace ON problems(namespace_id);
CREATE INDEX idx_problems_author ON problems(author_id);
CREATE INDEX idx_problems_class ON problems(class_id);
CREATE INDEX idx_problems_title ON problems(title);

-- 7. sessions - Active/historical coding sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id TEXT NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id),
  section_name TEXT NOT NULL,  -- Denormalized for display
  problem JSONB NOT NULL,  -- Snapshot of problem at session creation
  featured_student_id TEXT,  -- Student ID currently featured
  featured_code TEXT,  -- Featured student's code
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participants UUID[] NOT NULL DEFAULT '{}',  -- Array of user IDs who participated
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

COMMENT ON TABLE sessions IS 'Coding sessions - active and historical';
COMMENT ON COLUMN sessions.problem IS 'JSONB snapshot of the Problem at session creation';
COMMENT ON COLUMN sessions.status IS 'Session status: active or completed';

CREATE INDEX idx_sessions_namespace ON sessions(namespace_id);
CREATE INDEX idx_sessions_section ON sessions(section_id);
CREATE INDEX idx_sessions_creator ON sessions(creator_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_active ON sessions(status) WHERE status = 'active';
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity DESC);

-- 8. session_students - Runtime student state within a session
CREATE TABLE session_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,  -- Student identifier within session
  user_id UUID REFERENCES auth.users(id),  -- Link to auth user (if authenticated)
  name TEXT NOT NULL,  -- Display name
  code TEXT NOT NULL DEFAULT '',
  execution_settings JSONB,  -- Student-specific execution settings
  last_update TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(session_id, student_id)
);

COMMENT ON TABLE session_students IS 'Student state within active sessions';
COMMENT ON COLUMN session_students.student_id IS 'Session-local student identifier';

CREATE INDEX idx_session_students_session ON session_students(session_id);
CREATE INDEX idx_session_students_user ON session_students(user_id);

-- 9. revisions - Code history with diff compression
CREATE TABLE revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id TEXT NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,  -- Student identifier
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_diff BOOLEAN NOT NULL DEFAULT false,
  diff TEXT,  -- Diff patches if is_diff=true
  full_code TEXT,  -- Full code snapshot if is_diff=false
  base_revision_id UUID REFERENCES revisions(id),  -- Base for diff application
  execution_result JSONB,  -- Result of code execution: {success, output, error}

  -- Must have either diff or full_code
  CONSTRAINT valid_revision_content CHECK (
    (is_diff = true AND diff IS NOT NULL) OR
    (is_diff = false AND full_code IS NOT NULL)
  )
);

COMMENT ON TABLE revisions IS 'Student code revision history with optional diff compression';
COMMENT ON COLUMN revisions.is_diff IS 'true if storing diff, false if full snapshot';

CREATE INDEX idx_revisions_namespace ON revisions(namespace_id);
CREATE INDEX idx_revisions_session ON revisions(session_id);
CREATE INDEX idx_revisions_student ON revisions(session_id, student_id);
CREATE INDEX idx_revisions_timestamp ON revisions(timestamp DESC);

-- 10. session_backend_state - Backend state per session for code execution
CREATE TABLE session_backend_state (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  backend_type TEXT NOT NULL DEFAULT 'vercel-sandbox',
  state_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE session_backend_state IS 'Backend state per session for code execution';
COMMENT ON COLUMN session_backend_state.backend_type IS 'Backend type: vercel-sandbox, local-python, docker, etc.';
COMMENT ON COLUMN session_backend_state.state_id IS 'Backend-specific identifier (sandbox ID, container ID, etc.)';

-- 11. invitations - Email invitation metadata
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

CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_namespace ON invitations(namespace_id);
CREATE INDEX idx_invitations_supabase_user ON invitations(supabase_user_id);
CREATE INDEX idx_invitations_created_by ON invitations(created_by);
CREATE INDEX idx_invitations_status ON invitations(consumed_at, revoked_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;  -- Pending invitations

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

-- Get current user's namespace
CREATE OR REPLACE FUNCTION get_user_namespace_id()
RETURNS TEXT AS $$
  SELECT namespace_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_namespace_id IS 'Returns namespace_id for the authenticated user';

-- Check if current user is system admin
CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'system-admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_system_admin IS 'Returns true if authenticated user is system-admin';

-- Check if current user has a specific role
CREATE OR REPLACE FUNCTION has_role(r TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = r
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION has_role IS 'Returns true if authenticated user has the specified role';

-- Check if current user is instructor or higher
CREATE OR REPLACE FUNCTION is_instructor_or_higher()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('system-admin', 'namespace-admin', 'instructor')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_instructor_or_higher IS 'Returns true if user is instructor, namespace-admin, or system-admin';

-- Check if current user is member of a section
CREATE OR REPLACE FUNCTION is_section_member(section_id_param UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM section_memberships
    WHERE section_id = section_id_param AND user_id = auth.uid()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_section_member IS 'Returns true if authenticated user is enrolled in the section';

-- Check if current user is instructor of a section
CREATE OR REPLACE FUNCTION is_section_instructor(section_id_param UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM sections
    WHERE id = section_id_param AND auth.uid() = ANY(instructor_ids)
  ) OR EXISTS (
    SELECT 1 FROM section_memberships
    WHERE section_id = section_id_param
    AND user_id = auth.uid()
    AND role = 'instructor'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_section_instructor IS 'Returns true if authenticated user is instructor of the section';

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE namespaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_backend_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- namespaces policies
-- -----------------------------------------------------------------------------

-- Users see own namespace; system-admins see all
CREATE POLICY "namespaces_select" ON namespaces
  FOR SELECT USING (
    is_system_admin() OR id = get_user_namespace_id()
  );

-- Only system-admins can create namespaces
CREATE POLICY "namespaces_insert" ON namespaces
  FOR INSERT WITH CHECK (is_system_admin());

-- Only system-admins can update namespaces
CREATE POLICY "namespaces_update" ON namespaces
  FOR UPDATE USING (is_system_admin());

-- -----------------------------------------------------------------------------
-- user_profiles policies
-- -----------------------------------------------------------------------------

-- Users see profiles in same namespace; system-admins see all
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (
    is_system_admin()
    OR namespace_id = get_user_namespace_id()
    OR id = auth.uid()  -- Users can always see own profile
  );

-- Users can only update their own profile
CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- System admins and namespace admins can create users
CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (
    is_system_admin()
    OR (has_role('namespace-admin') AND namespace_id = get_user_namespace_id())
  );

-- -----------------------------------------------------------------------------
-- classes policies
-- -----------------------------------------------------------------------------

-- Namespace-scoped read
CREATE POLICY "classes_select" ON classes
  FOR SELECT USING (
    is_system_admin() OR namespace_id = get_user_namespace_id()
  );

-- Instructors+ can create classes in their namespace
CREATE POLICY "classes_insert" ON classes
  FOR INSERT WITH CHECK (
    is_instructor_or_higher()
    AND namespace_id = get_user_namespace_id()
  );

-- Authors can update their own classes
CREATE POLICY "classes_update" ON classes
  FOR UPDATE USING (
    created_by = auth.uid() OR is_system_admin()
  );

-- Authors can delete their own classes
CREATE POLICY "classes_delete" ON classes
  FOR DELETE USING (
    created_by = auth.uid() OR is_system_admin()
  );

-- -----------------------------------------------------------------------------
-- sections policies
-- -----------------------------------------------------------------------------

-- Namespace-scoped; students need to be members
CREATE POLICY "sections_select" ON sections
  FOR SELECT USING (
    is_system_admin()
    OR (
      namespace_id = get_user_namespace_id()
      AND (
        is_instructor_or_higher()
        OR is_section_member(id)
      )
    )
  );

-- Instructors+ can create sections in their namespace
CREATE POLICY "sections_insert" ON sections
  FOR INSERT WITH CHECK (
    is_instructor_or_higher()
    AND namespace_id = get_user_namespace_id()
  );

-- Section instructors can update
CREATE POLICY "sections_update" ON sections
  FOR UPDATE USING (
    is_system_admin()
    OR (
      namespace_id = get_user_namespace_id()
      AND is_section_instructor(id)
    )
  );

-- -----------------------------------------------------------------------------
-- section_memberships policies
-- -----------------------------------------------------------------------------

-- Members of a section can see other members
CREATE POLICY "memberships_select" ON section_memberships
  FOR SELECT USING (
    is_system_admin()
    OR is_section_member(section_id)
    OR is_section_instructor(section_id)
  );

-- Students can join sections (create their own membership)
CREATE POLICY "memberships_insert" ON section_memberships
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR is_section_instructor(section_id)
    OR is_system_admin()
  );

-- Users can leave sections (delete their own membership)
CREATE POLICY "memberships_delete" ON section_memberships
  FOR DELETE USING (
    user_id = auth.uid()
    OR is_section_instructor(section_id)
    OR is_system_admin()
  );

-- -----------------------------------------------------------------------------
-- problems policies
-- -----------------------------------------------------------------------------

-- Namespace-scoped read
CREATE POLICY "problems_select" ON problems
  FOR SELECT USING (
    is_system_admin() OR namespace_id = get_user_namespace_id()
  );

-- Instructors+ can create problems
CREATE POLICY "problems_insert" ON problems
  FOR INSERT WITH CHECK (
    is_instructor_or_higher()
    AND namespace_id = get_user_namespace_id()
  );

-- Authors can update their own problems
CREATE POLICY "problems_update" ON problems
  FOR UPDATE USING (
    author_id = auth.uid() OR is_system_admin()
  );

-- Authors can delete their own problems
CREATE POLICY "problems_delete" ON problems
  FOR DELETE USING (
    author_id = auth.uid() OR is_system_admin()
  );

-- -----------------------------------------------------------------------------
-- sessions policies
-- -----------------------------------------------------------------------------

-- Namespace-scoped; participants must be section members
CREATE POLICY "sessions_select" ON sessions
  FOR SELECT USING (
    is_system_admin()
    OR (
      namespace_id = get_user_namespace_id()
      AND (
        is_instructor_or_higher()
        OR is_section_member(section_id)
      )
    )
  );

-- Instructors can create sessions
CREATE POLICY "sessions_insert" ON sessions
  FOR INSERT WITH CHECK (
    is_instructor_or_higher()
    AND namespace_id = get_user_namespace_id()
  );

-- Session creators can update
CREATE POLICY "sessions_update" ON sessions
  FOR UPDATE USING (
    creator_id = auth.uid()
    OR is_section_instructor(section_id)
    OR is_system_admin()
  );

-- -----------------------------------------------------------------------------
-- session_students policies
-- -----------------------------------------------------------------------------

-- Session participants can see all students in session
CREATE POLICY "session_students_select" ON session_students
  FOR SELECT USING (
    is_system_admin()
    OR EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
      AND (
        s.creator_id = auth.uid()
        OR is_section_member(s.section_id)
        OR is_section_instructor(s.section_id)
      )
    )
  );

-- Students can insert their own state
CREATE POLICY "session_students_insert" ON session_students
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR is_system_admin()
  );

-- Students can update their own state
CREATE POLICY "session_students_update" ON session_students
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_id
      AND is_section_instructor(s.section_id)
    )
    OR is_system_admin()
  );

-- -----------------------------------------------------------------------------
-- revisions policies
-- -----------------------------------------------------------------------------

-- Namespace-scoped; session participants can see revisions
CREATE POLICY "revisions_select" ON revisions
  FOR SELECT USING (
    is_system_admin()
    OR (
      namespace_id = get_user_namespace_id()
      AND EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.id = session_id
        AND (
          s.creator_id = auth.uid()
          OR is_section_member(s.section_id)
        )
      )
    )
  );

-- Students can create revisions for their own work
CREATE POLICY "revisions_insert" ON revisions
  FOR INSERT WITH CHECK (
    namespace_id = get_user_namespace_id()
    OR is_system_admin()
  );

-- -----------------------------------------------------------------------------
-- session_backend_state policies
-- -----------------------------------------------------------------------------

-- No policies = deny all for authenticated/anon roles.
-- All access goes through API with service role which bypasses RLS.

-- -----------------------------------------------------------------------------
-- invitations policies
-- -----------------------------------------------------------------------------

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

-- ============================================================================
-- REALTIME CONFIGURATION
-- ============================================================================

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_students;
ALTER PUBLICATION supabase_realtime ADD TABLE revisions;

-- Set REPLICA IDENTITY FULL for tables that need UPDATE events
ALTER TABLE sessions REPLICA IDENTITY FULL;
ALTER TABLE session_students REPLICA IDENTITY FULL;

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER set_updated_at_namespaces
  BEFORE UPDATE ON namespaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_classes
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_sections
  BEFORE UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_problems
  BEFORE UPDATE ON problems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
