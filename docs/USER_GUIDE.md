# User Guide: Live Coding Classroom

## Instructor Workflow

### Starting a Session

1. **Navigate to the Application**
   - Open your browser to http://localhost:3000 (or the deployed URL)
   - Click "I'm an Instructor"

2. **Create a Session**
   - Click the "Create Session" button
   - A 6-character join code will be displayed in large text
   - This code is what students will use to join

3. **Set the Problem**
   - In the "Problem Statement" section, type the coding problem
   - Example: "Write a function that returns the sum of two numbers"
   - Click "Update Problem" to send it to all students
   - Students will see the problem immediately

### Monitoring Students

4. **View Connected Students**
   - The student list shows all connected students
   - Green indicator (✓) means the student has written code
   - Gray indicator (○) means no code yet

5. **View Student Code**
   - Click "View Code" next to any student's name
   - Their code appears in the code viewer panel
   - Code is syntax-highlighted for readability

6. **Run Student Code**
   - While viewing a student's code, click "Run Code"
   - Execution results appear below the code
   - Shows both output and any errors
   - Displays execution time

### Best Practices

- **Project the join code**: Make it visible to the entire class
- **Update problems early**: Set the problem before students write code
- **Monitor progress**: Check the "Has code" indicators
- **Anonymous viewing**: Student names shown only to you
- **Live demonstration**: Use "View Code" to show examples on the projector

## Student Workflow

### Joining a Session

1. **Navigate to the Application**
   - Open your browser to http://localhost:3000
   - Click "I'm a Student"

2. **Enter Join Information**
   - Type your name (this helps your instructor identify you)
   - Enter the 6-character join code provided by your instructor
   - Click "Join Session"

### Writing Code

3. **Read the Problem**
   - The problem statement appears at the top
   - It will update automatically if the instructor changes it

4. **Write Your Code**
   - Use the Monaco code editor (same as VS Code)
   - Python syntax highlighting is enabled
   - Line numbers help you navigate
   - Your code auto-saves to the instructor's view

5. **Run Your Code**
   - Click "Run Code" to execute
   - Output appears in the panel below
   - Errors are shown in red with helpful messages
   - Execution time is displayed

### Tips

- **Start simple**: Test your code with simple cases first
- **Read errors carefully**: Error messages help you debug
- **Auto-save**: Your code saves automatically, no need to submit
- **Connection status**: Green dot means you're connected
- **Stay connected**: Keep the browser tab open during the session

## Troubleshooting

### Common Issues

**Join Code Not Working**
- Check that you entered all 6 characters
- Codes are case-insensitive
- Make sure the instructor's session is still active

**Connection Lost**
- Check your internet connection
- The app will try to reconnect automatically
- Reload the page if needed

**Code Won't Run**
- Check for syntax errors (missing colons, indentation)
- Python 3 syntax required
- Standard library only (no pip packages)

**Can't See the Problem**
- Wait for instructor to set the problem
- Refresh the page if needed
- Check connection status indicator

**Code Execution Timeout**
- Infinite loops will be stopped after 10 seconds
- Simplify your code to run faster
- Check for logic errors causing hangs

### Getting Help

If you experience issues:
1. Check the connection status indicator
2. Refresh your browser
3. Rejoin the session with the same join code
4. Ask your instructor for assistance

## Keyboard Shortcuts (Code Editor)

- **Ctrl/Cmd + /** - Comment/uncomment line
- **Tab** - Indent
- **Shift + Tab** - Unindent
- **Ctrl/Cmd + Z** - Undo
- **Ctrl/Cmd + Shift + Z** - Redo
- **Ctrl/Cmd + F** - Find
