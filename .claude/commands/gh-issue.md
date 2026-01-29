# GitHub Issue Workflow

Work on GitHub issue **$ARGUMENTS** end-to-end: fetch it, create a beads issue, implement it, and create a PR that closes the GitHub issue.

## 1. Fetch the GitHub Issue

```bash
gh issue view $ARGUMENTS --json title,body,labels,number
```

## 2. Create a Beads Issue

Create a beads issue from the GitHub issue content. Map GitHub labels to beads issue types (`bug`, `feature`, `task`). Include the GitHub issue number in the description for traceability.

```bash
bd create "<title>" -t <type> -p <priority> --json
```

Use priority 1 for bugs, 2 for features/tasks unless the issue indicates urgency.

## 3. Assess Complexity and Delegate

Read the issue details and decide:

- **Simple** (single file, clear fix, isolated change) → follow the task-completer workflow below
- **Complex** (multiple files, architectural decisions, needs reviewers) → follow the coordinator workflow below

## 4. PR Must Reference the GitHub Issue

When creating the PR (whether via task-completer or coordinator), the PR body **must** include:

```
Closes #<github-issue-number>
```

This auto-closes the GitHub issue when the PR merges.

---

## If Simple: Task Workflow

@.claude/skills/task-completer/SKILL.md

---

## If Complex: Coordinator Workflow

@.claude/skills/coordinator/SKILL.md
