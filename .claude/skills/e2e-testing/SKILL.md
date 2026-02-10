---
name: e2e-testing
description: Writing and debugging E2E tests with Playwright.
---

# E2E Testing Skill

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
npx playwright test e2e/your-test.spec.ts --reporter=line
npx playwright test e2e/your-test.spec.ts --headed  # Watch the browser
npx playwright test e2e/your-test.spec.ts --debug   # Step through
```

Only push when tests pass locally. CI should validate, not debug.

### 3. Fix the App, Not the Test

When you find unexpected state, trace it back through the code until you find the root cause in application logic. Fix the application code, not the test.

## Debugging Approach

### Step 1: Read the Error Message

```
Error: expect(locator).toBeVisible() failed
Locator: locator('[data-testid="session-ended-notification"]')
Expected: not visible
Received: visible
```

This tells you exactly what's wrong. Don't guess—investigate why that state occurred.

### Step 2: Check Page Structure Output

Failed tests generate `test-results/<test-name>/error-context.md` with a YAML representation of the page structure:

```yaml
- heading "Code Classroom" [level=1] [ref=e10]
- paragraph [ref=e11]: Enter your section code to get started
- textbox "Section Join Code" [active] [ref=e15]
- button "Join Section" [disabled] [ref=e16]
```

This shows the actual DOM state at failure time—often more useful than screenshots for understanding what elements are rendered and their states.

### Step 3: Check Screenshots and Video

- `test-results/.../test-failed-1.png` - Visual state at failure
- `test-results/.../video.webm` - Full test recording

### Step 4: Trace Back the Bug

When the UI shows unexpected state:
1. **What state is visible?** (e.g., "Session ended" banner)
2. **What sets that state?** (e.g., `setSessionEnded(true)`)
3. **Why would that be set?** (e.g., session.status === 'completed')
4. **Why is that condition true?** (e.g., stale data from previous session)

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
