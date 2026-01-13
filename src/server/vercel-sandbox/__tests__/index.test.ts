/**
 * Tests for Sandbox Abstraction Layer
 *
 * Tests environment-based selection between Vercel Sandbox and local execution.
 */

import {
  shouldUseVercelSandbox,
  isVercelEnvironment,
  createSandboxForSession,
  executeInSandbox,
  traceInSandbox,
  cleanupSandbox,
} from '../index';

// Mock the vercel-executor module
const mockCreateSessionSandbox = jest.fn().mockResolvedValue('sb_test123');
const mockExecuteOnVercelSandbox = jest.fn().mockResolvedValue({
  success: true,
  output: 'Hello',
  error: '',
  executionTime: 100,
});
const mockTraceOnVercelSandbox = jest.fn().mockResolvedValue({
  steps: [{ line: 1, event: 'line', locals: {}, globals: {}, callStack: [], stdout: '' }],
  totalSteps: 1,
  exitCode: 0,
  truncated: false,
});
const mockCleanupSandbox = jest.fn().mockResolvedValue(undefined);
const mockHasSandbox = jest.fn().mockResolvedValue(true);

jest.mock('../vercel-executor', () => ({
  createSessionSandbox: (...args: unknown[]) => mockCreateSessionSandbox(...args),
  executeOnVercelSandbox: (...args: unknown[]) => mockExecuteOnVercelSandbox(...args),
  traceOnVercelSandbox: (...args: unknown[]) => mockTraceOnVercelSandbox(...args),
  cleanupSandbox: (...args: unknown[]) => mockCleanupSandbox(...args),
  hasSandbox: (...args: unknown[]) => mockHasSandbox(...args),
  SandboxError: class SandboxError extends Error {},
}));

describe('Sandbox Abstraction Layer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('shouldUseVercelSandbox', () => {
    it('returns false when not on Vercel', () => {
      delete process.env.VERCEL;
      delete process.env.VERCEL_SANDBOX_ENABLED;

      expect(shouldUseVercelSandbox()).toBe(false);
    });

    it('returns false when on Vercel but sandbox not enabled', () => {
      process.env.VERCEL = '1';
      delete process.env.VERCEL_SANDBOX_ENABLED;

      expect(shouldUseVercelSandbox()).toBe(false);
    });

    it('returns true when on Vercel and sandbox is enabled', () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = '1';

      expect(shouldUseVercelSandbox()).toBe(true);
    });
  });

  describe('isVercelEnvironment', () => {
    it('returns false when not on Vercel', () => {
      delete process.env.VERCEL;

      expect(isVercelEnvironment()).toBe(false);
    });

    it('returns true when on Vercel', () => {
      process.env.VERCEL = '1';

      expect(isVercelEnvironment()).toBe(true);
    });
  });

  describe('createSandboxForSession', () => {
    it('returns null when not on Vercel', async () => {
      delete process.env.VERCEL;

      const result = await createSandboxForSession('session-123');

      expect(result).toBeNull();
      expect(mockCreateSessionSandbox).not.toHaveBeenCalled();
    });

    it('creates sandbox when on Vercel with sandbox enabled', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = '1';

      const result = await createSandboxForSession('session-123');

      expect(result).toBe('sb_test123');
      expect(mockCreateSessionSandbox).toHaveBeenCalledWith('session-123');
    });
  });

  describe('executeInSandbox', () => {
    const submission = { code: 'print("hello")' };

    it('returns null for local development (not on Vercel)', async () => {
      delete process.env.VERCEL;

      const result = await executeInSandbox('session-123', submission);

      expect(result).toBeNull();
      expect(mockExecuteOnVercelSandbox).not.toHaveBeenCalled();
    });

    it('returns error when on Vercel but sandbox not enabled', async () => {
      process.env.VERCEL = '1';
      delete process.env.VERCEL_SANDBOX_ENABLED;

      const result = await executeInSandbox('session-123', submission);

      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('not yet available');
      expect(mockExecuteOnVercelSandbox).not.toHaveBeenCalled();
    });

    it('executes on Vercel Sandbox when enabled', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = '1';

      const result = await executeInSandbox('session-123', submission);

      expect(result!.success).toBe(true);
      expect(mockExecuteOnVercelSandbox).toHaveBeenCalledWith('session-123', submission);
    });

    it('creates sandbox if missing when enabled', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = '1';
      mockHasSandbox.mockResolvedValueOnce(false);

      await executeInSandbox('session-123', submission);

      expect(mockCreateSessionSandbox).toHaveBeenCalledWith('session-123');
      expect(mockExecuteOnVercelSandbox).toHaveBeenCalled();
    });

    it('returns error if sandbox creation fails', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = '1';
      mockHasSandbox.mockResolvedValueOnce(false);
      mockCreateSessionSandbox.mockRejectedValueOnce(new Error('Failed'));

      const result = await executeInSandbox('session-123', submission);

      expect(result!.success).toBe(false);
      expect(result!.error).toContain('temporarily unavailable');
    });
  });

  describe('traceInSandbox', () => {
    const code = 'print("hello")';
    const options = { stdin: '', maxSteps: 100 };

    it('returns null for local development (not on Vercel)', async () => {
      delete process.env.VERCEL;

      const result = await traceInSandbox('session-123', code, options);

      expect(result).toBeNull();
      expect(mockTraceOnVercelSandbox).not.toHaveBeenCalled();
    });

    it('returns error when on Vercel but sandbox not enabled', async () => {
      process.env.VERCEL = '1';
      delete process.env.VERCEL_SANDBOX_ENABLED;

      const result = await traceInSandbox('session-123', code, options);

      expect(result).not.toBeNull();
      expect(result!.exitCode).toBe(1);
      expect(result!.error).toContain('not yet available');
      expect(mockTraceOnVercelSandbox).not.toHaveBeenCalled();
    });

    it('traces on Vercel Sandbox when enabled', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = '1';

      const result = await traceInSandbox('session-123', code, options);

      expect(result!.exitCode).toBe(0);
      expect(result!.steps.length).toBe(1);
      expect(mockTraceOnVercelSandbox).toHaveBeenCalledWith('session-123', code, options);
    });

    it('creates sandbox if missing when enabled', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = '1';
      mockHasSandbox.mockResolvedValueOnce(false);

      await traceInSandbox('session-123', code, options);

      expect(mockCreateSessionSandbox).toHaveBeenCalledWith('session-123');
      expect(mockTraceOnVercelSandbox).toHaveBeenCalled();
    });

    it('returns error if sandbox creation fails', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = '1';
      mockHasSandbox.mockResolvedValueOnce(false);
      mockCreateSessionSandbox.mockRejectedValueOnce(new Error('Failed'));

      const result = await traceInSandbox('session-123', code, options);

      expect(result!.exitCode).toBe(1);
      expect(result!.error).toContain('temporarily unavailable');
    });
  });

  describe('cleanupSandbox', () => {
    it('does nothing when not on Vercel', async () => {
      delete process.env.VERCEL;

      await cleanupSandbox('session-123');

      expect(mockCleanupSandbox).not.toHaveBeenCalled();
    });

    it('cleans up when on Vercel with sandbox enabled', async () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_SANDBOX_ENABLED = '1';

      await cleanupSandbox('session-123');

      expect(mockCleanupSandbox).toHaveBeenCalledWith('session-123');
    });
  });
});
