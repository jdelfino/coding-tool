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

# Install dependencies in the worktree BEFORE spawning sub-agents
cd ../coding-tool-<epic-name>
npm install
cd /workspaces/coding-tool
```

**IMPORTANT**: All epic work happens in the worktree, not the main checkout. Always run `npm install` in the worktree before spawning sub-agents to avoid concurrent installation conflicts.

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

## 4. Review Sub-Agent Work

**You are accountable for ALL sub-agent work quality.** Sub-agents make mistakes. Before opening a PR, you MUST verify their work meets standards.

### Review Checklist (for each completed task)

- [ ] **Read the code changes** - Actually read what was written, don't trust blindly
- [ ] **Tests exist and are meaningful** - Not just "test passes", but tests that would catch regressions
- [ ] **Tests pass** - Run `npm test` in the worktree
- [ ] **No TypeScript errors** - Run `npx tsc --noEmit`
- [ ] **No obvious issues** - Security holes, logic errors, missing edge cases
- [ ] **Follows project patterns** - Consistent with existing codebase style

### When to Review

Review incrementally as tasks complete. Don't wait until all tasks are done:

1. When a sub-agent reports completion, review their commit immediately
2. If issues found, fix them before moving on (or spawn another agent to fix)
3. Track which tasks have been reviewed

### If Issues Are Found

Fix problems before opening PR:
- Minor issues: Edit directly and amend/create new commit
- Major issues: Spawn a sub-agent with clear fix instructions
- Blocking issues: May need to revert and redo the task

**DO NOT open a PR until all sub-agent work has been reviewed and verified.**

## 5. Open PR When Work Is Complete And Reviewed

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

## 6. Wait for CI

- ALL CI checks must pass (unit tests, E2E, sandbox tests)
- If CI fails, fix issues and push again
- Do NOT proceed until all checks are green

Check CI status:
```bash
gh pr checks <pr-number>
```

## 7. Get User Approval Before Merging

**MANDATORY**: After CI passes, ASK the user:

> "All CI checks pass on PR #X. Ready to merge with squash? (This will merge N commits into main)"

Do NOT merge without explicit user approval.

## 8. Merge and Cleanup

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

## 9. Close the Epic

```bash
bd close <epic-id> --reason "Merged in PR #<number>"
```

---

## Epic Completion Checklist

An epic is NOT complete until ALL of these are true:

- [ ] Work is on a feature branch, not main
- [ ] **All sub-agent work has been reviewed by coordinator**
- [ ] PR is opened
- [ ] All CI checks are green
- [ ] User explicitly approved the merge
- [ ] PR is merged to main
- [ ] Worktree cleaned up
- [ ] Feature branch deleted
- [ ] Epic closed in bd

## Common Violations

- "I committed to main" - Epics MUST use branches
- "Sub-agent said it's done, moving on" - You MUST review their work first
- "Tests pass so the code is good" - Read the actual code, verify test quality
- "PR is open, I'm done" - Must wait for CI and user approval
- "CI passed, merging now" - Must ask user first
- "User said merge" but CI failing - Fix CI first
- Leaving orphaned worktrees/branches - Clean up after merge
