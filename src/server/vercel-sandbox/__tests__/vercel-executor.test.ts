/**
 * Tests for Vercel Sandbox Executor
 *
 * Uses mocked @vercel/sandbox SDK and Supabase client.
 */

// Mock @vercel/sandbox before imports
jest.mock('@vercel/sandbox', () => {
  const mockSandbox = {
    sandboxId: 'sb_test123',
    status: 'running',
    stop: jest.fn().mockResolvedValue(undefined),
    writeFiles: jest.fn().mockResolvedValue(undefined),
    runCommand: jest.fn().mockResolvedValue({
      exitCode: 0,
      stdout: jest.fn().mockResolvedValue('Hello, World!'),
      stderr: jest.fn().mockResolvedValue(''),
    }),
  };

  return {
    Sandbox: {
      create: jest.fn().mockResolvedValue(mockSandbox),
      get: jest.fn().mockResolvedValue(mockSandbox),
    },
    __mockSandbox: mockSandbox,
  };
});

// Mock Supabase client before imports
const mockSupabaseFrom = jest.fn();
jest.mock('../../supabase/client', () => ({
  getSupabaseClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

import {
  createSessionSandbox,
  getSandbox,
  executeOnVercelSandbox,
  cleanupSandbox,
  hasSandbox,
  SandboxError,
} from '../vercel-executor';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vercelSandboxMock = require('@vercel/sandbox');

// Get references to mocks for test assertions
const mockSandbox = vercelSandboxMock.__mockSandbox as {
  sandboxId: string;
  status: string;
  stop: jest.Mock;
  writeFiles: jest.Mock;
  runCommand: jest.Mock;
};
const mockSandboxClass = vercelSandboxMock.Sandbox as {
  create: jest.Mock;
  get: jest.Mock;
};

describe('Vercel Sandbox Executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSessionSandbox', () => {
    it('creates sandbox and stores ID in database', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabaseFrom.mockReturnValue({
        insert: mockInsert,
      });

      const sandboxId = await createSessionSandbox('session-123');

      expect(sandboxId).toBe('sb_test123');
      expect(mockSandboxClass.create).toHaveBeenCalledWith({
        runtime: 'python3.13',
        timeout: 45 * 60 * 1000,
      });
      expect(mockSupabaseFrom).toHaveBeenCalledWith('session_sandboxes');
      expect(mockInsert).toHaveBeenCalledWith({
        session_id: 'session-123',
        sandbox_id: 'sb_test123',
      });
    });

    it('throws SandboxError when DB insert fails', async () => {
      mockSupabaseFrom.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          error: { message: 'Database error' },
        }),
      });

      await expect(createSessionSandbox('session-123')).rejects.toThrow(SandboxError);
      expect(mockSandbox.stop).toHaveBeenCalled(); // Should cleanup sandbox
    });

    it('throws SandboxError when sandbox creation fails', async () => {
      mockSandboxClass.create.mockRejectedValueOnce(new Error('API error'));

      await expect(createSessionSandbox('session-123')).rejects.toThrow(SandboxError);
    });
  });

  describe('getSandbox', () => {
    it('reconnects to existing running sandbox', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { sandbox_id: 'sb_test123' },
              error: null,
            }),
          }),
        }),
      });

      const sandbox = await getSandbox('session-123');

      expect(mockSandboxClass.get).toHaveBeenCalledWith({ sandboxId: 'sb_test123' });
      expect(sandbox).toBe(mockSandbox);
    });

    it('throws SandboxError when no sandbox record exists', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      await expect(getSandbox('session-123')).rejects.toThrow(SandboxError);
    });

    it('recreates sandbox when status is not running', async () => {
      const stoppedSandbox = { ...mockSandbox, status: 'stopped' as const };
      const newSandbox = { ...mockSandbox, sandboxId: 'sb_new456', status: 'running' as const };

      // First get returns stopped sandbox
      mockSandboxClass.get.mockResolvedValueOnce(stoppedSandbox);
      // Create returns new sandbox
      mockSandboxClass.create.mockResolvedValueOnce(newSandbox);

      // Mock select for initial lookup
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { sandbox_id: 'sb_test123' },
            error: null,
          }),
        }),
      });

      // Mock update for optimistic locking
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { sandbox_id: 'sb_new456' },
                error: null,
              }),
            }),
          }),
        }),
      });

      mockSupabaseFrom
        .mockReturnValueOnce({ select: mockSelect })
        .mockReturnValueOnce({ update: mockUpdate });

      const sandbox = await getSandbox('session-123');

      expect(sandbox.sandboxId).toBe('sb_new456');
      expect(mockSandboxClass.create).toHaveBeenCalled();
    });
  });

  describe('executeOnVercelSandbox', () => {
    beforeEach(() => {
      // Reset sandbox mock
      mockSandbox.writeFiles.mockResolvedValue(undefined);
      mockSandbox.runCommand.mockResolvedValue({
        exitCode: 0,
        stdout: jest.fn().mockResolvedValue('Hello, World!'),
        stderr: jest.fn().mockResolvedValue(''),
      });

      // Mock getSandbox
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { sandbox_id: 'sb_test123' },
              error: null,
            }),
          }),
        }),
      });
    });

    it('executes code successfully', async () => {
      const result = await executeOnVercelSandbox('session-123', {
        code: 'print("Hello, World!")',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
      expect(result.error).toBe('');
      expect(mockSandbox.writeFiles).toHaveBeenCalledWith([
        { path: 'main.py', content: Buffer.from('print("Hello, World!")') },
      ]);
      expect(mockSandbox.runCommand).toHaveBeenCalledWith({
        cmd: 'python3',
        args: ['main.py'],
        cwd: '/vercel/sandbox',
        signal: expect.any(AbortSignal),
      });
    });

    it('injects random seed when provided', async () => {
      await executeOnVercelSandbox('session-123', {
        code: 'print(random.randint(1, 10))',
        executionSettings: { randomSeed: 42 },
      });

      expect(mockSandbox.writeFiles).toHaveBeenCalledWith([
        {
          path: 'main.py',
          content: Buffer.from('import random\nrandom.seed(42)\nprint(random.randint(1, 10))'),
        },
      ]);
    });

    it('writes stdin to file when provided', async () => {
      await executeOnVercelSandbox('session-123', {
        code: 'x = input()',
        executionSettings: { stdin: 'test input' },
      });

      expect(mockSandbox.writeFiles).toHaveBeenCalledWith([
        { path: 'main.py', content: Buffer.from('x = input()') },
        { path: '/tmp/stdin.txt', content: Buffer.from('test input') },
      ]);
    });

    it('writes attached files', async () => {
      await executeOnVercelSandbox('session-123', {
        code: 'with open("data.txt") as f: print(f.read())',
        executionSettings: {
          attachedFiles: [{ name: 'data.txt', content: 'file content' }],
        },
      });

      expect(mockSandbox.writeFiles).toHaveBeenCalledWith([
        { path: 'main.py', content: expect.any(Buffer) },
        { path: 'data.txt', content: Buffer.from('file content') },
      ]);
    });

    it('returns failure when code has errors', async () => {
      mockSandbox.runCommand.mockResolvedValueOnce({
        exitCode: 1,
        stdout: jest.fn().mockResolvedValue(''),
        stderr: jest.fn().mockResolvedValue('SyntaxError: invalid syntax'),
      });

      const result = await executeOnVercelSandbox('session-123', {
        code: 'print(',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SyntaxError: invalid syntax');
    });

    it('handles AbortError from timeout', async () => {
      // Mock runCommand to immediately reject with AbortError
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockSandbox.runCommand.mockRejectedValueOnce(abortError);

      const result = await executeOnVercelSandbox('session-123', {
        code: 'import time; time.sleep(100)',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('handles sandbox unavailable error', async () => {
      mockSupabaseFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      const result = await executeOnVercelSandbox('session-123', {
        code: 'print("hello")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('temporarily unavailable');
    });
  });

  describe('cleanupSandbox', () => {
    it('stops sandbox and deletes record', async () => {
      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      mockSupabaseFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { sandbox_id: 'sb_test123' },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({ delete: mockDelete });

      await cleanupSandbox('session-123');

      expect(mockSandbox.stop).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('handles already stopped sandbox gracefully', async () => {
      mockSandboxClass.get.mockRejectedValueOnce(new Error('Sandbox not found'));

      mockSupabaseFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { sandbox_id: 'sb_test123' },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        });

      // Should not throw
      await expect(cleanupSandbox('session-123')).resolves.not.toThrow();
    });

    it('handles no sandbox record gracefully', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      // Should not throw
      await expect(cleanupSandbox('session-123')).resolves.not.toThrow();
    });
  });

  describe('hasSandbox', () => {
    it('returns true when sandbox record exists', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { session_id: 'session-123' },
              error: null,
            }),
          }),
        }),
      });

      const result = await hasSandbox('session-123');

      expect(result).toBe(true);
    });

    it('returns false when no sandbox record exists', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      });

      const result = await hasSandbox('session-123');

      expect(result).toBe(false);
    });
  });
});
