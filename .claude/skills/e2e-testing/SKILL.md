---
name: e2e-testing
description: Writing, running, and debugging Playwright E2E tests in coding-tool.
---

# E2E Testing

Guide for writing, running, and debugging Playwright E2E tests. Tests run against
the real Next.js app (auto-started via `webServer`) and a local Supabase stack.

## Core Principles

1. **Failing tests indicate real bugs.** The tests drive the real app. If a test fails, investigate the app, not the test.
2. **Debug locally first.** Read the error, then the page-structure dump, screenshots/video, and console logs. Most failures are obvious once you look at the artifacts. Never debug by pushing to CI.
3. **Fix the app, not the test.** Only change the test if the test itself is wrong (bad selector, wrong expectation, race in the test). Never "fix" a test by bumping timeouts.
4. **Tests must be independent.** Each test creates its own namespace and cleans up after itself. `helpers/setup.ts` also clears test data before each test.

## Debugging Approach

When a test fails, in order:

### 1. Read the error message
Playwright says exactly which selector failed and why. Start there.

### 2. Check the page-structure dump
Failed tests write `test-results/<test-name>/error-context.md` — a YAML snapshot of the DOM at failure time (roles, labels, disabled states). Often more useful than a screenshot for seeing what actually rendered.

### 3. Check artifacts (screenshot / video / trace)
Config captures **screenshot** `only-on-failure`, **video** `retain-on-failure`, and **trace** `on-first-retry`. Open the report:
```bash
npx playwright show-report
```

### 4. Check API responses / email
Look for non-200s or unexpected bodies in the captured console logs. For auth/MFA/invitation flows, inspect sent email in the local **Mailpit UI at http://localhost:54324** (the `helpers/inbucket-client.ts` helpers read from it).

### 5. Trace back to the bug
Common patterns:
- **Element not found / timeout** — selector changed, or the page never loaded (API error, auth/RLS issue).
- **Text mismatch** — the API/DB returned unexpected data.
- **Setup failure** — a `getSupabaseAdmin()` insert or sign-in helper threw; check Supabase is running and migrations are applied (`npx supabase db reset`).

### 6. Run in headed / debug mode
```bash
npx playwright test e2e/your-test.spec.ts --headed   # watch the browser
npx playwright test e2e/your-test.spec.ts --debug    # Playwright Inspector, step through
```

## Running Tests

Prerequisite: local Supabase running and `.env.local` present (the devcontainer does this on boot; otherwise `npx supabase start`). `SUPABASE_SECRET_KEY` must be set — specs are **skipped** without it (`hasSupabaseCredentials()`).

```bash
npm run test:e2e                         # full suite (auto-starts the app)
npx playwright test e2e/your-test.spec.ts # single file
npx playwright test -g "substring"        # single test by name
```

## Writing Tests

### Structure

Import the extended `test`/`expect` from `helpers/setup` (it clears test data before each test):

```typescript
import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials, getTestUserEmail } from './helpers/db-helpers';
import {
  loginAsInstructor, loginAsStudent,
  generateTestNamespaceId, createTestNamespace, cleanupNamespace,
} from './fixtures/auth-helpers';
import { getSupabaseAdmin, createTestClass, createTestSection } from './helpers/test-data';

const describeE2E = hasSupabaseCredentials() ? test.describe : test.describe.skip;

describeE2E('Feature', () => {
  test('does the thing', async ({ page, browser }) => {
    const namespaceId = generateTestNamespaceId();
    await createTestNamespace(namespaceId);
    try {
      // 1. DATA SETUP via Supabase service role (fast, no UI)
      const supabase = getSupabaseAdmin();
      // ... createTestClass / createTestSection / createTestProblem ...

      // 2. AUTH + UI
      await loginAsInstructor(page, `instructor-${namespaceId}`, namespaceId);
      await page.goto('/instructor');

      // 3. ASSERT
      await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible();
    } finally {
      await cleanupNamespace(namespaceId);
    }
  });
});
```

### Key patterns

- **Set up data via Supabase, not UI clicks.** Use `getSupabaseAdmin()` + the `helpers/test-data.ts` helpers (`createTestClass`, `createTestSection`, `createTestProblem`, `createInstructorForSection`, `setupTestNamespaceWithSection`, `createTestInvitation`). Only drive the UI for the flow you're actually verifying.
- **Namespace isolation.** Every test gets a unique `namespaceId` (`generateTestNamespaceId()`); pass it to the login/data helpers and `cleanupNamespace()` in `finally`.
- **Auth helpers** create the user (Supabase admin) then sign in through the UI: `loginAsInstructor`/`loginAsStudent`/`loginAsSystemAdmin`, or `signInAs(page, username, role, namespaceId)`. **system-admin** triggers an MFA OTP — the helper reads it from Mailpit automatically; if it hangs, check http://localhost:54324.
- **Multi-actor tests** (instructor + student): use a separate `browser.newContext()` per user; close extra contexts in `finally`.
- **Waiting:** rely on auto-waiting (`expect(...).toBeVisible()`, `page.waitForURL()`). Avoid `waitForTimeout` except a brief settle for the debounced code sync.

### Monaco editor

The code editor is Monaco. There is no test hook — interact through the rendered editor:

```typescript
const editor = page.locator('.monaco-editor').first();
await editor.click();
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.press('Backspace');
await page.keyboard.type('print("hello")', { delay: 50 }); // delay lets Monaco capture keystrokes
await page.waitForTimeout(300);                              // settle for debounced sync
```

Monaco splits text across DOM nodes — assert on the `.monaco-editor` text content (partial match), not a single element.

## Key Files

| File | Purpose |
|------|---------|
| `e2e/helpers/setup.ts` | Extended `test`/`expect`; clears test data before each test |
| `e2e/helpers/db-helpers.ts` | `createTestUser`, namespace create/cleanup, `hasSupabaseCredentials`, test email/password |
| `e2e/helpers/test-data.ts` | `getSupabaseAdmin()` + class/section/problem/invitation setup helpers |
| `e2e/helpers/inbucket-client.ts` | Read email/OTP from Mailpit (localhost:54324) |
| `e2e/fixtures/auth-helpers.ts` | `signInAs`, `loginAs*`, sidebar navigation helpers |
| `playwright.config.ts` | `testDir: e2e/`, Chromium, 2 workers (non-CI), retries 0, 30s timeout, auto `webServer`, baseURL `localhost:3000` |
