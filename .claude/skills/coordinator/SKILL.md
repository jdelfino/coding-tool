---
name: coordinator
description: Single entry point for all implementation work. Triages tasks, manages beads issues, decides direct vs. branch execution, delegates to implementer skill, runs reviewers, creates PRs.
---

# Coordinator

You are the single entry point for all implementation work. You triage incoming work, manage the beads lifecycle, and either execute directly or orchestrate subagents.

## Phase 1: Triage

### 1. Parse Input

The input is either a beads ID or an ad-hoc description.

**If beads ID:**
```bash
bd show <id> --json
```

If it's an epic, also fetch subtasks:
```bash
bd list --parent <id> --json
```

**If ad-hoc description (no beads ID):**
Create a beads issue first:
```bash
bd create "<description>" -t <task|bug|feature> -p 2 --json
```

### 2. Choose Execution Mode

| Condition | Mode |
|-----------|------|
| Single task (not epic, no subtasks) | **Direct** |
| Epic or has subtasks | **Branch** |
| User explicitly requests PR | **Branch** |

---

## Direct Mode

For single tasks. Work in the main checkout, commit to main, no PR.

### 1. Claim

```bash
bd update <id> --status in_progress --json
```

### 2. Develop

Follow the implementer skill phases 1-4:

@.claude/skills/implementer/SKILL.md

### 3. Commit and Push

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

### 4. Close

```bash
bd close <id> --reason "Completed" --json
```

File issues for any remaining or discovered work:
```bash
bd create "Remaining work description" -t task -p 2 --json
```

Summarize what was done and note any follow-up tasks created.

---

## Branch Mode

For epics, multi-task work, or when a PR is needed. Uses worktrees and subagents.

### 1. Setup

```bash
# Create feature branch from main
git fetch origin main
git branch feature/<work-name> origin/main

# Create worktree
git worktree add ../coding-tool-<work-name> feature/<work-name>

# CRITICAL: Install dependencies BEFORE spawning subagents
cd ../coding-tool-<work-name>
npm install
cd /workspaces/coding-tool
```

### 2. Conflict Avoidance

Before parallelizing tasks, analyze file overlap:

Tasks conflict if they likely touch the same files:
- Same component/module
- Same API route
- Same database table/repository
- Shared utilities they might both modify

```
Task A: Add user profile page (src/app/profile/*)
Task B: Fix login bug (src/app/login/*)
→ SAFE to parallelize (different directories)

Task A: Add validation to UserForm
Task B: Add new field to UserForm
→ NOT SAFE (same component)
```

When in doubt, add a dependency:
```bash
bd dep add <later-task-id> <earlier-task-id> --json
```

### 3. Implement Tasks

**Independent tasks CAN run in parallel. Dependent tasks MUST wait.**

For each task:

#### a. Claim
```bash
bd update <task-id> --set-labels wip --json
```

#### b. Spawn Implementer Subagent

Use the Task tool with `subagent_type: "general-purpose"`:

```
ROLE: Implementer
SKILL: Read and follow .claude/skills/implementer/SKILL.md

WORKTREE: ../coding-tool-<work-name>
TASK: <task-id>

Task description:
<paste full task description from bd show>

CONSTRAINTS:
- Work ONLY in the worktree path above
- Do NOT modify beads issues
- Commit and push your work when implementer phases are complete
- Report outcome in this format:

IMPLEMENTATION RESULT: SUCCESS
Task: <task-id>
Commit: <full commit hash>
Summary: <1-2 sentences>

Or on failure:

IMPLEMENTATION RESULT: FAILURE
Task: <task-id>
Error: <what went wrong>
Details: <explanation or key error message>
```

#### c. Handle Result

**On SUCCESS:**
```bash
bd close <task-id> --reason "Implemented" --json
```

**On FAILURE:**
- If recoverable: fix directly or spawn new subagent with clarification
- If blocked: note the blocker, move to next task
- Do NOT close the task

### 4. Pre-PR Review

After all tasks are complete, run 3 specialized reviews **in parallel** using the Task tool:

**Correctness Reviewer:**
```
ROLE: Correctness Reviewer
SKILL: Read and follow .claude/skills/reviewer-correctness/SKILL.md

WORKTREE: ../coding-tool-<work-name>
BASE: origin/main
SUMMARY: <what this PR implements>
```

**Test Quality Reviewer:**
```
ROLE: Test Quality Reviewer
SKILL: Read and follow .claude/skills/reviewer-tests/SKILL.md

WORKTREE: ../coding-tool-<work-name>
BASE: origin/main
SUMMARY: <what this PR implements>
```

**Architecture Reviewer:**
```
ROLE: Architecture Reviewer
SKILL: Read and follow .claude/skills/reviewer-architecture/SKILL.md

WORKTREE: ../coding-tool-<work-name>
BASE: origin/main
SUMMARY: <what this PR implements>
REFERENCE DIRS: <key directories in the existing codebase to compare against>
```

**Handle review results:**

- **Trivial issues** (typos, minor naming): fix directly, commit
- **Non-trivial issues** (bugs, missing tests, duplication): file a beads issue, spawn implementer, close when fixed

After all issues resolved, re-run quality gates.

### 5. Create PR

```bash
cd ../coding-tool-<work-name>
npm test
npx tsc --noEmit
```

**Do NOT create PR if any checks fail.** Fix locally first.

```bash
git push -u origin feature/<work-name>

gh pr create --title "<type>: <title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points>

## Changes
<list of significant changes>

## Test plan
- [ ] Tests pass
- [ ] <manual verification steps if any>

Generated with Claude Code
EOF
)"
```

### 6. Watch CI and Merge

```bash
gh pr checks <pr-number> --watch
```

If CI fails: read logs, fix locally, commit, push, wait again.

After CI passes:
> "All CI checks pass on PR #X. Ready to merge?"

**WAIT for explicit user approval before merging.**

```bash
gh pr merge <number> --squash

# Cleanup
cd /workspaces/coding-tool
git worktree remove ../coding-tool-<work-name>
git branch -d feature/<work-name>
git pull origin main
```

Close epic if applicable:
```bash
bd close <epic-id> --reason "Merged in PR #<number>" --json
```

---

## Anti-Patterns

- Starting dependent task before blocker is closed
- Parallelizing tasks that touch same files
- Creating PR before running specialized reviews
- Creating PR with failing tests
- Merging without user approval
- Leaving orphaned worktrees/branches
- Running npm install concurrently in multiple worktrees
- Fixing non-trivial review issues inline — file issues and spawn implementers instead
