/**
 * Real-DB integration tests: problem duplicate authorship + RLS enforcement
 *
 * IMPORTANT — SKIPS IN CI TODAY: These tests run against a live local Supabase
 * instance. The default ci.yml test job sets no SUPABASE_SECRET_KEY and starts
 * no DB, so this suite is skipped there via the `describeIfSupabase` gate below.
 * Making these gate in CI is tracked by bead coding-wsw.
 *
 * To run locally:
 *   npx supabase start
 *   source .env.local
 *   npm test -- problem-duplicate-integration
 *
 * Why these tests require a real DB:
 * The whole point of setting authorId = copier on duplicate is so Postgres RLS
 * lets the copier edit/delete their copy:
 *   problems UPDATE policy: author_id = auth.uid() OR is_system_admin()
 *   problems DELETE policy: author_id = auth.uid() OR is_system_admin()
 * Mocked unit/route tests verify the input shape fed to insert, but CANNOT prove
 * the DB persisted the right author_id or that RLS actually grants/denies write
 * access. This suite exercises real authenticated JWT clients against live Postgres.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseProblemRepository } from '../problem-repository';
import { Problem } from '../../../types/problem';

// setupTests.ts globally mocks @/server/supabase/client for unit tests.
// Undo that mock so this real-DB suite uses the actual Supabase client.
jest.mock('@/server/supabase/client', () =>
  jest.requireActual('@/server/supabase/client')
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const hasSupabaseCredentials = Boolean(supabaseUrl && serviceRoleKey);

const describeIfSupabase = hasSupabaseCredentials ? describe : describe.skip;

// Isolated namespace IDs for this test suite — avoids collisions with seed data
const NS_A = 'dup-integ-ns-a';
const NS_B = 'dup-integ-ns-b';
const EMAIL_SUFFIX = '@dup-integ.local';
const TEST_PASSWORD = 'TestPass123!';

describeIfSupabase('Problem Duplicate: RLS Integration', () => {
  let admin: SupabaseClient;

  // Seeded actors
  let userA: { id: string; accessToken: string }; // author of source problem; in NS_A
  let userB: { id: string; accessToken: string }; // copier; in NS_A
  let userC: { id: string; accessToken: string }; // instructor in NS_B (different namespace)

  let classCA: { id: string }; // owned by A in NS_A
  let classCB: { id: string }; // owned by B in NS_A

  let problemA: Problem; // A's original problem in classCA

  /**
   * Create an auth user + user_profile and sign in to obtain a JWT access token
   * so that SupabaseProblemRepository can be created with RLS-bound credentials.
   */
  async function seedUser(
    email: string,
    role: string,
    namespaceId: string | null
  ): Promise<{ id: string; accessToken: string }> {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (authError || !authData.user) {
      throw new Error(`seedUser: failed to create auth user ${email}: ${authError?.message}`);
    }

    const { error: profileError } = await admin.from('user_profiles').insert({
      id: authData.user.id,
      role,
      namespace_id: namespaceId,
    });
    if (profileError) {
      throw new Error(`seedUser: failed to create profile ${email}: ${profileError.message}`);
    }

    const { data: signIn, error: signInError } = await admin.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });
    if (signInError || !signIn.session) {
      throw new Error(`seedUser: sign-in failed for ${email}: ${signInError?.message}`);
    }

    return { id: authData.user.id, accessToken: signIn.session.access_token };
  }

  beforeAll(async () => {
    admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Seed namespaces (idempotent)
    const namespacesToSeed = [
      { id: NS_A, display_name: 'Dup Integ Namespace A' },
      { id: NS_B, display_name: 'Dup Integ Namespace B' },
    ];
    for (const ns of namespacesToSeed) {
      const { error } = await admin.from('namespaces').upsert(ns, { onConflict: 'id' });
      if (error) throw new Error(`beforeAll: failed to upsert namespace ${ns.id}: ${error.message}`);
    }

    // Seed instructors: A and B in NS_A, C in NS_B
    userA = await seedUser(`instructor-a${EMAIL_SUFFIX}`, 'instructor', NS_A);
    userB = await seedUser(`instructor-b${EMAIL_SUFFIX}`, 'instructor', NS_A);
    userC = await seedUser(`instructor-c${EMAIL_SUFFIX}`, 'instructor', NS_B);

    // Seed classes via admin (bypasses classes INSERT RLS for setup convenience)
    const { data: caData, error: caErr } = await admin
      .from('classes')
      .insert({ namespace_id: NS_A, name: 'Class A', created_by: userA.id })
      .select('id')
      .single();
    if (caErr || !caData) throw new Error(`beforeAll: failed to create class CA: ${caErr?.message}`);
    classCA = { id: caData.id };

    const { data: cbData, error: cbErr } = await admin
      .from('classes')
      .insert({ namespace_id: NS_A, name: 'Class B', created_by: userB.id })
      .select('id')
      .single();
    if (cbErr || !cbData) throw new Error(`beforeAll: failed to create class CB: ${cbErr?.message}`);
    classCB = { id: cbData.id };

    // Seed A's problem using A's authenticated repository.
    // This also exercises the problems INSERT RLS (instructor_or_higher + same namespace).
    const repoA = new SupabaseProblemRepository(userA.accessToken);
    problemA = await repoA.create({
      namespaceId: NS_A,
      title: 'Original Problem by A',
      description: 'Source problem for duplication integration tests',
      starterCode: 'print("hello")',
      authorId: userA.id,
      classId: classCA.id,
      tags: [],
    });
  });

  afterAll(async () => {
    // Delete all test auth users (ON DELETE CASCADE removes user_profiles)
    const { data: authUsers } = await admin.auth.admin.listUsers();
    for (const u of authUsers?.users ?? []) {
      if (u.email?.endsWith(EMAIL_SUFFIX)) {
        await admin.auth.admin.deleteUser(u.id);
      }
    }
    // Delete namespaces (CASCADE removes classes and problems)
    await admin.from('namespaces').delete().in('id', [NS_A, NS_B]);
  });

  // ---------------------------------------------------------------------------
  // Test Case 1: Copier owns the duplicate under RLS
  //
  // Contract: When B duplicates A's problem with authorId override = B,
  //   • the copy's author_id and class_id reflect the overrides (DB-level, not just app-level)
  //   • real Postgres RLS permits B to UPDATE and DELETE the copy
  //     (problems UPDATE/DELETE: author_id = auth.uid())
  //
  // Catches: authorId not actually written at the DB layer; RLS blocking the
  //          legitimate owner from editing their own copy.
  // ---------------------------------------------------------------------------
  describe('Copier owns the duplicate under RLS', () => {
    it('copy has author_id = B and class_id = CB in the database', async () => {
      /**
       * Verifies the DB row has the overridden author_id and class_id.
       * Mocked tests only verify the ProblemInput shape; real-DB confirms persistence.
       */
      const repoB = new SupabaseProblemRepository(userB.accessToken);
      const copy = await repoB.duplicate(problemA.id, {
        title: 'Copy of Original by B',
        classId: classCB.id,
        authorId: userB.id,
      });

      try {
        expect(copy.authorId).toBe(userB.id);
        expect(copy.classId).toBe(classCB.id);
        expect(copy.title).toBe('Copy of Original by B');
        expect(copy.namespaceId).toBe(NS_A);
        // Confirm fields are a separate row (not the same id as original)
        expect(copy.id).not.toBe(problemA.id);
      } finally {
        await admin.from('problems').delete().eq('id', copy.id);
      }
    });

    it('B can UPDATE the copy — RLS: author_id = B = auth.uid()', async () => {
      /**
       * Verifies Postgres RLS permits the copier to update their copy.
       * If authorId were not applied at the DB layer, this UPDATE would be blocked.
       */
      const repoB = new SupabaseProblemRepository(userB.accessToken);
      const copy = await repoB.duplicate(problemA.id, {
        title: 'Copy to Update',
        classId: classCB.id,
        authorId: userB.id,
      });

      try {
        const updated = await repoB.update(copy.id, { title: 'Updated by B' });
        expect(updated.title).toBe('Updated by B');
        expect(updated.authorId).toBe(userB.id);
      } finally {
        await admin.from('problems').delete().eq('id', copy.id);
      }
    });

    it('B can DELETE the copy — RLS: author_id = B = auth.uid()', async () => {
      /**
       * Verifies Postgres RLS permits the copier to delete their copy.
       * Confirms the row is actually removed from the database.
       */
      const repoB = new SupabaseProblemRepository(userB.accessToken);
      const copy = await repoB.duplicate(problemA.id, {
        title: 'Copy to Delete',
        classId: classCB.id,
        authorId: userB.id,
      });

      await repoB.delete(copy.id);

      // Confirm the row no longer exists
      const { data } = await admin.from('problems').select('id').eq('id', copy.id);
      expect(data).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test Case 2: Original unaffected; cross-author edit blocked by RLS
  //
  // Contract: Duplicating a problem creates a separate row; A's original is untouched.
  //   Furthermore, RLS blocks B from editing A's original (author_id = A ≠ B = auth.uid()).
  //
  // Catches: accidental shared identity between source and copy; RLS regressions
  //          that would allow cross-author writes.
  // ---------------------------------------------------------------------------
  describe('Original unaffected; cross-author edit blocked by RLS', () => {
    it("A's original problem is a separate row unchanged by B's duplication", async () => {
      /**
       * Verifies duplicate() creates a new row and does not mutate the source.
       * Fetches the original via admin to bypass RLS and confirm the DB state.
       */
      const repoB = new SupabaseProblemRepository(userB.accessToken);
      const copy = await repoB.duplicate(problemA.id, {
        title: 'Copy — verify original',
        classId: classCB.id,
        authorId: userB.id,
      });

      try {
        const { data, error } = await admin
          .from('problems')
          .select('id, author_id, class_id, title')
          .eq('id', problemA.id)
          .single();

        expect(error).toBeNull();
        expect(data).not.toBeNull();
        expect(data!.id).toBe(problemA.id);
        expect(data!.author_id).toBe(userA.id);
        expect(data!.class_id).toBe(classCA.id);
        expect(data!.title).toBe('Original Problem by A');
        expect(data!.id).not.toBe(copy.id);
      } finally {
        await admin.from('problems').delete().eq('id', copy.id);
      }
    });

    it("B cannot UPDATE A's original — RLS blocks (author_id = A ≠ B)", async () => {
      /**
       * Verifies Postgres RLS makes A's problem invisible to B for UPDATE.
       * The update method returns PGRST116 (0 rows) → throws "Problem not found".
       * The original title must remain unchanged.
       */
      const repoB = new SupabaseProblemRepository(userB.accessToken);

      await expect(
        repoB.update(problemA.id, { title: 'Hijacked by B' })
      ).rejects.toThrow(/Problem not found/);

      // Original title must be unchanged
      const { data } = await admin
        .from('problems')
        .select('title')
        .eq('id', problemA.id)
        .single();
      expect(data?.title).toBe('Original Problem by A');
    });

    it("B cannot DELETE A's original — RLS silently skips; row still exists", async () => {
      /**
       * Postgres RLS-blocked DELETE returns success with 0 rows deleted (no error).
       * The repository's delete() method does not surface the 0-row case, so we
       * verify survival by fetching the row via admin after B's delete attempt.
       */
      const repoB = new SupabaseProblemRepository(userB.accessToken);

      // No error is thrown — RLS silently skips the row
      await expect(repoB.delete(problemA.id)).resolves.not.toThrow();

      // A's original must still exist
      const { data } = await admin
        .from('problems')
        .select('id')
        .eq('id', problemA.id)
        .single();
      expect(data?.id).toBe(problemA.id);
    });
  });

  // ---------------------------------------------------------------------------
  // Test Case 3: Namespace isolation on source read
  //
  // Contract: RLS SELECT policy scopes problems to namespace_id = get_user_namespace_id().
  //   Instructor C (in NS_B) cannot read A's problem (in NS_A) via getById, and therefore
  //   cannot duplicate it.
  //
  // Catches: cross-namespace source leakage; RLS SELECT regression.
  // ---------------------------------------------------------------------------
  describe('Namespace isolation — cross-namespace source read blocked', () => {
    it('C (in NS_B) cannot read A\'s problem from NS_A via getById', async () => {
      /**
       * RLS SELECT policy: namespace_id = get_user_namespace_id().
       * C's JWT resolves to NS_B; A's problem is in NS_A → invisible to C.
       * getById returns null, not an error, because RLS filters the row away.
       */
      const repoC = new SupabaseProblemRepository(userC.accessToken);

      const result = await repoC.getById(problemA.id);
      expect(result).toBeNull();
    });

    it('C cannot duplicate A\'s problem — read blocked by RLS before insert', async () => {
      /**
       * duplicate() calls getById(id) internally; RLS scopes C's SELECT to NS_B
       * → getById returns null → duplicate() throws "Problem not found".
       * This is the full end-to-end proof that namespace isolation prevents the flow.
       */
      const repoC = new SupabaseProblemRepository(userC.accessToken);

      await expect(
        repoC.duplicate(problemA.id, {
          title: 'Stolen Copy',
          authorId: userC.id,
        })
      ).rejects.toThrow(/Problem not found/);
    });
  });
});
