---
name: e2e-testing
description: Writing and debugging E2E tests with Playwright.
---

# E2E Testing Skill

## Core Principles

1. **Failing tests indicate real bugs.** E2E tests that fail for "unknown reasons" almost always reveal an app bug or test deficiency. Never increase timeouts as a fix, skip verifications, or ignore "flaky" assertions.

2. **Debug locally, one test at a time.** Never debug by pushing to CI.
   ```bash
   npx playwright test e2e/your-test.spec.ts --reporter=line
   npx playwright test e2e/your-test.spec.ts --headed  # Watch the browser
   npx playwright test e2e/your-test.spec.ts --debug   # Step through
   ```

3. **Fix the app, not the test.** When you find unexpected state, trace it back through the code until you find the root cause in application logic.

## Debugging Approach

### 1. Read the Error Message

The assertion failure tells you the exact locator and expected vs. actual state. Start there.

### 2. Check Page Structure Output

Failed tests generate `test-results/<test-name>/error-context.md` with a YAML representation of the page structure:

```yaml
- heading "Code Classroom" [level=1] [ref=e10]
- paragraph [ref=e11]: Enter your section code to get started
- textbox "Section Join Code" [active] [ref=e15]
- button "Join Section" [disabled] [ref=e16]
```

This shows the actual DOM state at failure time—often more useful than screenshots for understanding what's rendered.

### 3. Check Screenshots and Video

- `test-results/.../test-failed-1.png` - Visual state at failure
- `test-results/.../video.webm` - Full test recording

### 4. Trace Back the Bug

When UI shows unexpected state:
1. What state is visible?
2. What code sets that state?
3. Why would that condition be true?

Follow the chain until you find the root cause.

## Writing Tests

See existing tests in `e2e/` as examples. Key patterns:

- **Setup via DB helpers**, not UI clicks (`e2e/helpers/test-data.ts`)
- **Separate browser contexts** for multi-user tests
- **Explicit waits** on conditions, never `waitForTimeout()`
- **Always cleanup** in `finally` block

## Running Tests

```bash
npx supabase start && source .env.local  # Prerequisites
npm run test:e2e                          # All tests
npx playwright test e2e/your-test.spec.ts # Single file
```

## Key Files

- `e2e/helpers/setup.ts` - Fixtures and configuration
- `e2e/helpers/test-data.ts` - Database setup helpers
- `e2e/fixtures/auth-helpers.ts` - Login utilities
