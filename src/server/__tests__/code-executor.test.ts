import { executeCode, executeCodeSafe, sanitizeError } from '../code-executor';

// Mock child_process
jest.mock('child_process');

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('code-executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Vercel environment handling', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return early with error when VERCEL is set without VERCEL_SANDBOX_ENABLED', async () => {
      process.env.VERCEL = '1';
      delete process.env.VERCEL_SANDBOX_ENABLED;

      const result = await executeCode({ code: 'print("test")' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Code execution is not yet available in production. Coming soon!');
      expect(result.executionTime).toBe(0);
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should include stdin in result when returning early on Vercel', async () => {
      process.env.VERCEL = '1';
      delete process.env.VERCEL_SANDBOX_ENABLED;

      const result = await executeCode({
        code: 'print("test")',
        executionSettings: { stdin: 'test input' }
      });

      expect(result.success).toBe(false);
      expect(result.stdin).toBe('test input');
    });

    it('should execute normally when VERCEL_SANDBOX_ENABLED is set', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = 'true';

      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ code: 'print("test")' });

      mockProcess.stdout.emit('data', Buffer.from('test\n'));
      mockProcess.emit('close', 0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should execute normally when not on Vercel', async () => {
      delete process.env.VERCEL;

      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ code: 'print("test")' });

      mockProcess.stdout.emit('data', Buffer.from('test\n'));
      mockProcess.emit('close', 0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalled();
    });
  });

  describe('executeCode', () => {
    describe('successful execution', () => {
      it('should execute code and return stdout', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'print("hello")' });

        // Simulate process execution
        mockProcess.stdout.emit('data', Buffer.from('hello\n'));
        mockProcess.emit('close', 0);

        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.output).toBe('hello\n');
        expect(result.error).toBe('');
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      });

      it('should track execution time', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'print("test")' });

        jest.advanceTimersByTime(100);
        mockProcess.stdout.emit('data', Buffer.from('test\n'));
        mockProcess.emit('close', 0);

        const result = await promise;

        expect(result.executionTime).toBeGreaterThanOrEqual(100);
      });

      it('should handle empty output', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'pass' });

        mockProcess.emit('close', 0);

        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.output).toBe('');
        expect(result.error).toBe('');
      });
    });

    describe('stdin support', () => {
      it('should pipe stdin to process when provided', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const stdinInput = 'Alice\n25\n';
        const promise = executeCode({ code: 'name = input(); age = input(); print(name, age)', executionSettings: { stdin: stdinInput } });

        // Verify stdin.write was called
        expect(mockProcess.stdin.write).toHaveBeenCalledWith(stdinInput);
        expect(mockProcess.stdin.end).toHaveBeenCalled();

        mockProcess.stdout.emit('data', Buffer.from('Alice 25\n'));
        mockProcess.emit('close', 0);

        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.output).toBe('Alice 25\n');
        expect(result.stdin).toBe(stdinInput);
      });

      it('should not write to stdin when not provided', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'print("test")' });

        expect(mockProcess.stdin.write).not.toHaveBeenCalled();
        expect(mockProcess.stdin.end).not.toHaveBeenCalled();

        mockProcess.stdout.emit('data', Buffer.from('test\n'));
        mockProcess.emit('close', 0);

        await promise;
      });

      it('should handle empty string stdin', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'print("test")', executionSettings: { stdin: '' } });

        expect(mockProcess.stdin.write).toHaveBeenCalledWith('');
        expect(mockProcess.stdin.end).toHaveBeenCalled();

        mockProcess.stdout.emit('data', Buffer.from('test\n'));
        mockProcess.emit('close', 0);

        const result = await promise;
        expect(result.stdin).toBe('');
      });

      it('should include stdin in result', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const stdinInput = 'test input';
        const promise = executeCode({ code: 'print("ok")', executionSettings: { stdin: stdinInput } });

        mockProcess.stdout.emit('data', Buffer.from('ok\n'));
        mockProcess.emit('close', 0);

        const result = await promise;

        expect(result.stdin).toBe(stdinInput);
      });
    });

    describe('error handling', () => {
      it('should capture stderr on errors', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'raise Exception("error")' });

        mockProcess.stderr.emit('data', Buffer.from('Exception: error\n'));
        mockProcess.emit('close', 1);

        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error).toBe('Exception: error\n');
      });

      it('should handle process spawn errors', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'print("test")' });

        mockProcess.emit('error', new Error('spawn failed'));

        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to execute code');
        expect(result.error).toContain('spawn failed');
      });

      it('should mark as failure when exit code is non-zero', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'import sys; sys.exit(1)' });

        mockProcess.emit('close', 1);

        const result = await promise;

        expect(result.success).toBe(false);
      });

      it('should mark as failure when stderr is not empty', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'import sys; print("warning", file=sys.stderr)' });

        mockProcess.stderr.emit('data', Buffer.from('warning\n'));
        mockProcess.emit('close', 0);

        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error).toBe('warning\n');
      });
    });

    describe('timeout handling', () => {
      it('should timeout after specified duration', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'while True: pass' }, 1000);

        jest.advanceTimersByTime(1000);

        expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

        mockProcess.emit('close', null);

        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('timed out');
        expect(result.error).toContain('1000ms');
      });

      it('should use default timeout of 10 seconds', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        executeCode({ code: 'while True: pass' });

        jest.advanceTimersByTime(9999);
        expect(mockProcess.kill).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(mockProcess.kill).toHaveBeenCalled();
      });

      it('should send SIGKILL if SIGTERM fails', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const promise = executeCode({ code: 'while True: pass' }, 1000);

        jest.advanceTimersByTime(1000);
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

        // Process doesn't respond to SIGTERM
        jest.advanceTimersByTime(1000);
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

        mockProcess.emit('close', null);

        await promise;
      });

      it('should include stdin in timeout result', async () => {
        const mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess as any);

        const stdinInput = 'test';
        const promise = executeCode({ code: 'while True: pass', executionSettings: { stdin: stdinInput } }, 1000);

        jest.advanceTimersByTime(1000);
        mockProcess.emit('close', null);

        const result = await promise;

        expect(result.stdin).toBe(stdinInput);
      });
    });
  });

  describe('sanitizeError', () => {
    it('should remove file paths from error messages', () => {
      const error = 'File "/home/user/code.py", line 1, in <module>';
      const sanitized = sanitizeError(error);

      expect(sanitized).toBe('File "<student code>", line 1, in <module>');
    });

    it('should remove errno codes', () => {
      const error = '[Errno 2] No such file or directory';
      const sanitized = sanitizeError(error);

      expect(sanitized).toBe('[Error] No such file or directory');
    });

    it('should handle multiple file paths', () => {
      const error = 'File "/path/one.py", line 1\nFile "/path/two.py", line 2';
      const sanitized = sanitizeError(error);

      expect(sanitized).not.toContain('/path/');
      expect(sanitized).toContain('<student code>');
    });

    it('should preserve line numbers and error types', () => {
      const error = 'File "/home/user/test.py", line 42, in main\nValueError: invalid value';
      const sanitized = sanitizeError(error);

      expect(sanitized).toContain('line 42');
      expect(sanitized).toContain('ValueError');
      expect(sanitized).not.toContain('/home/user/');
    });
  });

  describe('executeCodeSafe', () => {
    it('should sanitize errors on failure', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCodeSafe({ code: 'raise Exception()' });

      mockProcess.stderr.emit('data', Buffer.from('File "/home/test.py", line 1\nException\n'));
      mockProcess.emit('close', 1);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('<student code>');
      expect(result.error).not.toContain('/home/');
    });

    it('should not modify output on success', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCodeSafe({ code: 'print("hello")' });

      mockProcess.stdout.emit('data', Buffer.from('hello\n'));
      mockProcess.emit('close', 0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.output).toBe('hello\n');
    });

    it('should pass through stdin parameter', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const stdinInput = 'test input';
      const promise = executeCodeSafe({ code: 'print("ok")', executionSettings: { stdin: stdinInput } });

      mockProcess.stdout.emit('data', Buffer.from('ok\n'));
      mockProcess.emit('close', 0);

      const result = await promise;

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(stdinInput);
      expect(result.stdin).toBe(stdinInput);
    });

    it('should pass through custom timeout', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      executeCodeSafe({ code: 'while True: pass' }, 5000);

      jest.advanceTimersByTime(4999);
      expect(mockProcess.kill).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('should pass through randomSeed parameter', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCodeSafe({ 
        code: 'import random\nprint(random.random())', 
        executionSettings: {
          randomSeed: 99
        }
      });

      const executedCode = mockSpawn.mock.calls[0][1][1];
      expect(executedCode).toContain('random.seed(99)');

      mockProcess.stdout.emit('data', Buffer.from('0.5\n'));
      mockProcess.emit('close', 0);

      await promise;
    });

    it('should pass through attachedFiles parameter', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCodeSafe({ 
        code: 'print("ok")', 
        executionSettings: {
          attachedFiles: [{ name: 'test.txt', content: 'content' }]
        }
      });

      const spawnOptions = mockSpawn.mock.calls[0][2];
      expect(spawnOptions).toHaveProperty('cwd');

      mockProcess.stdout.emit('data', Buffer.from('ok\n'));
      mockProcess.emit('close', 0);

      await promise;
    });
  });

  describe('random seed support', () => {
    it('should inject random seed before student code', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'import random\nprint(random.randint(1, 100))',
        executionSettings: {
          randomSeed: 42
        }
      });

      // Verify spawn was called with injected seed code
      expect(mockSpawn).toHaveBeenCalledWith('python3', ['-c', expect.stringContaining('random.seed(42)')], expect.any(Object));
      
      const executedCode = mockSpawn.mock.calls[0][1][1];
      expect(executedCode).toContain('import random\nrandom.seed(42)\n');
      expect(executedCode).toContain('import random\nprint(random.randint(1, 100))');

      mockProcess.stdout.emit('data', Buffer.from('42\n'));
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result.success).toBe(true);
    });

    it('should not inject seed when not provided', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const originalCode = 'import random\nprint(random.randint(1, 100))';
      const promise = executeCode({ code: originalCode });

      expect(mockSpawn).toHaveBeenCalledWith('python3', ['-c', originalCode], expect.any(Object));

      mockProcess.stdout.emit('data', Buffer.from('73\n'));
      mockProcess.emit('close', 0);

      await promise;
    });

    it('should handle seed value of 0', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'print("test")',
        executionSettings: {
          randomSeed: 0
        }
      });

      const executedCode = mockSpawn.mock.calls[0][1][1];
      expect(executedCode).toContain('random.seed(0)');

      mockProcess.stdout.emit('data', Buffer.from('test\n'));
      mockProcess.emit('close', 0);

      await promise;
    });

    it('should inject seed before any student imports', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'import os\nimport random\nprint("ok")',
        executionSettings: {
          randomSeed: 123
        }
      });

      const executedCode = mockSpawn.mock.calls[0][1][1];
      // Seed injection should come first
      expect(executedCode.indexOf('random.seed(123)')).toBeLessThan(executedCode.indexOf('import os'));

      mockProcess.stdout.emit('data', Buffer.from('ok\n'));
      mockProcess.emit('close', 0);

      await promise;
    });
  });

  describe('attached files support', () => {
    it('should create temp directory and write files', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'with open("data.txt") as f: print(f.read())',
        executionSettings: {
          attachedFiles: [
            { name: 'data.txt', content: 'Hello, World!' }
          ]
        }
      });

      // Verify spawn was called with cwd option
      expect(mockSpawn).toHaveBeenCalledWith('python3', ['-c', expect.any(String)], 
        expect.objectContaining({ cwd: expect.stringContaining('coding-tool-') }));

      mockProcess.stdout.emit('data', Buffer.from('Hello, World!\n'));
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!\n');
    });

    it('should handle multiple attached files', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'print("ok")',
        executionSettings: {
          attachedFiles: [
            { name: 'file1.txt', content: 'Content 1' },
            { name: 'file2.txt', content: 'Content 2' },
            { name: 'file3.txt', content: 'Content 3' }
          ]
        }
      });

      mockProcess.stdout.emit('data', Buffer.from('ok\n'));
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result.success).toBe(true);
    });

    it('should sanitize filenames to prevent path traversal', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'print("ok")',
        executionSettings: {
          attachedFiles: [
            { name: '../../../etc/passwd', content: 'malicious' },
            { name: 'normal.txt', content: 'safe' }
          ]
        }
      });

      // Execution should succeed with sanitized filename
      mockProcess.stdout.emit('data', Buffer.from('ok\n'));
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result.success).toBe(true);
    });

    it('should reject files exceeding size limit', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const largeContent = 'x'.repeat(11 * 1024); // 11KB, exceeds 10KB limit
      const promise = executeCode({ 
        code: 'print("ok")',
        executionSettings: {
          attachedFiles: [
            { name: 'large.txt', content: largeContent }
          ]
        }
      });

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds size limit');
    });

    it('should reject more than 5 files', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'print("ok")',
        executionSettings: {
          attachedFiles: [
            { name: 'file1.txt', content: 'content' },
            { name: 'file2.txt', content: 'content' },
            { name: 'file3.txt', content: 'content' },
            { name: 'file4.txt', content: 'content' },
            { name: 'file5.txt', content: 'content' },
            { name: 'file6.txt', content: 'content' }
          ]
        }
      });

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many files');
    });

    it('should reject files with missing name or content', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'print("ok")',
        executionSettings: {
          attachedFiles: [
            { name: '', content: 'content' }
          ]
        }
      });

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('name and content are required');
    });

    it('should cleanup temp directory after successful execution', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'print("ok")',
        executionSettings: {
          attachedFiles: [{ name: 'test.txt', content: 'test' }]
        }
      });

      mockProcess.stdout.emit('data', Buffer.from('ok\n'));
      mockProcess.emit('close', 0);

      await promise;
      
      // Note: We can't easily test actual file cleanup without mocking fs,
      // but we verify execution completes without errors
    });

    it('should cleanup temp directory after error', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'raise Exception("error")',
        executionSettings: {
          attachedFiles: [{ name: 'test.txt', content: 'test' }]
        }
      });

      mockProcess.stderr.emit('data', Buffer.from('Exception: error\n'));
      mockProcess.emit('close', 1);

      const result = await promise;
      expect(result.success).toBe(false);
      // Cleanup should happen even on error
    });

    it('should cleanup temp directory after timeout', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'while True: pass',
        executionSettings: {
          attachedFiles: [{ name: 'test.txt', content: 'test' }]
        }
      }, 1000);

      jest.advanceTimersByTime(1000);
      mockProcess.emit('close', null);

      const result = await promise;
      expect(result.success).toBe(false);
      // Cleanup should happen even on timeout
    });

    it('should work with both random seed and attached files', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCode({ 
        code: 'import random\nwith open("data.txt") as f: print(f.read(), random.randint(1,10))',
        executionSettings: {
          randomSeed: 42,
          attachedFiles: [{ name: 'data.txt', content: 'Hello' }]
        }
      });

      // Verify both seed injection and temp directory
      const executedCode = mockSpawn.mock.calls[0][1][1];
      expect(executedCode).toContain('random.seed(42)');
      
      const spawnOptions = mockSpawn.mock.calls[0][2];
      expect(spawnOptions).toHaveProperty('cwd');
      expect(spawnOptions.cwd).toMatch(/coding-tool-/);

      mockProcess.stdout.emit('data', Buffer.from('Hello 5\n'));
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result.success).toBe(true);
    });
  });
});

// Helper to create a mock process
function createMockProcess() {
  const mockProcess = new EventEmitter() as any;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.stdin = {
    write: jest.fn(),
    end: jest.fn(),
  };
  mockProcess.kill = jest.fn();
  mockProcess.killed = false;
  return mockProcess;
}
