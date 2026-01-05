-- Seed data for coding-tool local development
-- This file is loaded during `supabase db reset`
--
-- Provides a minimal set of test data for development:
-- - 1 namespace ("Test School")
-- - 4 users (1 admin, 1 instructor, 2 students)
-- - 1 class, 1 section
-- - 1 problem
-- - 1 active session

-- ============================================================================
-- NAMESPACES
-- ============================================================================

INSERT INTO namespaces (id, display_name, active, created_by)
VALUES
  ('test-school', 'Test School', true, NULL);

-- ============================================================================
-- AUTH USERS (via Supabase auth.users)
-- Note: These are test users created via Supabase Auth
-- For local dev, we create them directly in auth.users
-- ============================================================================

-- Create test users in auth.users
-- Password for all test users: 'password123'
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token
) VALUES
  -- System admin
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@test.local',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "System Admin"}',
    false,
    'authenticated',
    'authenticated',
    ''
  ),
  -- Instructor
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'instructor@test.local',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Test Instructor"}',
    false,
    'authenticated',
    'authenticated',
    ''
  ),
  -- Student 1
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'student1@test.local',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Alice Student"}',
    false,
    'authenticated',
    'authenticated',
    ''
  ),
  -- Student 2
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'student2@test.local',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Bob Student"}',
    false,
    'authenticated',
    'authenticated',
    ''
  );

-- Also insert into auth.identities for proper auth flow
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at,
  last_sign_in_at
)
SELECT
  id,
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  id::text,
  now(),
  now(),
  now()
FROM auth.users
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004'
);

-- ============================================================================
-- USER PROFILES
-- ============================================================================

-- Update namespace created_by now that we have an admin user
UPDATE namespaces SET created_by = '00000000-0000-0000-0000-000000000001' WHERE id = 'test-school';

INSERT INTO user_profiles (id, username, role, namespace_id, display_name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'system-admin', NULL, 'System Admin'),
  ('00000000-0000-0000-0000-000000000002', 'instructor', 'instructor', 'test-school', 'Test Instructor'),
  ('00000000-0000-0000-0000-000000000003', 'alice', 'student', 'test-school', 'Alice Student'),
  ('00000000-0000-0000-0000-000000000004', 'bob', 'student', 'test-school', 'Bob Student');

-- ============================================================================
-- CLASSES
-- ============================================================================

INSERT INTO classes (id, namespace_id, name, description, created_by)
VALUES
  (
    '00000000-0000-0000-0000-000000000101',
    'test-school',
    'CS 101 - Introduction to Programming',
    'Learn the basics of Python programming',
    '00000000-0000-0000-0000-000000000002'
  );

-- ============================================================================
-- SECTIONS
-- ============================================================================

INSERT INTO sections (id, namespace_id, class_id, name, semester, instructor_ids, join_code, active)
VALUES
  (
    '00000000-0000-0000-0000-000000000201',
    'test-school',
    '00000000-0000-0000-0000-000000000101',
    'Section A',
    'Spring 2026',
    ARRAY['00000000-0000-0000-0000-000000000002'::uuid],
    'ABC-123-XYZ',
    true
  );

-- ============================================================================
-- SECTION MEMBERSHIPS
-- ============================================================================

INSERT INTO section_memberships (user_id, section_id, role)
VALUES
  -- Instructor is also a member
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000201', 'instructor'),
  -- Students enrolled
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000201', 'student'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000201', 'student');

-- ============================================================================
-- PROBLEMS
-- ============================================================================

INSERT INTO problems (id, namespace_id, title, description, starter_code, author_id, class_id)
VALUES
  (
    '00000000-0000-0000-0000-000000000301',
    'test-school',
    'Hello World',
    E'# Hello World\n\nWrite a program that prints "Hello, World!" to the console.\n\n## Instructions\n\n1. Use the `print()` function\n2. Make sure to spell it exactly right\n\n## Example Output\n\n```\nHello, World!\n```',
    E'# Write your code below\nprint("Hello, World!")',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000101'
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    'test-school',
    'Sum Two Numbers',
    E'# Sum Two Numbers\n\nWrite a program that reads two numbers from input and prints their sum.\n\n## Instructions\n\n1. Use `input()` to read two numbers\n2. Convert them to integers using `int()`\n3. Print the sum\n\n## Example\n\nInput:\n```\n5\n3\n```\n\nOutput:\n```\n8\n```',
    E'# Read two numbers and print their sum\na = int(input())\nb = int(input())\nprint(a + b)',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000101'
  );

-- ============================================================================
-- SESSIONS (Optional - create an active session for testing)
-- ============================================================================

INSERT INTO sessions (id, namespace_id, section_id, section_name, problem, creator_id, status)
VALUES
  (
    '00000000-0000-0000-0000-000000000401',
    'test-school',
    '00000000-0000-0000-0000-000000000201',
    'Section A',
    '{
      "id": "00000000-0000-0000-0000-000000000301",
      "namespaceId": "test-school",
      "title": "Hello World",
      "description": "# Hello World\n\nWrite a program that prints \"Hello, World!\" to the console.",
      "starterCode": "# Write your code below\nprint(\"Hello, World!\")",
      "authorId": "00000000-0000-0000-0000-000000000002",
      "createdAt": "2026-01-05T00:00:00Z",
      "updatedAt": "2026-01-05T00:00:00Z"
    }',
    '00000000-0000-0000-0000-000000000002',
    'active'
  );

-- ============================================================================
-- SESSION STUDENTS (Optional - add students to the session)
-- ============================================================================

INSERT INTO session_students (session_id, student_id, user_id, name, code)
VALUES
  (
    '00000000-0000-0000-0000-000000000401',
    'alice',
    '00000000-0000-0000-0000-000000000003',
    'Alice Student',
    'print("Hello, World!")'
  ),
  (
    '00000000-0000-0000-0000-000000000401',
    'bob',
    '00000000-0000-0000-0000-000000000004',
    'Bob Student',
    '# Still working on it...'
  );

-- ============================================================================
-- TEST CREDENTIALS SUMMARY
-- ============================================================================
--
-- Email                    | Password      | Role          | Username
-- -------------------------+---------------+---------------+------------
-- admin@test.local         | password123   | system-admin  | admin
-- instructor@test.local    | password123   | instructor    | instructor
-- student1@test.local      | password123   | student       | alice
-- student2@test.local      | password123   | student       | bob
--
-- Join Code: ABC-123-XYZ (for Section A of CS 101)
-- ============================================================================
