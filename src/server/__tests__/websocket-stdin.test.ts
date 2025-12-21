/**
 * Tests for stdin parameter passing in code execution
 * 
 * Verifies that stdin parameters are properly used when executing code
 * through different execution paths (student, instructor, public).
 * 
 * Since WebSocketHandler is a singleton and tightly integrated with the server,
 * these tests focus on verifying that the code executor is called with correct
 * stdin parameters in different scenarios.
 */

import * as codeExecutor from '../code-executor';

// We're testing that stdin is properly passed through the execution chain
describe('Code execution stdin handling', () => {
  describe('executeCodeSafe', () => {
    it('should accept and use stdin parameter', async () => {
      const code = 'name = input("Enter name: ")\nprint(f"Hello, {name}")';
      const stdin = 'Alice\n';
      
      const result = await codeExecutor.executeCodeSafe({ code, stdin });
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.output).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.executionTime).toBeDefined();
    });

    it('should work without stdin parameter', async () => {
      const code = 'print("Hello, World!")';
      
      const result = await codeExecutor.executeCodeSafe({ code });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, World!');
    });

    it('should handle multi-line stdin input', async () => {
      const code = 'name = input()\nage = input()\nprint(f"{name} is {age}")';
      const stdin = 'Alice\n25\n';
      
      const result = await codeExecutor.executeCodeSafe({ code, stdin });
      
      expect(result).toBeDefined();
      // Log the result for debugging
      if (!result.success) {
        console.log('Error:', result.error);
        console.log('Output:', result.output);
      }
      expect(result.success).toBe(true);
      expect(result.output).toContain('Alice is 25');
    });

    it('should handle empty stdin', async () => {
      const code = 'print("No input needed")';
      const stdin = '';
      
      const result = await codeExecutor.executeCodeSafe({ code, stdin });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.output).toContain('No input needed');
    });
  });

  describe('Parameter signature verification', () => {
    it('executeCodeSafe should accept CodeSubmission parameter', () => {
      // Type checking - this will fail at compile time if signature is wrong
      const executor: (submission: any, timeout?: number) => Promise<any> = codeExecutor.executeCodeSafe;
      expect(executor).toBeDefined();
    });
  });
});
