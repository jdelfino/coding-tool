# CodeEditor Embedding Guide

## The Problem

The CodeEditor component has had a **recurring bug** where the activity bar (left sidebar) background doesn't extend to the bottom of the editor. This has happened multiple times when:

- Adding CodeEditor to new pages
- Modifying existing pages with CodeEditor
- Refactoring component layouts

## Root Cause

The bug occurs when CodeEditor is wrapped in a container with **incorrect styling**. CodeEditor uses flexbox internally and requires its parent to have specific properties.

### Common Mistakes (DO NOT DO THESE)

```tsx
// ❌ WRONG: Border/rounded classes conflict with internal styling
<div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '500px' }}>
  <CodeEditor {...props} />
</div>

// ❌ WRONG: Mixing flex and fixed height creates conflicts
<div style={{ flex: 1, height: '500px' }}>
  <CodeEditor {...props} />
</div>

// ❌ WRONG: maxHeight allows overflow instead of constraining
<div style={{ maxHeight: '500px' }}>
  <CodeEditor {...props} />
</div>

// ❌ WRONG: Multiple wrapper divs with conflicting styles
<div className="border rounded-lg">
  <div style={{ height: '500px' }}>
    <CodeEditor {...props} />
  </div>
</div>
```

## The Solution: Use EditorContainer

**Always use the `EditorContainer` component** when embedding CodeEditor. It enforces the correct wrapper pattern.

```tsx
import { EditorContainer } from '@/app/student/components/EditorContainer';
import CodeEditor from '@/app/student/components/CodeEditor';

// ✅ CORRECT: Fixed height (most common)
<EditorContainer height="500px">
  <CodeEditor {...props} />
</EditorContainer>

// ✅ CORRECT: Flex-based (fills parent)
<EditorContainer variant="flex">
  <CodeEditor {...props} />
</EditorContainer>
```

## Usage Patterns

### Pattern 1: Fixed Height (Most Common)

Use when you want the editor to have a specific height.

**Use cases:**
- Instructor viewing student code
- Modal dialogs with editors
- Side-by-side code viewers

```tsx
<div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-6">
  <h3>Student Code</h3>
  <EditorContainer height="500px">
    <CodeEditor
      code={studentCode}
      onChange={() => {}}
      readOnly
    />
  </EditorContainer>
</div>
```

### Pattern 2: Flex-Based (Fill Parent)

Use when the editor should fill available space in a flex container.

**Use cases:**
- Main student coding page
- Problem creator/editor
- Full-page layouts

```tsx
<div style={{ 
  display: 'flex', 
  flexDirection: 'column', 
  height: '100vh' 
}}>
  <header>Navigation</header>
  
  <EditorContainer variant="flex">
    <CodeEditor
      code={code}
      onChange={setCode}
      problem={problem}
    />
  </EditorContainer>
</div>
```

## Why This Works

### Technical Explanation

CodeEditor internally uses:
```css
.root {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.content-area {
  flex: 1;
  min-height: 0; /* Critical! Allows flex shrinking */
}

.activity-bar {
  height: 100%; /* Must fill parent */
}
```

**The key requirement:** The parent container must have a **constrained height** (either fixed or via flex) so that `height: 100%` on the root has something to reference.

### Fixed Height Pattern
```
Parent container: height: 500px
  ↓
CodeEditor root: height: 100% → resolves to 500px
  ↓
Activity bar: height: 100% → resolves to 500px ✅
```

### Flex Pattern
```
Parent flex container: display: flex
  ↓
EditorContainer: flex: 1, minHeight: 0
  ↓
CodeEditor root: height: 100% → fills available flex space
  ↓
Activity bar: height: 100% → fills available space ✅
```

### Why Mistakes Break It

```
// maxHeight doesn't constrain - allows overflow
Parent: maxHeight: 500px (content can exceed)
  ↓
CodeEditor root: height: 100% → no constraint!
  ↓
Activity bar: height: 100% → ???  ❌

// Mixed flex + fixed creates conflict
Parent: flex: 1, height: 500px (which wins?)
  ↓
Browser: confused, picks one arbitrarily
  ↓
Activity bar: inconsistent behavior ❌

// overflow-hidden clips content instead of sizing
Parent: overflow-hidden, height: 500px
  ↓
Activity bar: might be clipped mid-way ❌
```

## Migration Checklist

When updating existing code:

1. **Find CodeEditor usage:**
   ```bash
   grep -r "CodeEditor" src/
   ```

2. **Check the wrapper div** above each CodeEditor instance

3. **Look for these anti-patterns:**
   - `className="border ... overflow-hidden"`
   - `maxHeight` instead of `height`
   - Both `flex: 1` AND `height: XXX`
   - Multiple nested wrappers

4. **Replace with EditorContainer:**
   - If wrapper has `height: XXX` → `<EditorContainer height="XXX">`
   - If in flex layout → `<EditorContainer variant="flex">`

5. **Test the page** - activity bar should extend to bottom

## Examples from Codebase

### ✅ Good Examples (Updated)

```tsx
// src/app/instructor/components/SessionDetails.tsx
<EditorContainer height="500px">
  <CodeEditor code={studentCode} readOnly />
</EditorContainer>

// src/app/student/page.tsx  
<EditorContainer variant="flex">
  <CodeEditor code={code} onChange={setCode} />
</EditorContainer>

// src/app/instructor/components/SessionProblemEditor.tsx
<div style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
  <header>Problem Setup Header</header>
  <EditorContainer variant="flex">
    <CodeEditor {...props} />
  </EditorContainer>
</div>
```

## Testing

The test suite `EditorContainer.test.tsx` ensures:
- Fixed height variant applies correct height
- Flex variant applies correct flex properties
- No conflicting properties are applied
- Children render correctly

Run tests:
```bash
npm test EditorContainer
```

## Code Review Checklist

When reviewing PRs that add/modify CodeEditor usage:

- [ ] Is CodeEditor wrapped in EditorContainer?
- [ ] Is the variant correct for the use case?
- [ ] Are there any additional wrapper divs with styling?
- [ ] Does the layout look correct in dev server?
- [ ] Does the activity bar extend to the bottom?

## Getting Help

If you encounter layout issues with CodeEditor:

1. Check if you're using EditorContainer
2. Verify your parent container has the right structure
3. Check browser dev tools for CSS conflicts
4. See this guide and the working examples above
5. Ask in the team chat with a screenshot

## History

- **2026-01**: Bug identified in SessionDetails and SessionProblemEditor
- **2026-01**: Created EditorContainer wrapper component to prevent recurrence
- **2026-01**: Updated documentation and test suite
