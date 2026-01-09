# User Guide: Live Coding Classroom

## Getting Started

### Sign In

1. Navigate to http://localhost:3000/auth/signin
2. Enter your email and password
3. You'll be redirected based on your role:
   - System admins → `/system`
   - Namespace admins → `/admin`
   - Instructors → `/instructor`
   - Students → `/student`

### Registration

1. Navigate to http://localhost:3000/auth/register
2. Fill in email, username, password, and organization ID
3. Click "Register" - you'll be signed in automatically

**Note:** If your email matches `SYSTEM_ADMIN_EMAIL`, you'll be promoted to system admin.

## For Instructors

### Managing Classes

1. From the instructor dashboard, click "Classes"
2. Create a new class (e.g., "CS 101 - Intro to Programming")
3. Add sections to your class (e.g., "Fall 2025 - Section A")
4. Each section gets a unique join code (format: ABC-123-XYZ)

### Starting a Session

1. Select a section from your dashboard
2. Click "New Session" to create a coding session
3. Set the problem statement or load from the problem library
4. Students in the section can see and join active sessions

### Monitoring Students

- **Student List**: See all connected students with code status indicators
  - ✓ (green) = has written code
  - ○ (gray) = no code yet
- **View Code**: Click a student to view their code in real-time
- **Run Code**: Execute student code and see results
- **AI Walkthrough**: Generate discussion scripts from submissions

### Problem Library

1. Navigate to "Problems" from the instructor menu
2. Create reusable problems with:
   - Title and description
   - Starter code template
   - Solution (hidden from students)
   - Difficulty and tags
3. Load problems into sessions with one click

### Public View

- Share a read-only view for classroom displays
- URL: `/instructor/public?session=[id]`
- Updates in real-time via Supabase Realtime

## For Students

### Joining a Section

1. Get the join code from your instructor (format: ABC-123-XYZ)
2. Navigate to "Join Section" from your dashboard
3. Enter the join code and click "Join"
4. You're now enrolled in that section

### Participating in Sessions

1. Active sessions appear on your dashboard
2. Click to join a session
3. Read the problem statement at the top
4. Write Python code in the Monaco editor
5. Click "Run Code" to execute and see output

### Code Editor Tips

- Your code auto-saves and syncs with the instructor
- Syntax highlighting for Python
- Line numbers for easy reference
- **Keyboard Shortcuts:**
  - `Ctrl/Cmd + /` - Comment/uncomment
  - `Tab` / `Shift+Tab` - Indent/unindent
  - `Ctrl/Cmd + Z` - Undo
  - `Ctrl/Cmd + F` - Find

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Join code not working | Verify all characters, codes are case-insensitive |
| Connection lost | Check internet, page auto-reconnects |
| Code timeout | Loops timeout after 10 seconds |
| Can't see problem | Wait for instructor to set it, or refresh |

## Getting Help

1. Check connection status indicator
2. Refresh your browser
3. Rejoin the session
4. Contact your instructor
