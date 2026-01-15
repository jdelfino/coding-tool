---
name: epic-coordinator
description: Coordinate multi-commit epic work using git worktrees, feature branches, PRs, and CI. Use when working on epics or large features that span multiple tasks.
---

# Epic Coordinator

Epics are multi-commit bodies of work that require isolated development on feature branches.

## 1. Setup: Create Branch and Worktree

```bash
# Create feature branch from main
git fetch origin main
git branch feature/<epic-name> origin/main

# Create worktree for isolated development
git worktree add ../coding-tool-<epic-name> feature/<epic-name>
```

**IMPORTANT**: All epic work happens in the worktree, not the main checkout.

## 2. Plan and Parallelize

Break the epic into independent tasks that can be worked on in parallel:

1. Review the epic's subtasks: `bd list --parent <epic-id> --json`
2. Identify tasks that can be parallelized (no dependencies between them)
3. Use the Task tool to spawn sub-agents for independent work

### Sub-Agent Instructions Template

When spawning sub-agents, include these instructions:

```
You are working on a subtask of epic <epic-id> in worktree ../coding-tool-<epic-name>.

TASK: <task description>

WORKFLOW:
1. cd to the worktree: ../coding-tool-<epic-name>
2. Claim the task: bd update <task-id> --status in_progress
3. Implement with tests (CHANGED CODE = NEW TESTS)
4. Run quality gates: npm test && npx tsc --noEmit
5. Commit with: git commit -m "feat: <description>\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
6. Close the task: bd close <task-id> --reason "Completed"

COMMIT CHECKLIST (must pass before committing):
- [ ] Tests written for ALL new/modified code
- [ ] All tests passing (npm test)
- [ ] No TypeScript errors (npx tsc --noEmit)
- [ ] No `as any` or `as unknown` in production code

DO NOT push - the coordinator will handle that.
```

## 3. Develop Incrementally

- Make commits to the feature branch
- Each commit must pass quality gates (tests, tsc)
- Push regularly: `git push -u origin feature/<epic-name>`

## 4. Open PR When Work Seems Complete

```bash
git push -u origin feature/<epic-name>
gh pr create --title "feat: <Epic title>" --body "$(cat <<'EOF'
## Summary
<description of the epic>

## Changes
<bullet list of what was done>

## Test plan
<how to verify the changes>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

## 5. Wait for CI

- ALL CI checks must pass (unit tests, E2E, sandbox tests)
- If CI fails, fix issues and push again
- Do NOT proceed until all checks are green

Check CI status:
```bash
gh pr checks <pr-number>
```

## 6. Get User Approval Before Merging

**MANDATORY**: After CI passes, ASK the user:

> "All CI checks pass on PR #X. Ready to merge with squash? (This will merge N commits into main)"

Do NOT merge without explicit user approval.

## 7. Merge and Cleanup

After user approval:
```bash
# Merge the PR
gh pr merge <number> --squash

# Return to main checkout
cd /workspaces/coding-tool

# Clean up worktree and branch
git worktree remove ../coding-tool-<epic-name>
git branch -d feature/<epic-name>
git pull origin main
```

## 8. Close the Epic

```bash
bd close <epic-id> --reason "Merged in PR #<number>"
```

---

## Epic Completion Checklist

An epic is NOT complete until ALL of these are true:

- [ ] Work is on a feature branch, not main
- [ ] PR is opened
- [ ] All CI checks are green
- [ ] User explicitly approved the merge
- [ ] PR is merged to main
- [ ] Worktree cleaned up
- [ ] Feature branch deleted
- [ ] Epic closed in bd

## Common Violations

- "I committed to main" - Epics MUST use branches
- "PR is open, I'm done" - Must wait for CI and user approval
- "CI passed, merging now" - Must ask user first
- "User said merge" but CI failing - Fix CI first
- Leaving orphaned worktrees/branches - Clean up after merge
