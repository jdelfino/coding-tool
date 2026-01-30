---
name: task-completer
description: Complete individual tasks with test-first development, quality gates, and proper commits. Use when working on bugs, features, or tasks that result in a single commit.
---

# Task Completer

Complete tasks by following these phases **in strict order**. Do not skip phases. Do not proceed to the next phase until the current phase's gate is satisfied.

## Phase 1: Claim

```bash
bd update <task-id> --status in_progress --json
```

**Gate:** Command succeeds and shows `"status": "in_progress"`.

## Phase 2: Write Failing Tests

Write tests for the behavior you are about to change or add. Do this **before** touching any production code.

1. Read the relevant production code to understand current behavior
2. Write new test cases that describe the desired behavior after your change
3. Run the tests:

```bash
npm test
```

**Gate:** Your new tests **fail** (or, for pure deletions/removals, you can write tests asserting the old behavior is gone — these will pass after implementation). If your new tests already pass, they are not testing anything new. Rewrite them.

## Phase 3: Implement

Make the production code changes. Keep changes minimal and focused on the task.

**Principles:**
- Never silently work around problems. Throw errors for missing env vars, invalid state, missing dependencies.
- Mock properly in tests. Do not add production fallbacks to make tests pass.
- No `as any` or `as unknown` in production code.
- No optional chaining on required properties.

## Phase 4: Verify

Run quality gates:

```bash
npm test
npx tsc --noEmit
```

**Gate:** Both commands pass with zero errors. If either fails, fix the issues before proceeding.

## Phase 5: Test Coverage Review

This is an audit, not a formality. Evaluate whether your tests actually cover the changes you made.

### Step 1: List what changed

```bash
git diff --name-only
```

Separate the output into production files and test files.

### Step 2: For each changed production file, evaluate

- **What behavior changed?** (new feature, bug fix, removed feature, refactored logic)
- **What existing tests cover this file?** Read the corresponding test file if one exists.
- **Are there gaps?** Specifically:
  - Happy path for new/changed behavior
  - Error paths and edge cases
  - Regression test if this is a bug fix (a test that would have caught the original bug)
  - Boundary conditions

### Step 3: Evaluate integration test needs

Integration tests are needed when changes affect:
- Repository/persistence layer (database queries, data mapping)
- API routes that combine multiple services
- Auth flows or permission checks
- Data flowing across multiple layers (API → service → repository)

If integration tests are needed, write them as `*.integration.test.ts` files.

### Step 4: Evaluate E2E test needs

E2E tests are kept small and focused on critical workflows to minimize runtime. Check:

1. Do any existing E2E tests cover workflows affected by your changes?
2. If yes, do those E2E tests need updating to reflect your changes?

Do **not** add new E2E tests unless explicitly requested. Only update existing ones when the workflows they test have been modified.

### Step 5: Fill gaps

Write any missing tests identified above. Then re-run quality gates:

```bash
npm test
npx tsc --noEmit
```

**Gate:** All tests pass, including your new coverage additions. If you identified no gaps in Steps 2-4, document your reasoning (e.g., "Changes were purely deletions; added regression tests in Phase 2 confirming removed elements no longer render").

## Phase 6: Commit and Push

```bash
git add -A
git commit -m "$(cat <<'EOF'
<type>: <description>

<optional body>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git pull --rebase
bd sync
git push
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

**Gate:** `git push` succeeds. If push fails, resolve and retry. Work is not complete until pushed.

## Phase 7: Close

```bash
bd close <task-id> --reason "Completed" --json
```

File issues for any remaining or discovered work:

```bash
bd create "Remaining work description" -t task -p 2 --json
```

Summarize what was done and note any follow-up tasks created.
