# Task Workflow

Work on task **$ARGUMENTS** using the task-completer workflow.

1. Fetch task details: `bd show $ARGUMENTS --json`
2. Follow the task-completer skill instructions below

---

${{.claude/skills/task-completer/SKILL.md}}
