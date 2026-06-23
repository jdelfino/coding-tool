import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials } from './helpers/db-helpers';
import {
  loginAsInstructor,
  generateTestNamespaceId,
  createTestNamespace,
  cleanupNamespace,
} from './fixtures/auth-helpers';
import { getSupabaseAdmin, createTestClass, createTestSection, createTestProblem } from './helpers/test-data';

/**
 * Duplicate Problem E2E Tests
 *
 * Verifies the end-to-end Duplicate feature in the Problem Library:
 * - The Duplicate button calls the endpoint and produces a copy titled '<title> (copy)'
 * - The copy appears in the library immediately after duplication
 * - The copy is editable: the duplicator can open it via Edit, change the title, save, and
 *   the change persists across a page reload.
 *
 * This smoke test catches: button not wired, endpoint failure, copy not appearing in the list,
 * and copy not editable (e.g. wrong authorId stored). It does NOT verify cross-author RLS
 * (that is covered by the real-DB integration test in coding-xtz.1).
 */

const describeE2E = hasSupabaseCredentials() ? test.describe : test.describe.skip;

describeE2E('Duplicate Problem', () => {
  test('duplicated problem appears as copy, can be edited and title persists', async ({ page }) => {
    test.setTimeout(60000);

    const namespaceId = generateTestNamespaceId();
    await createTestNamespace(namespaceId);

    try {
      // ===== SETUP: create instructor and a seeded problem via Supabase =====
      const instructor = await loginAsInstructor(page, `instructor-${namespaceId}`, namespaceId);

      const supabase = getSupabaseAdmin();
      const testClass = await createTestClass(supabase, namespaceId, instructor.id, 'E2E Test Class');
      await createTestSection(supabase, testClass.id, namespaceId);

      const originalTitle = 'My Seeded Problem';
      await createTestProblem(supabase, {
        classId: testClass.id,
        namespaceId,
        authorId: instructor.id,
        title: originalTitle,
        description: 'A problem created for duplicate E2E testing',
      });

      // ===== Navigate to the Problem Library =====
      await page.goto('/instructor/problems');
      await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });

      // Wait for the seeded problem card to appear
      const originalCard = page.locator(`h3:has-text("${originalTitle}")`).first();
      await expect(originalCard).toBeVisible({ timeout: 10000 });

      // ===== Click Duplicate on the seeded problem =====
      // The Duplicate button is in the card's action row alongside Edit / Delete.
      // Each problem renders as a <div class="bg-white border ..."> card.
      // Scope to the card containing the original title so we don't click the wrong one
      // if there are multiple problems in the list.
      const cardContainer = page.locator(`div.border:has(h3:has-text("${originalTitle}"))`).first();
      const duplicateButton = cardContainer.locator('button:has-text("Duplicate")').first();
      await expect(duplicateButton).toBeVisible({ timeout: 5000 });
      await duplicateButton.click();

      // ===== Assert the copy appears in the library =====
      const copyTitle = `${originalTitle} (copy)`;
      const copyCard = page.locator(`h3:has-text("${copyTitle}")`).first();
      await expect(copyCard).toBeVisible({ timeout: 10000 });

      // ===== Open the copy via Edit =====
      const copyCardContainer = page.locator(`div.border:has(h3:has-text("${copyTitle}"))`).first();
      const editButton = copyCardContainer.locator('button:has-text("Edit")').first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();

      // The problems page shows the ProblemCreator when ?edit=<id> is in the URL
      await page.waitForURL(/\/instructor\/problems\?edit=/, { timeout: 10000 });

      // The ProblemCreator should load with the copy's title pre-filled.
      // The title input is rendered inside the CodeEditor panel with id="problem-title".
      const titleInput = page.locator('input#problem-title');
      await expect(titleInput).toBeVisible({ timeout: 10000 });
      await expect(titleInput).toHaveValue(copyTitle, { timeout: 5000 });

      // ===== Change the title and save =====
      const editedTitle = 'My Edited Copy';
      await titleInput.clear();
      await titleInput.fill(editedTitle);

      // Click the "Update Problem" submit button
      const saveButton = page.locator('button:has-text("Update Problem")').first();
      await expect(saveButton).toBeVisible({ timeout: 5000 });
      await saveButton.click();

      // After save the page navigates back to the library
      await page.waitForURL('/instructor/problems', { timeout: 10000 });
      await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 5000 });

      // ===== Reload and verify the edited title persisted =====
      await page.reload();
      await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });

      // The edited title must appear (proves it was saved to the DB, not just local state)
      await expect(page.locator(`h3:has-text("${editedTitle}")`).first()).toBeVisible({ timeout: 10000 });

      // The original problem must still be there (duplicate does not touch the original)
      await expect(page.locator(`h3:has-text("${originalTitle}")`).first()).toBeVisible({ timeout: 5000 });
    } finally {
      await cleanupNamespace(namespaceId);
    }
  });
});
