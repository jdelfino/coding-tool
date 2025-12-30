import { traceExecution } from '../code-tracer';

describe('code-tracer', () => {
  it('traces simple code execution', async () => {
    const code = 'x = 5\ny = 10\nprint(x + y)';
    
    const trace = await traceExecution(code);
    
    expect(trace.steps).toBeDefined();
    expect(trace.steps.length).toBeGreaterThan(0);
    expect(trace.exitCode).toBe(0);
    expect(trace.truncated).toBe(false);
  });

  it('captures variable states', async () => {
    const code = 'x = 42\ny = x * 2';
    
    const trace = await traceExecution(code);
    
    // Find step where y is defined
    const stepWithY = trace.steps.find(s => 'y' in s.locals);
    expect(stepWithY).toBeDefined();
    expect(stepWithY!.locals.y).toBe(84);
  });

  it('captures function calls in call stack', async () => {
    const code = `
def greet(name):
    return f"Hello, {name}"

result = greet("World")
`;
    
    const trace = await traceExecution(code);
    
    // Find step where we're inside the function
    const stepInFunction = trace.steps.find(s => 
      s.callStack.some(frame => frame.functionName === 'greet')
    );
    
    expect(stepInFunction).toBeDefined();
  });

  it('handles code with errors', async () => {
    const code = 'x = 1 / 0';  // Division by zero
    
    const trace = await traceExecution(code);
    
    expect(trace.exitCode).toBe(1);
    expect(trace.error).toBeDefined();
    expect(trace.error).toContain('ZeroDivisionError');
  });

  it('respects maxSteps limit', async () => {
    const code = 'for i in range(10000):\n    x = i';
    
    const trace = await traceExecution(code, { maxSteps: 100 });
    
    expect(trace.steps.length).toBeLessThanOrEqual(100);
    expect(trace.truncated).toBe(true);
  });

  it('handles stdin input', async () => {
    const code = 'name = input("Enter name: ")\nprint(f"Hello, {name}")';
    
    const trace = await traceExecution(code, { stdin: 'Alice' });
    
    expect(trace.exitCode).toBe(0);
    // Should have captured stdout with the greeting
    const lastStep = trace.steps[trace.steps.length - 1];
    expect(lastStep.stdout).toContain('Hello, Alice');
  });

  it('traces recursive functions', async () => {
    const code = `
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

result = factorial(3)
`;
    
    const trace = await traceExecution(code);
    
    // Find max call depth
    let maxDepth = 0;
    for (const step of trace.steps) {
      const depth = step.callStack.filter(f => f.functionName === 'factorial').length;
      maxDepth = Math.max(maxDepth, depth);
    }
    
    expect(maxDepth).toBeGreaterThanOrEqual(3);
  });

  it('formats complex data structures', async () => {
    const code = 'data = {"name": "Alice", "age": 30, "items": [1, 2, 3]}';
    
    const trace = await traceExecution(code);
    
    const stepWithData = trace.steps.find(s => 'data' in s.locals);
    expect(stepWithData).toBeDefined();
    expect(stepWithData!.locals.data).toBeDefined();
  });
});
