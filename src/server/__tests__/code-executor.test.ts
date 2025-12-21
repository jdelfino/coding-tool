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
        const promise = executeCode({ code: 'name = input(); age = input(); print(name, age)', stdin: stdinInput });

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

        const promise = executeCode({ code: 'print("test")', stdin: '' });

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
        const promise = executeCode({ code: 'print("ok")', stdin: stdinInput });

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
        const promise = executeCode({ code: 'while True: pass', stdin: stdinInput }, 1000);

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
      const promise = executeCodeSafe({ code: 'print("ok")', stdin: stdinInput });

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
