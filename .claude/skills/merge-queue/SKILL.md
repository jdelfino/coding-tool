---
name: merge-queue
description: Process open PRs — merge when CI passes, handle rebases, file issues for failures. Run in a dedicated window.
---

# Merge Queue

Process all open PRs. Merge what's ready, rebase what's behind, file issues for failures.

Run this in a dedicated terminal window. Invoke periodically with `/merge` while other windows do `/work`.

## Step 1: Scan

```bash
gh pr list --json number,title,headRefName,statusCheckRollup,mergeable,body,reviewRequests,reviews
```

## Step 2: Categorize

For each PR, determine its state:

| State | Action |
|-------|--------|
| CI passing, mergeable, no pending review | Merge |
| CI passing, mergeable, review requested but not approved | Skip, report |
| CI passing, mergeable, review approved | Merge |
| CI pending | Skip, report status |
| CI failing | File issue, report |
| Not mergeable (behind main) | Attempt rebase |

## Step 3: Decide Merge Order

When multiple PRs are ready, use judgment to balance:

- **Impact**: prefer merging high-impact features first
- **Merge conflict risk**: larger changes sitting unmerged cause more conflicts for other PRs
- **Goal**: keep changes flowing. Don't always defer large changes — that makes the conflict problem worse

## Step 4: Merge

For each mergeable PR (in priority order):

```bash
gh pr merge <number> --squash
```

**After each merge:**

1. Parse beads issue IDs from PR body (look for `Beads: id1, id2` line)
2. Close each:
   ```bash
   bd close <id> --reason "Merged in PR #<number>" --json
   ```
3. Remove worktree if it exists:
   ```bash
   git worktree remove ../coding-tool-<branch-name> 2>/dev/null
   ```
4. Delete feature branch:
   ```bash
   git branch -d feature/<branch-name> 2>/dev/null
   ```
5. Pull main:
   ```bash
   git pull origin main
   ```

**Important:** after each merge, re-check remaining PRs — merging one PR may make others unmergeable (need rebase) or may resolve conflicts.

## Step 5: Handle Rebases

When a PR is not mergeable (behind main):

```bash
git fetch origin main

# Use existing worktree if present, otherwise create one
cd <existing-worktree>  # or: git worktree add ../coding-tool-rebase-<number> <branch>
git rebase origin/main
```

- **Clean rebase:** force-push and report "Rebased PR #X, CI re-running."
  ```bash
  git push --force-with-lease
  ```
- **Conflict:** do not attempt to resolve. File a beads issue describing the conflict and which files are affected. Report to user.

After rebase, clean up any temporary worktree created for the rebase.

## Step 6: Handle CI Failures

**Test failures are real. Never rerun. Never ignore.**

When CI fails on a PR:

1. Fetch failure logs:
   ```bash
   gh pr checks <number>
   gh run view <run-id> --log-failed
   ```
2. File a beads issue with:
   - The failure details (which test, error message)
   - PR reference
   - Priority based on severity
   ```bash
   bd create "CI failure on PR #<number>: <summary>" -t bug -p 1 --json
   ```
3. Report to user with the beads issue ID

**If main itself has failing tests:** this blocks the entire merge queue. File a P0 beads issue and report prominently.

```bash
# Check main CI status
gh run list --branch main --limit 1 --json status,conclusion
```

## Step 7: Report Summary

After processing all PRs, output a summary:

```
Merge Queue Summary:
- PR #12: Merged (closed coding-tool-abc, coding-tool-def)
- PR #15: CI passing, awaiting your review
- PR #18: Rebased, CI re-running
- PR #20: CI failing — filed coding-tool-xyz
- PR #22: CI pending (2/3 checks done)

Action needed:
- coding-tool-xyz: Test failure on PR #20, needs /work coding-tool-xyz
- PR #15: Awaiting your review on GitHub
```

Always include beads issue IDs so the user can dispatch `/work` for fixes.

If there are no open PRs, report "No open PRs."

## What This Agent Does NOT Do

- Write code or fix test failures (file issues for `/work` instead)
- Resolve merge conflicts (file issues instead)
- Rerun failed CI (test failures are real)
- Close beads issues without a successful merge
- Merge PRs with pending review requests
