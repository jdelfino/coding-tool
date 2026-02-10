---
name: e2e-testing
description: Writing and debugging E2E tests with Playwright. Covers test patterns, debugging approach, and common pitfalls.
---

# E2E Testing Skill

Guide for writing and debugging E2E tests with Playwright in this codebase.

## Core Principles

### 1. Failing Tests Indicate Real Bugs

E2E tests that fail for "unknown reasons" almost always indicate:
- **An app bug** - The test exposed a real issue in the application
- **A test deficiency** - The test isn't checking the right thing, or is missing setup

The answer is **never** to:
- Increase timeouts as a fix (if something takes 30 seconds, there's a bug)
- Skip verifying something that should be happening
- Ignore assertions that seem "flaky"

### 2. Debug Locally, One Test at a Time

**NEVER debug E2E tests by pushing to CI.** Always:

```bash
# Run a single test file
npx playwright test e2e/your-test.spec.ts --reporter=line

# Run with headed browser to watch
npx playwright test e2e/your-test.spec.ts --headed

# Debug mode with inspector
npx playwright test e2e/your-test.spec.ts --debug
```

Only push when tests pass locally. CI should validate, not debug.

### 3. Screenshots Tell the Story

When a test fails, always examine:
1. `test-results/.../test-failed-1.png` - First failure screenshot
2. `test-results/.../test-failed-2.png` - Additional context
3. `test-results/.../video.webm` - Full test recording

The screenshot often reveals the actual state vs. expected state.

## Debugging Approach

### Step 1: Read the Error Message

```
Error: expect(locator).toBeVisible() failed
Locator: locator('[data-testid="session-ended-notification"]')
Expected: not visible
Received: visible
```

This tells you exactly what's wrong. Don't guess—investigate why that state occurred.

### Step 2: Check Screenshots

The visual state at failure time is invaluable. Look for:
- Unexpected notifications/banners
- Missing elements
- Wrong page/route
- Error messages in the UI

### Step 3: Trace Back the Bug

When the UI shows unexpected state:
1. **What state is visible?** (e.g., "Session ended" banner)
2. **What sets that state?** (e.g., `setSessionEnded(true)`)
3. **Why would that be set?** (e.g., session.status === 'completed')
4. **Why is that condition true?** (e.g., stale data from previous session)

Follow the chain until you find the root cause.

### Step 4: Fix the App, Not the Test

When you find the bug, fix the application code. Examples from this codebase:

**Bug 1: Stale hook state on navigation**
```typescript
// Before: Hook didn't reset state when sessionId changed
useEffect(() => {
  if (sessionId !== lastSessionIdRef.current) {
    initialLoadRef.current = false;
    // Missing: state wasn't being reset!
  }
}, [...]);

// After: Reset all session state
useEffect(() => {
  if (sessionId !== lastSessionIdRef.current) {
    initialLoadRef.current = false;
    setSession(null);
    setStudents(new Map());
    setReplacementInfo(null);
    setLoading(true);
    setError(null);
  }
}, [...]);
```

**Bug 2: Component state bleeding across navigations**
```typescript
// Before: sessionEnded persisted across session navigation
// No reset when sessionIdFromUrl changed

// After: Reset session-related state on navigation
useEffect(() => {
  if (sessionIdFromUrl !== prevSessionIdRef.current) {
    setSessionEnded(false);
    setJoined(false);
    joinAttemptedRef.current = null;
    prevSessionIdRef.current = sessionIdFromUrl;
  }
}, [sessionIdFromUrl]);
```

## Writing E2E Tests

### Test Structure

```typescript
test('descriptive test name', async ({ page, browser }) => {
  // Extend timeout for complex flows (but don't use as a fix for slowness)
  test.setTimeout(60000);

  const namespaceId = generateTestNamespaceId();

  try {
    // ===== SETUP =====
    // Use DB helpers for data setup, not UI clicks
    const { section } = await setupTestNamespaceWithSection(supabase, namespaceId);

    // ===== TEST FLOW =====
    // Step 1: Describe what this step does
    await page.goto('/some-page');
    await expect(page.locator('...')).toBeVisible();

    // Step 2: Next action
    // ...

    console.log('Test completed successfully!');
  } finally {
    // Always cleanup
    await cleanupNamespace(namespaceId);
  }
});
```

### Multi-User Tests

Use separate browser contexts for different users:

```typescript
const instructorContext = await browser.newContext();
const instructorPage = await instructorContext.newPage();
await loginAsInstructor(instructorPage, 'instructor-name', namespaceId);

// Default page is student
await loginAsStudent(page, 'student-name', namespaceId);

// Don't forget to close
try {
  // ... test ...
} finally {
  await instructorContext.close();
}
```

### Waiting for State

**Good: Explicit condition-based waits**
```typescript
await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 });
await expect(page.locator('.monaco-editor')).toBeVisible();
await expect(page).toHaveURL(/\/session\//, { timeout: 10000 });
```

**Bad: Hard sleeps**
```typescript
// DON'T DO THIS
await page.waitForTimeout(2000);  // Why 2 seconds? What are we waiting for?
```

### Assertions that Verify Real State

```typescript
// Good: Verify the actual state we care about
await expect(studentRow.locator('text=In progress')).toBeVisible();

// Bad: Just checking something is visible without verifying state
await expect(page.locator('div')).toBeVisible();
```

## Common Patterns

### Verifying Code Sync

```typescript
// Type code
await monacoEditor.click();
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.press('Backspace');
await page.keyboard.type(code, { delay: 30 });

// Verify on instructor side - don't just wait, check the actual state
const studentRow = instructorPage.locator(`div.border:has-text("${studentName}")`);
await expect(studentRow).toBeVisible({ timeout: 15000 });
await expect(studentRow.locator('text=In progress')).toBeVisible();
```

### Handling Dialogs

```typescript
// Use specific selectors to avoid matching multiple dialogs
const confirmDialog = page.locator('[role="dialog"][aria-labelledby="confirm-dialog-title"]');
await expect(confirmDialog).toBeVisible();
await confirmDialog.locator('button[data-confirm-button]').click();
```

### Session Replacement Flow

```typescript
// Student sees replacement notification
await expect(page.locator('text=The instructor started a new problem.')).toBeVisible();
await expect(page.locator('[data-testid="join-new-session-button"]')).toBeVisible();

// Student joins replacement
await page.locator('[data-testid="join-new-session-button"]').click();

// Verify clean transition (no stale state)
await expect(page.locator('[data-testid="session-ended-notification"]')).not.toBeVisible();
await expect(page.locator('.monaco-editor')).toBeVisible();
```

## Common Bugs Found via E2E Tests

1. **State not resetting on navigation** - React state persists when URL params change but component stays mounted
2. **Race conditions in async flows** - State updates batched, effects run with stale values
3. **Broadcast channel issues** - Old subscriptions receiving events for new sessions
4. **Missing cleanup** - Refs or state from previous context affecting new context

## Running Tests

```bash
# Prerequisites
npx supabase start
source .env.local

# All E2E tests
npm run test:e2e

# Single file
npx playwright test e2e/session-lifecycle.spec.ts

# With headed browser
npx playwright test e2e/your-test.spec.ts --headed

# With debugging
npx playwright test e2e/your-test.spec.ts --debug
```

## Key Files

- `e2e/helpers/setup.ts` - Test fixtures and configuration
- `e2e/helpers/test-data.ts` - Database helpers for test setup
- `e2e/fixtures/auth-helpers.ts` - Login and auth utilities
- `e2e/helpers/db-helpers.ts` - Low-level Supabase operations
