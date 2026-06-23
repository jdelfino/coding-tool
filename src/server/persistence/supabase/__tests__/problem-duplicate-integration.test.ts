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

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseProblemRepository } from '../problem-repository';
import { SupabaseAuthProvider } from '../../../auth/supabase-provider';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const hasSupabaseCredentials = Boolean(supabaseUrl && serviceRoleKey);

const describeIfSupabase = hasSupabaseCredentials ? describe : describe.skip;

describeIfSupabase('Problem duplicate() — ownership transfer + RLS editability', () => {
  let adminClient: SupabaseClient;
  let authProvider: SupabaseAuthProvider;

  // Track created user IDs for cleanup
  const createdUserIds: string[] = [];
  // Track created problem IDs for cleanup
  const createdProblemIds: string[] = [];

  const TEST_EMAIL_SUFFIX = '@problem-duplicate-integration.local';

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
    // Clean up created problems first (FK safety)
    for (const id of createdProblemIds) {
      await adminClient.from('problems').delete().eq('id', id);
    }
    createdProblemIds.length = 0;

    // Clean up created users
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
    // --- Setup ---
    // Create namespace (use 'default' which is seeded)
    const namespaceId = 'default';
    const password = 'testpassword123!';

    // Create instructor A (the duplicator)
    const userA = await authProvider.signUp(
      `instructor-a${TEST_EMAIL_SUFFIX}`,
      password,
      'instructor',
      namespaceId
    );
    createdUserIds.push(userA.id);

    // Create instructor B (the original problem author)
    const userB = await authProvider.signUp(
      `instructor-b${TEST_EMAIL_SUFFIX}`,
      password,
      'instructor',
      namespaceId
    );
    createdUserIds.push(userB.id);

    // Find a class in the default namespace to satisfy NOT NULL constraint
    const { data: classes } = await adminClient
      .from('classes')
      .select('id')
      .eq('namespace_id', namespaceId)
      .limit(1)
      .single();

    if (!classes) {
      throw new Error('No class found in default namespace — run seed-data first');
    }
    const classId = classes.id;

    // Create original problem owned by B using the service-role client (bypasses RLS)
    const serviceRepoB = new SupabaseProblemRepository(serviceRoleKey!);
    const original = await serviceRepoB.create({
      namespaceId,
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
    createdProblemIds.push(original.id);

    // --- Act: sign in as A, then duplicate through A's RLS-scoped token ---
    // The real route calls storage.problems.duplicate(id, newTitle, user.id) with the
    // caller's access token (createStorage(accessToken)). We replicate that here: sign
    // in as A, build a SupabaseProblemRepository from A's token, then call duplicate()
    // through it. This exercises the real getById SELECT + INSERT under RLS (the
    // problems_insert policy requires is_instructor_or_higher() AND namespace_id =
    // get_user_namespace_id() — A is an instructor in 'default', so it must pass).
    const { data: signInData } = await adminClient.auth.signInWithPassword({
      email: `instructor-a${TEST_EMAIL_SUFFIX}`,
      password,
    });

    if (!signInData.session) {
      throw new Error('Failed to sign in as instructor A');
    }

    const rlsRepoA = new SupabaseProblemRepository(signInData.session.access_token);
    const copy = await rlsRepoA.duplicate(original.id, `${original.title} (copy)`, userA.id);
    createdProblemIds.push(copy.id);

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
    expect(copy.namespaceId).toBe(original.namespaceId);

    // id and timestamps are fresh
    expect(copy.id).not.toBe(original.id);
    expect(copy.createdAt.getTime()).toBeGreaterThanOrEqual(original.createdAt.getTime());

    // --- Assert: A can update the copy under real RLS ---
    // Reuse the same A-token repo — A is the author of the copy so update() MUST succeed.
    const updated = await rlsRepoA.update(copy.id, { title: 'Updated by A' });
    expect(updated.title).toBe('Updated by A');
  });
});
