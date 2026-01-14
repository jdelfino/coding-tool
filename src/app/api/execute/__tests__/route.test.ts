/**
 * Tests for /api/execute route
 *
 * @jest-environment node
 */

import { POST } from '../route';
import { getExecutorService } from '@/server/code-execution';
import { getAuthProvider } from '@/server/auth';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/server/code-execution');
jest.mock('@/server/auth');

const mockExecuteCode = jest.fn();
const mockGetExecutorService = getExecutorService as jest.MockedFunction<typeof getExecutorService>;
mockGetExecutorService.mockReturnValue({ executeCode: mockExecuteCode } as any);

const mockGetAuthProvider = getAuthProvider as jest.MockedFunction<typeof getAuthProvider>;

// Helper to create authenticated mock auth provider
const createMockAuthProvider = (authenticated: boolean) => ({
  getSessionFromRequest: jest.fn().mockResolvedValue(
    authenticated
      ? { user: { id: 'user-123', username: 'testuser', role: 'student' } }
      : null
  ),
});

describe('POST /api/execute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup mocks after clear
    mockGetExecutorService.mockReturnValue({ executeCode: mockExecuteCode } as any);
    // Default to unauthenticated
    mockGetAuthProvider.mockResolvedValue(createMockAuthProvider(false) as any);
  });

  const createMockRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/execute', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  it('should return 401 if user is not authenticated', async () => {
    const request = createMockRequest({ code: 'print("hello")' });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockExecuteCode).not.toHaveBeenCalled();
  });

  it('should return 401 if session is invalid', async () => {
    mockGetAuthProvider.mockResolvedValue(createMockAuthProvider(false) as any);

    const request = createMockRequest({ code: 'print("hello")' });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockExecuteCode).not.toHaveBeenCalled();
  });

  it('should return 400 if code is missing', async () => {
    mockGetAuthProvider.mockResolvedValue(createMockAuthProvider(true) as any);

    const request = createMockRequest({});

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Code is required');
    expect(mockExecuteCode).not.toHaveBeenCalled();
  });

  it('should execute code and return results', async () => {
    mockGetAuthProvider.mockResolvedValue(createMockAuthProvider(true) as any);

    mockExecuteCode.mockResolvedValue({
      success: true,
      output: 'Hello, World!\n',
      error: '',
      executionTime: 125,
      stdin: undefined,
    });

    const request = createMockRequest({
      code: 'print("Hello, World!")',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.output).toBe('Hello, World!\n');
    expect(data.error).toBe('');
    expect(mockExecuteCode).toHaveBeenCalledWith(
      {
        code: 'print("Hello, World!")',
        executionSettings: {
          stdin: undefined,
          randomSeed: undefined,
          attachedFiles: undefined,
        },
      },
      undefined
    );
  });

  it('should execute code with stdin and randomSeed', async () => {
    mockGetAuthProvider.mockResolvedValue(createMockAuthProvider(true) as any);

    mockExecuteCode.mockResolvedValue({
      success: true,
      output: '42\n',
      error: '',
      executionTime: 150,
      stdin: 'test input',
    });

    const request = createMockRequest({
      code: 'import random\nprint(random.randint(1, 100))',
      stdin: 'test input',
      randomSeed: 42,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockExecuteCode).toHaveBeenCalledWith(
      {
        code: 'import random\nprint(random.randint(1, 100))',
        executionSettings: {
          stdin: 'test input',
          randomSeed: 42,
          attachedFiles: undefined,
        },
      },
      undefined
    );
  });

  it('should execute code with attached files', async () => {
    mockGetAuthProvider.mockResolvedValue(createMockAuthProvider(true) as any);

    mockExecuteCode.mockResolvedValue({
      success: true,
      output: 'file content\n',
      error: '',
      executionTime: 175,
      stdin: undefined,
    });

    const attachedFiles = [
      { name: 'data.txt', content: 'file content' }
    ];

    const request = createMockRequest({
      code: 'with open("data.txt") as f:\n    print(f.read())',
      attachedFiles,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockExecuteCode).toHaveBeenCalledWith(
      {
        code: 'with open("data.txt") as f:\n    print(f.read())',
        executionSettings: {
          stdin: undefined,
          randomSeed: undefined,
          attachedFiles,
        },
      },
      undefined
    );
  });

  it('should handle execution errors', async () => {
    mockGetAuthProvider.mockResolvedValue(createMockAuthProvider(true) as any);

    mockExecuteCode.mockResolvedValue({
      success: false,
      output: '',
      error: 'NameError: name "x" is not defined',
      executionTime: 100,
      stdin: undefined,
    });

    const request = createMockRequest({
      code: 'print(x)',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.error).toContain('NameError');
  });

  it('should respect custom timeout', async () => {
    mockGetAuthProvider.mockResolvedValue(createMockAuthProvider(true) as any);

    mockExecuteCode.mockResolvedValue({
      success: false,
      output: '',
      error: 'Execution timed out after 5000ms',
      executionTime: 5000,
      stdin: undefined,
    });

    const request = createMockRequest({
      code: 'import time\ntime.sleep(10)',
      timeout: 5000,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockExecuteCode).toHaveBeenCalledWith(
      {
        code: 'import time\ntime.sleep(10)',
        executionSettings: {
          stdin: undefined,
          randomSeed: undefined,
          attachedFiles: undefined,
        },
      },
      5000
    );
  });

  it('should handle unexpected errors', async () => {
    mockGetAuthProvider.mockResolvedValue(createMockAuthProvider(true) as any);

    mockExecuteCode.mockRejectedValue(new Error('Unexpected error'));

    const request = createMockRequest({
      code: 'print("test")',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Unexpected error');
  });
});
