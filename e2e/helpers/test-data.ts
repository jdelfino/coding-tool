/**
 * Test Data Helpers for E2E Testing
 *
 * Provides higher-level helpers for setting up test data scenarios
 * that are commonly needed across E2E tests.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get a Supabase client with service role for admin operations
 */
export function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SECRET_KEY environment variable is required');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export interface TestClass {
  id: string;
  name: string;
  namespaceId: string;
}

export interface TestSection {
  id: string;
  name: string;
  classId: string;
  joinCode: string;
  namespaceId: string;
}

export interface TestNamespace {
  id: string;
  displayName: string;
}

/**
 * Creates a test class in a namespace
 * @param createdBy - User ID of the creator (required - must be a valid auth.users.id)
 */
export async function createTestClass(
  supabase: SupabaseClient,
  namespaceId: string,
  createdBy: string,
  name: string = 'Test Class'
): Promise<TestClass> {
  const id = uuidv4();

  const { error } = await supabase.from('classes').insert({
    id,
    name,
    namespace_id: namespaceId,
    description: 'Test class for E2E testing',
    created_by: createdBy,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to create test class: ${error.message}`);
  }

  console.log(`Created test class: ${name} (${id})`);
  return { id, name, namespaceId };
}

/**
 * Generate a random join code in 6-character format (stored without dashes)
 *
 * The join code service normalizes and validates codes to be exactly 6 alphanumeric chars.
 * Display formatting (XXX-XXX) is handled by formatJoinCodeForDisplay().
 */
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Creates a test section with a join code
 */
export async function createTestSection(
  supabase: SupabaseClient,
  classId: string,
  namespaceId: string,
  options: {
    name?: string;
    semester?: string;
    instructorIds?: string[];
  } = {}
): Promise<TestSection> {
  const id = uuidv4();
  const joinCode = generateJoinCode();
  const name = options.name || 'Test Section';

  const { error } = await supabase.from('sections').insert({
    id,
    name,
    class_id: classId,
    namespace_id: namespaceId,
    join_code: joinCode,
    semester: options.semester || 'Spring 2026',
    instructor_ids: options.instructorIds || [],
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to create test section: ${error.message}`);
  }

  console.log(`Created test section: ${name} with join code ${joinCode}`);
  return { id, name, classId, joinCode, namespaceId };
}

/**
 * Creates an admin user for test setup purposes
 * Used to provide a valid created_by reference for classes
 */
async function createTestAdminUser(
  supabase: SupabaseClient,
  namespaceId: string
): Promise<string> {
  const userId = uuidv4();
  const displayName = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const email = `${displayName}@test.local`;

  // Create auth user
  const { error: authError } = await supabase.auth.admin.createUser({
    id: userId,
    email,
    password: 'testpassword123',
    email_confirm: true,
    user_metadata: { displayName },
  });

  if (authError) {
    throw new Error(`Failed to create admin user: ${authError.message}`);
  }

  // Create profile
  const { error: profileError } = await supabase.from('user_profiles').insert({
    id: userId,
    role: 'namespace-admin',
    namespace_id: namespaceId,
    display_name: displayName,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    throw new Error(`Failed to create admin profile: ${profileError.message}`);
  }

  return userId;
}

/**
 * Sets up a complete test namespace with a class and section
 * This is useful for student registration tests
 */
export async function setupTestNamespaceWithSection(
  supabase: SupabaseClient,
  namespaceId: string
): Promise<{
  namespace: TestNamespace;
  class: TestClass;
  section: TestSection;
  adminUserId: string;
}> {
  // Create namespace
  const { error: nsError } = await supabase.from('namespaces').insert({
    id: namespaceId,
    display_name: `Test Org ${namespaceId}`,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (nsError && !nsError.message.includes('duplicate')) {
    throw new Error(`Failed to create namespace: ${nsError.message}`);
  }

  const namespace: TestNamespace = {
    id: namespaceId,
    displayName: `Test Org ${namespaceId}`,
  };

  // Create an admin user first (needed for class created_by)
  const adminUserId = await createTestAdminUser(supabase, namespaceId);

  // Create class (with admin as creator)
  const testClass = await createTestClass(supabase, namespaceId, adminUserId, 'CS 101 - Intro to Programming');

  // Create section
  const testSection = await createTestSection(supabase, testClass.id, namespaceId, {
    name: 'Monday 2pm',
    semester: 'Spring 2026',
  });

  return {
    namespace,
    class: testClass,
    section: testSection,
    adminUserId,
  };
}

/**
 * Creates an instructor user and adds them to a section
 */
export async function createInstructorForSection(
  supabase: SupabaseClient,
  sectionId: string,
  namespaceId: string,
  displayName: string
): Promise<{ id: string; displayName: string; email: string }> {
  const userId = uuidv4();
  const email = `${displayName}@test.local`;
  const password = 'testpassword123';

  // Create auth user
  const { error: authError } = await supabase.auth.admin.createUser({
    id: userId,
    email,
    password,
    email_confirm: true,
    user_metadata: { displayName },
  });

  if (authError) {
    throw new Error(`Failed to create instructor auth: ${authError.message}`);
  }

  // Create profile
  const { error: profileError } = await supabase.from('user_profiles').insert({
    id: userId,
    role: 'instructor',
    namespace_id: namespaceId,
    display_name: displayName,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    throw new Error(`Failed to create instructor profile: ${profileError.message}`);
  }

  // Add to section
  const { error: sectionError } = await supabase
    .from('sections')
    .update({ instructor_ids: [userId] })
    .eq('id', sectionId);

  if (sectionError) {
    console.warn(`Warning: Could not add instructor to section: ${sectionError.message}`);
  }

  console.log(`Created instructor: ${displayName} for section`);
  return { id: userId, displayName, email };
}

/**
 * Creates a pending invitation via direct database insert
 * (Bypasses the API for test setup purposes)
 */
export async function createTestInvitation(
  supabase: SupabaseClient,
  options: {
    email: string;
    targetRole: 'namespace-admin' | 'instructor';
    namespaceId: string;
    createdBy: string;
    expiresInDays?: number;
  }
): Promise<{ id: string; email: string; targetRole: string }> {
  const id = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (options.expiresInDays || 7));

  const { error } = await supabase.from('invitations').insert({
    id,
    email: options.email,
    target_role: options.targetRole,
    namespace_id: options.namespaceId,
    created_by: options.createdBy,
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    status: 'pending',
  });

  if (error) {
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  console.log(`Created test invitation for ${options.email} as ${options.targetRole}`);
  return { id, email: options.email, targetRole: options.targetRole };
}

/**
 * Cleans up invitation-related test data
 */
export async function cleanupInvitations(supabase: SupabaseClient): Promise<void> {
  try {
    // Delete test invitations (those with @test.local emails)
    const { error } = await supabase
      .from('invitations')
      .delete()
      .like('email', '%@test.local');

    if (error) {
      console.warn(`Warning: Could not cleanup invitations: ${error.message}`);
    }
  } catch (error) {
    console.warn('Warning: Error cleaning up invitations:', error);
  }
}
