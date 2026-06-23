/**
 * Real-DB integration test: duplicate() ownership transfer + RLS editability
 *
 * Contract verified: when instructor A duplicates a problem authored by instructor B,
 * the copy's authorId must be A (NOT B), and A must be able to UPDATE the copy
 * under real RLS (the repo is scoped to A's access token). This is the core
 * correctness guarantee of the Duplicate feature — without it a duplicator
 * cannot edit their own copy.
 *
 * Why it matters: duplicate() previously copied the original author's id.
 * Under Supabase RLS, only the author (or admin) can edit a problem. If the
 * copy retains B's authorId, A cannot edit it despite being the creator.
 *
 * What breaks if violated: instructors would receive "Forbidden" when editing
 * duplicated problems they do not own.
 *
 * Prerequisites: local Supabase running with SUPABASE_SECRET_KEY set.
 * This test SKIPS automatically when credentials are not present.
 * The default CI `test` job has no SUPABASE_SECRET_KEY, so this suite skips
 * there; the `integration-tests` CI job sets the key so it actually runs.
 */

// Unmock the Supabase client so this integration test uses the real Supabase instance.
// setupTests.ts globally mocks @/server/supabase/client for unit tests; we restore
// the real module here so that SupabaseProblemRepository and SupabaseAuthProvider
// talk to a live local database rather than the in-memory mock.
jest.unmock('@/server/supabase/client');

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseProblemRepository } from '../problem-repository';
import { SupabaseAuthProvider } from '../../../auth/supabase-provider';
import { SERVICE_ROLE_MARKER } from '../../../supabase/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const hasSupabaseCredentials = Boolean(supabaseUrl && serviceRoleKey);

const describeIfSupabase = hasSupabaseCredentials ? describe : describe.skip;

// Dedicated namespace for this test — avoids any dependency on seed data.
// Using a fixed slug makes cleanup deterministic and idempotent across runs.
const TEST_NAMESPACE_ID = 'duplicate-int-test';
const TEST_EMAIL_SUFFIX = '@problem-duplicate-integration.local';

describeIfSupabase('Problem duplicate() — ownership transfer + RLS editability', () => {
  let adminClient: SupabaseClient;
  let authProvider: SupabaseAuthProvider;

  // Track created user IDs for cleanup
  const createdUserIds: string[] = [];

  beforeAll(() => {
    adminClient = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    authProvider = new SupabaseAuthProvider();
  });

  afterEach(async () => {
    // Delete the test namespace first — ON DELETE CASCADE removes the class and
    // all problems in it, so we do not need to track problem IDs separately.
    await adminClient.from('namespaces').delete().eq('id', TEST_NAMESPACE_ID);

    // Delete users after namespace (user_profiles are removed via ON DELETE CASCADE
    // from auth.users, but auth.users itself must be removed via the Admin API).
    for (const userId of createdUserIds) {
      try {
        await adminClient.auth.admin.deleteUser(userId);
      } catch {
        // Best-effort cleanup
      }
    }
    createdUserIds.length = 0;
  });

  it('copy.authorId === A (the duplicator), all content fields match original, A can UPDATE copy under RLS', async () => {
    const password = 'testpassword123!';

    // --- Setup: namespace ---
    // Idempotent: delete any pre-existing stale namespace (from a prior failed run),
    // then insert fresh. created_by is nullable so we omit it.
    await adminClient.from('namespaces').delete().eq('id', TEST_NAMESPACE_ID);
    const { error: nsError } = await adminClient.from('namespaces').insert({
      id: TEST_NAMESPACE_ID,
      display_name: 'Duplicate Integration Test Namespace',
    });
    if (nsError) {
      throw new Error(`Failed to create test namespace: ${nsError.message}`);
    }

    // --- Setup: users ---
    // Create instructor A (the duplicator) into our dedicated namespace.
    const userA = await authProvider.signUp(
      `instructor-a${TEST_EMAIL_SUFFIX}`,
      password,
      'instructor',
      TEST_NAMESPACE_ID
    );
    createdUserIds.push(userA.id);

    // Create instructor B (the original problem author) into the same namespace.
    const userB = await authProvider.signUp(
      `instructor-b${TEST_EMAIL_SUFFIX}`,
      password,
      'instructor',
      TEST_NAMESPACE_ID
    );
    createdUserIds.push(userB.id);

    // --- Setup: class ---
    // Create a class owned by B (classes.created_by is NOT NULL).
    const { data: classRow, error: classError } = await adminClient
      .from('classes')
      .insert({
        namespace_id: TEST_NAMESPACE_ID,
        name: 'Test Class',
        created_by: userB.id,
      })
      .select('id')
      .single();

    if (classError || !classRow) {
      throw new Error(`Failed to create test class: ${classError?.message}`);
    }
    const classId = classRow.id;

    // --- Setup: original problem owned by B ---
    // Use SERVICE_ROLE_MARKER so the repo bypasses RLS (setup must not be gated by B's token).
    const serviceRepoB = new SupabaseProblemRepository(SERVICE_ROLE_MARKER);
    const original = await serviceRepoB.create({
      namespaceId: TEST_NAMESPACE_ID,
      title: 'Original Problem by B',
      description: 'A test description',
      starterCode: 'def solve(): pass',
      solution: 'def solve(): return 42',
      testCases: [],
      executionSettings: undefined,
      authorId: userB.id,
      classId,
      tags: ['integration', 'test'],
    });

    // --- Act: sign in as A, then duplicate through A's RLS-scoped token ---
    // The real route calls storage.problems.duplicate(id, newTitle, user.id) with the
    // caller's access token (createStorage(accessToken)). We replicate that here: sign
    // in as A, build a SupabaseProblemRepository from A's token, then call duplicate()
    // through it. This exercises the real getById SELECT + INSERT under RLS (the
    // problems_insert policy requires is_instructor_or_higher() AND namespace_id =
    // get_user_namespace_id() — A is an instructor in TEST_NAMESPACE_ID, so it must pass).
    const { data: signInData } = await adminClient.auth.signInWithPassword({
      email: `instructor-a${TEST_EMAIL_SUFFIX}`,
      password,
    });

    if (!signInData.session) {
      throw new Error('Failed to sign in as instructor A');
    }

    const rlsRepoA = new SupabaseProblemRepository(signInData.session.access_token);
    const copy = await rlsRepoA.duplicate(original.id, `${original.title} (copy)`, userA.id);

    // --- Assert: ownership transferred ---
    expect(copy.authorId).toBe(userA.id);
    expect(copy.authorId).not.toBe(userB.id);
    expect(copy.title).toBe('Original Problem by B (copy)');

    // All content fields carried over
    expect(copy.description).toBe(original.description);
    expect(copy.starterCode).toBe(original.starterCode);
    expect(copy.solution).toBe(original.solution);
    expect(copy.testCases).toEqual(original.testCases);
    expect(copy.tags).toEqual(original.tags);
    expect(copy.classId).toBe(original.classId);
    expect(copy.namespaceId).toBe(TEST_NAMESPACE_ID);

    // id and timestamps are fresh
    expect(copy.id).not.toBe(original.id);
    expect(copy.createdAt.getTime()).toBeGreaterThanOrEqual(original.createdAt.getTime());

    // --- Assert: A can update the copy under real RLS ---
    // Reuse the same A-token repo — A is the author of the copy so update() MUST succeed.
    const updated = await rlsRepoA.update(copy.id, { title: 'Updated by A' });
    expect(updated.title).toBe('Updated by A');
  });
});
