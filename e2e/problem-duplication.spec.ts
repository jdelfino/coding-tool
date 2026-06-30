import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials } from './helpers/db-helpers';
import {
  loginAsInstructor,
  generateTestNamespaceId,
  createTestNamespace,
  cleanupNamespace,
} from './fixtures/auth-helpers';
import {
  getSupabaseAdmin,
  createTestClass,
  createTestProblem,
} from './helpers/test-data';

/**
 * Problem Duplication E2E Tests
 *
 * Epic-level acceptance tests for instructor problem duplication (coding-33o).
 * Covers the full "Duplicate button → modal → POST /api/problems/[id]/duplicate → list refresh"
 * flow for two scenarios:
 *   1. Same-class build-off: copy lands in the same class, instructor can edit it.
 *   2. Cross-class port: copy lands in a different class the instructor owns.
 *
 * These tests require a running local Supabase instance (SUPABASE_SECRET_KEY set).
 * They skip automatically when credentials are absent.
 */

const describeE2E = hasSupabaseCredentials() ? test.describe : test.describe.skip;

const PROBLEM_TITLE = 'Binary Search';
const COPY_TITLE = `Copy of ${PROBLEM_TITLE}`;

describeE2E('Problem Duplication', () => {
  test('same-class build-off: instructor duplicates a problem, copy is editable', async ({ page }) => {
    /**
     * Verifies the complete same-class duplication flow:
     * - "Duplicate" button is present on the problem card
     * - Modal pre-fills the title as "Copy of <title>"
     * - Default target is "Same class (default)"
     * - On confirm: POST succeeds, modal closes, library refreshes with "Copy of <title>"
     * - The copy is editable by the instructor (authorId set to instructor.id → RLS allows edit)
     *
     * Catches: route not setting authorId to current user (RLS blocks edit); modal not wired;
     * list not refreshed after duplication; Duplicate button missing from card.
     */
    test.setTimeout(60000);

    const namespaceId = generateTestNamespaceId();
    await createTestNamespace(namespaceId);

    try {
      // Login first — we need the instructor's user ID to set up owned data.
      const instructor = await loginAsInstructor(page, `instructor-${namespaceId}`, namespaceId);

      // Set up class A and a problem authored by the instructor, bypassing UI.
      const supabase = getSupabaseAdmin();
      const classA = await createTestClass(supabase, namespaceId, instructor.id, 'Class A');
      await createTestProblem(supabase, {
        classId: classA.id,
        namespaceId,
        authorId: instructor.id,
        title: PROBLEM_TITLE,
      });

      // Navigate to the problem library (separate page from the dashboard).
      await page.goto('/instructor/problems');

      // Wait for the class picker to load, then select class A.
      await expect(page.locator('select#class-picker')).toBeVisible({ timeout: 15000 });
      await page.selectOption('select#class-picker', classA.id);

      // Wait for the problem to appear in the list.
      await expect(page.locator(`h3:has-text("${PROBLEM_TITLE}")`)).toBeVisible({ timeout: 15000 });

      // Click the Duplicate button on the problem card (list-view button has title="Duplicate problem").
      await page.locator('button[title="Duplicate problem"]').first().click();

      // The DuplicateProblemModal should open.
      await expect(page.locator('h2:has-text("Duplicate Problem")')).toBeVisible({ timeout: 5000 });

      // Title input must be pre-filled with "Copy of <original title>".
      await expect(page.locator('input#duplicate-title')).toHaveValue(COPY_TITLE);

      // Target class defaults to "Same class (default)" — value is '' (empty string).
      await expect(page.locator('select#duplicate-target-class')).toHaveValue('');

      // Confirm the duplication.
      // The modal's submit button is the last "Duplicate" button in DOM order
      // (the modal is rendered after all ProblemCard components in ProblemLibrary).
      await page.locator('button:has-text("Duplicate")').last().click();

      // Modal must close after success.
      await expect(page.locator('h2:has-text("Duplicate Problem")')).not.toBeVisible({ timeout: 15000 });

      // The copy must appear in the library (list refreshes after onSuccess).
      await expect(page.locator(`h3:has-text("${COPY_TITLE}")`)).toBeVisible({ timeout: 15000 });

      // Click Edit on the copy to verify it is editable.
      // Problems are sorted by creation date descending; the copy (newest) appears first.
      await page.locator('button[title="Edit problem"]').first().click();

      // URL changes to /instructor/problems?edit=<copyId> (ProblemCreator renders).
      await expect(page).toHaveURL(/\/instructor\/problems\?edit=/, { timeout: 10000 });

      // Wait for the problem to load in the editor (tabs only render when !isLoading).
      // "Starter Code" tab presence proves: no load error, copy was readable, editor is live.
      await expect(page.getByRole('tab', { name: 'Starter Code' })).toBeVisible({ timeout: 15000 });

      // No error message must appear (which would indicate a permissions/RLS failure).
      await expect(page.locator('text=Failed to load problem')).not.toBeVisible();
    } finally {
      await cleanupNamespace(namespaceId);
    }
  });

  test('cross-class port: instructor duplicates a problem to another class they own', async ({ page }) => {
    /**
     * Verifies the cross-class duplication flow:
     * - Instructor selects a different target class in the modal
     * - On confirm: copy appears under the target class filter
     * - Original remains in the source class
     *
     * Catches: targetClassId override not applied (copy lands in wrong class);
     * target-class auth check wrongly blocking an instructor-owned class;
     * original deleted or moved instead of copied.
     */
    test.setTimeout(60000);

    const namespaceId = generateTestNamespaceId();
    await createTestNamespace(namespaceId);

    try {
      const instructor = await loginAsInstructor(page, `instructor-${namespaceId}`, namespaceId);

      const supabase = getSupabaseAdmin();

      // Two classes, both owned by the instructor (created_by = instructor.id),
      // so the target-class ownership check in the API route will pass for class B.
      const classA = await createTestClass(supabase, namespaceId, instructor.id, 'Class A');
      const classB = await createTestClass(supabase, namespaceId, instructor.id, 'Class B');
      await createTestProblem(supabase, {
        classId: classA.id,
        namespaceId,
        authorId: instructor.id,
        title: PROBLEM_TITLE,
      });

      await page.goto('/instructor/problems');

      // Select class A and wait for the problem to load.
      await expect(page.locator('select#class-picker')).toBeVisible({ timeout: 15000 });
      await page.selectOption('select#class-picker', classA.id);
      await expect(page.locator(`h3:has-text("${PROBLEM_TITLE}")`)).toBeVisible({ timeout: 15000 });

      // Open the duplicate modal.
      await page.locator('button[title="Duplicate problem"]').first().click();
      await expect(page.locator('h2:has-text("Duplicate Problem")')).toBeVisible({ timeout: 5000 });

      // Select class B as the target.
      // The modal's select is populated from the instructor's class list loaded by ProblemLibrary.
      await page.selectOption('select#duplicate-target-class', classB.id);

      // Confirm.
      await page.locator('button:has-text("Duplicate")').last().click();

      // Modal closes (copy was created in class B, library refreshes class A — copy absent there).
      await expect(page.locator('h2:has-text("Duplicate Problem")')).not.toBeVisible({ timeout: 15000 });

      // Switch the library filter to class B — the copy must appear.
      await page.selectOption('select#class-picker', classB.id);
      await expect(page.locator(`h3:has-text("${COPY_TITLE}")`)).toBeVisible({ timeout: 15000 });

      // Switch back to class A — the original must still be there, copy must NOT be.
      await page.selectOption('select#class-picker', classA.id);

      // Wait for class A problems to load (original appears to confirm the list updated).
      await expect(page.getByRole('heading', { name: PROBLEM_TITLE, exact: true, level: 3 })).toBeVisible({ timeout: 15000 });

      // Copy must not be listed under class A.
      await expect(page.getByRole('heading', { name: COPY_TITLE, exact: true, level: 3 })).not.toBeVisible();
    } finally {
      await cleanupNamespace(namespaceId);
    }
  });
});
