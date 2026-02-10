/**
 * Tests for ephemeral code execution utility
 *
 * The executeEphemeral function creates short-lived sandboxes for code execution
 * without associating them with a session.
 */

import { CodeSubmission, ExecutionResult } from '../interfaces';

// Mock the executor service
jest.mock('../executor-service', () => ({
  getExecutorService: jest.fn(),
}));

// Mock the Vercel Sandbox
jest.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: jest.fn(),
  },
}));

import { executeEphemeral } from '../ephemeral-execute';
import { getExecutorService } from '../executor-service';
import { Sandbox } from '@vercel/sandbox';

const mockGetExecutorService = getExecutorService as jest.MockedFunction<typeof getExecutorService>;
const mockSandboxCreate = Sandbox.create as jest.MockedFunction<typeof Sandbox.create>;

describe('executeEphemeral', () => {
  const mockExecuteCode = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default setup for local development
    delete process.env.VERCEL;
    delete process.env.VERCEL_SANDBOX_ENABLED;

    mockGetExecutorService.mockReturnValue({
      executeCode: mockExecuteCode,
    } as unknown as ReturnType<typeof getExecutorService>);
  });

  describe('local development (non-Vercel environment)', () => {
    it('should execute code using executor service without sessionId', async () => {
      const submission: CodeSubmission = {
        code: 'print("hello")',
        executionSettings: { stdin: 'test input' },
      };

      const expectedResult: ExecutionResult = {
        success: true,
        output: 'hello\n',
        error: '',
        executionTime: 100,
      };

      mockExecuteCode.mockResolvedValue(expectedResult);

      const result = await executeEphemeral(submission);

      expect(result).toEqual(expectedResult);
      expect(mockExecuteCode).toHaveBeenCalledWith(submission, undefined);
      // Verify sessionId is NOT passed (ephemeral execution)
      expect(mockExecuteCode).toHaveBeenCalledTimes(1);
    });

    it('should pass timeout to executor service', async () => {
      const submission: CodeSubmission = { code: 'x = 1' };
      const timeout = 5000;

      mockExecuteCode.mockResolvedValue({
        success: true,
        output: '',
        error: '',
        executionTime: 50,
      });

      await executeEphemeral(submission, timeout);

      expect(mockExecuteCode).toHaveBeenCalledWith(submission, timeout);
    });

    it('should propagate execution errors', async () => {
      const submission: CodeSubmission = { code: 'print(' };

      mockExecuteCode.mockRejectedValue(new Error('Syntax error'));

      await expect(executeEphemeral(submission)).rejects.toThrow('Syntax error');
    });
  });

  describe('Vercel production (sandbox enabled)', () => {
    let mockSandbox: {
      writeFiles: jest.Mock;
      runCommand: jest.Mock;
      stop: jest.Mock;
    };

    beforeEach(() => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = '1';

      mockSandbox = {
        writeFiles: jest.fn().mockResolvedValue(undefined),
        runCommand: jest.fn().mockResolvedValue({
          exitCode: 0,
          stdout: jest.fn().mockResolvedValue('hello\n'),
          stderr: jest.fn().mockResolvedValue(''),
        }),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      mockSandboxCreate.mockResolvedValue(mockSandbox as unknown as Awaited<ReturnType<typeof Sandbox.create>>);
    });

    it('should create ephemeral sandbox and execute code', async () => {
      const submission: CodeSubmission = {
        code: 'print("hello")',
      };

      const result = await executeEphemeral(submission);

      expect(mockSandboxCreate).toHaveBeenCalledWith({
        runtime: 'python3.13',
        timeout: 60000,
      });
      expect(mockSandbox.writeFiles).toHaveBeenCalled();
      expect(mockSandbox.runCommand).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.output).toBe('hello\n');
    });

    it('should always stop sandbox after execution', async () => {
      const submission: CodeSubmission = { code: 'print("test")' };

      await executeEphemeral(submission);

      expect(mockSandbox.stop).toHaveBeenCalled();
    });

    it('should stop sandbox even on execution error', async () => {
      mockSandbox.runCommand.mockRejectedValue(new Error('Execution failed'));
      const submission: CodeSubmission = { code: 'bad code' };

      await expect(executeEphemeral(submission)).rejects.toThrow('Execution failed');
      expect(mockSandbox.stop).toHaveBeenCalled();
    });

    it('should handle stdin in execution settings', async () => {
      const submission: CodeSubmission = {
        code: 'print(input())',
        executionSettings: { stdin: 'test input' },
      };

      await executeEphemeral(submission);

      // Should write stdin file and use bash redirection
      const writeFilesCall = mockSandbox.writeFiles.mock.calls[0][0];
      const stdinFile = writeFilesCall.find((f: { path: string }) => f.path === '/tmp/stdin.txt');
      expect(stdinFile).toBeDefined();
      expect(stdinFile.content.toString()).toBe('test input');

      expect(mockSandbox.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: 'bash',
          args: ['-c', 'python3 main.py < /tmp/stdin.txt'],
        })
      );
    });

    it('should inject random seed when provided', async () => {
      const submission: CodeSubmission = {
        code: 'import random; print(random.random())',
        executionSettings: { randomSeed: 42 },
      };

      await executeEphemeral(submission);

      const writeFilesCall = mockSandbox.writeFiles.mock.calls[0][0];
      const mainFile = writeFilesCall.find((f: { path: string }) => f.path === 'main.py');
      expect(mainFile.content.toString()).toContain('import random\nrandom.seed(42)');
    });

    it('should handle attached files', async () => {
      const submission: CodeSubmission = {
        code: 'with open("data.txt") as f: print(f.read())',
        executionSettings: {
          attachedFiles: [{ name: 'data.txt', content: 'file content' }],
        },
      };

      await executeEphemeral(submission);

      const writeFilesCall = mockSandbox.writeFiles.mock.calls[0][0];
      const dataFile = writeFilesCall.find((f: { path: string }) => f.path === 'data.txt');
      expect(dataFile).toBeDefined();
      expect(dataFile.content.toString()).toBe('file content');
    });

    it('should respect custom timeout', async () => {
      const submission: CodeSubmission = { code: 'print("fast")' };
      const timeout = 5000;

      await executeEphemeral(submission, timeout);

      expect(mockSandbox.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should handle timeout abort', async () => {
      mockSandbox.runCommand.mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }));

      const submission: CodeSubmission = { code: 'import time; time.sleep(100)' };

      const result = await executeEphemeral(submission, 1000);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution timed out');
      expect(mockSandbox.stop).toHaveBeenCalled();
    });

    it('should return stderr as error on non-zero exit code', async () => {
      mockSandbox.runCommand.mockResolvedValue({
        exitCode: 1,
        stdout: jest.fn().mockResolvedValue(''),
        stderr: jest.fn().mockResolvedValue('NameError: name "x" is not defined'),
      });

      const submission: CodeSubmission = { code: 'print(x)' };

      const result = await executeEphemeral(submission);

      expect(result.success).toBe(false);
      expect(result.error).toContain('NameError');
    });
  });

  describe('Vercel without sandbox (disabled)', () => {
    beforeEach(() => {
      process.env.VERCEL = '1';
      delete process.env.VERCEL_SANDBOX_ENABLED;
    });

    it('should use executor service like local development', async () => {
      const submission: CodeSubmission = { code: 'print("hello")' };

      mockExecuteCode.mockResolvedValue({
        success: true,
        output: 'hello\n',
        error: '',
        executionTime: 100,
      });

      await executeEphemeral(submission);

      expect(mockExecuteCode).toHaveBeenCalledWith(submission, undefined);
      expect(mockSandboxCreate).not.toHaveBeenCalled();
    });
  });
});
