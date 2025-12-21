# Agent Instructions

!!! Critical top-level context:
You are an experienced software engineer, building well-structured, well-maintained
software. You should not create or tolerate significant duplication, architectural
mess, or poor code organization. Clean small messes up immediately, and file tickets 
for resolving larger issues in follow-on work.

# 🚨 CRITICAL: TEST-FIRST DEVELOPMENT 🚨

**STOP! READ THIS BEFORE WRITING ANY CODE:**

## Tests Are NOT Optional

**Every single line of production code MUST have corresponding test coverage.**
**If you write code without tests, you are doing it WRONG.**

### Non-Negotiable Rules:

1. **TESTS COME FIRST** - Write tests BEFORE implementation when possible
2. **NO COMMITS WITHOUT TESTS** - If you implemented it, you must test it
3. **NO EXCEPTIONS** - "I'll add tests later" is NOT acceptable
4. **CODE + TESTS = ONE ATOMIC COMMIT** - Never commit code without its tests

### When Writing ANY Code:

```
✅ CORRECT WORKFLOW:
1. Write test file (.test.ts or .test.tsx)
2. Write failing tests for new functionality
3. Implement the functionality
4. Make tests pass
5. Refactor if needed
6. Run ALL tests (`npm test`)
7. Commit code + tests together

❌ WRONG WORKFLOW:
1. Implement functionality
2. Commit
3. "I'll add tests later" ← THIS IS UNACCEPTABLE
```

### Test File Requirements:

- **New function/class** → Create corresponding `.test.ts` file
- **New React component** → Create corresponding `.test.tsx` file  
- **Modified code** → Update existing tests + add new test cases
- **Bug fix** → Add regression test(s) that would have caught the bug
- **Edge cases** → Test error conditions, boundaries, null/undefined
- **Integration points** → Mock dependencies, test interfaces

### Test Quality Standards:

- ✅ Tests must be isolated (no side effects between tests)
- ✅ Use descriptive test names: `it('should reject invalid email format')`
- ✅ Test both happy path AND error cases
- ✅ Mock external dependencies (file system, network, database)
- ✅ Tests should run fast (< 1 second per test file)
- ✅ Aim for 80%+ code coverage on new code

### Before EVERY Commit - Checklist:

```bash
# 1. Did you write tests? If NO, stop and write them now
npm test

# 2. Do all tests pass?
# If NO, fix the failures before committing

# 3. No TypeScript errors?
npx tsc --noEmit

# 4. Ready to commit
git add <files>
git commit -m "..."
```

## Commit Checklist

⚠️ MANDATORY: Before every commit, verify:

- [ ] 🚨 **TESTS WRITTEN** - Unit tests exist for ALL new/modified code (CHECK THIS FIRST)
- [ ] ✅ All tests passing (`npm test`). Commits should never be made with failing tests.
- [ ] ✅ No TypeScript errors (`npx tsc --noEmit`). Commits should never be made with TypeScript errors.
- [ ] ✅ Test coverage adequate (run `npm test -- --coverage` to verify)
- [ ] ✅ No type assertions (`as any`, `as unknown`) remain in production code. Use proper interfaces instead.
- [ ] ✅ No optional chaining on required properties (`user?.role` when role is always present).

**If you cannot check the first box, DO NOT COMMIT. Go write the tests first.**

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**
```bash
bd ready --json
```

**Create new issues:**
```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
bd create "Subtask" --parent <epic-id> --json  # Hierarchical subtask (gets ID like epic-id.1)
```

**Claim and update:**
```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**
```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`
6. **Commit together**: Always commit the `.beads/issues.jsonl` file together with the code changes so issue state stays in sync with code state

### Writing Self-Contained Issues

Issues must be fully self-contained - readable without any external context (plans, chat history, etc.). A future session should understand the issue completely from its description alone.

**Required elements:**
- **Summary**: What and why in 1-2 sentences
- **Files to modify**: Exact paths (with line numbers if relevant)
- **Implementation steps**: Numbered, specific actions
- **Example**: Show before → after transformation when applicable

**Optional but helpful:**
- Edge cases or gotchas to watch for
- Test references (point to test files or test_data examples)
- Dependencies on other issues

**Bad example:**
```
Implement the refactoring from the plan
```

**Good example:**
```
Add timeout parameter to fetchUser() in src/api/users.ts

1. Add optional timeout param (default 5000ms)
2. Pass to underlying fetch() call
3. Update tests in src/api/users.test.ts

Example: fetchUser(id) → fetchUser(id, { timeout: 3000 })
Depends on: bd-abc123 (fetch wrapper refactor)
```

### Dependencies: Think "Needs", Not "Before"

`bd dep add X Y` = "X needs Y" = Y blocks X

**TRAP**: Temporal words ("Phase 1", "before", "first") invert your thinking!
```
WRONG: "Phase 1 before Phase 2" → bd dep add phase1 phase2
RIGHT: "Phase 2 needs Phase 1" → bd dep add phase2 phase1
```
**Verify**: `bd blocked` - tasks blocked by prerequisites, not dependents.

### Auto-Sync

bd automatically syncs with git:
- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Managing AI-Generated Planning Documents

AI assistants often create planning and design documents during development:
- PLAN.md, IMPLEMENTATION.md, ARCHITECTURE.md
- DESIGN.md, CODEBASE_SUMMARY.md, INTEGRATION_PLAN.md
- TESTING_GUIDE.md, TECHNICAL_DESIGN.md, and similar files

**Best Practice: Use a dedicated directory for these ephemeral files**

**Recommended approach:**
- Create a `history/` directory in the project root
- Store ALL AI-generated planning/design docs in `history/`
- Keep the repository root clean and focused on permanent project files
- Only access `history/` when explicitly asked to review past planning

**Example .gitignore entry (optional):**
```
# AI planning documents (ephemeral)
history/
```

**Benefits:**
- ✅ Clean repository root
- ✅ Clear separation between ephemeral and permanent documentation
- ✅ Easy to exclude from version control if desired
- ✅ Preserves planning history for archeological research
- ✅ Reduces noise when browsing the project

### CLI Help

Run `bd <command> --help` to see all available flags for any command.
For example: `bd create --help` shows `--parent`, `--deps`, `--assignee`, etc.

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ✅ Store AI planning docs in `history/` directory
- ✅ Run `bd <cmd> --help` to discover available flags
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems
- ❌ Do NOT clutter repo root with planning documents

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

