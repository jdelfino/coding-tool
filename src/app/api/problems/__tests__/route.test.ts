/**
 * Tests for /api/problems endpoints
 * 
 * Tests:
 * - GET /api/problems - List problems with filters
 * - POST /api/problems - Create new problem
 * 
 * Coverage:
 * - Authentication checks
 * - Authorization (instructors/admins only for POST)
 * - Query parameter filtering (authorId, classId, includePublic, sortBy, sortOrder)
 * - Validation and error handling
 * - Edge cases (empty lists, invalid inputs)
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { getStorage } from '@/server/persistence';
import { getAuthProvider } from '@/server/auth';

// Mock dependencies
jest.mock('@/server/persistence');
jest.mock('@/server/auth');

const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;
const mockGetAuthProvider = getAuthProvider as jest.MockedFunction<typeof getAuthProvider>;

describe('/api/problems', () => {
  const mockProblems = [
    {
      id: 'problem-1',
      title: 'Problem 1',
      description: 'Description 1',
      starterCode: 'def solution():\n    pass',
      testCases: [],
      authorId: 'user-1',
      classId: 'class-1',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
    {
      id: 'problem-2',
      title: 'Problem 2',
      description: 'Description 2',
      starterCode: '',
      testCases: [],
      authorId: 'user-2',
      classId: 'class-2',
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-02'),
    },
  ];

  const mockInstructorUser = {
    id: 'user-1',
    username: 'instructor1',
    email: 'instructor1@test.com',
    role: 'instructor' as const,
    createdAt: new Date('2025-01-01'),
  };

  const mockStudentUser = {
    id: 'user-3',
    username: 'student1',
    email: 'student1@test.com',
    role: 'student' as const,
    createdAt: new Date('2025-01-01'),
  };

  const mockInstructorSession = {
    id: 'session-123',
    user: mockInstructorUser,
    expiresAt: new Date('2025-12-31'),
  };

  const mockStudentSession = {
    id: 'session-456',
    user: mockStudentUser,
    expiresAt: new Date('2025-12-31'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/problems', () => {
    it('should return 401 when not authenticated', async () => {
      const request = new NextRequest('http://localhost/api/problems');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when session is invalid', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(null),
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        headers: { Cookie: 'sessionId=invalid' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return all problems when authenticated', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      mockGetStorage.mockResolvedValue({
        problems: {
          getAll: jest.fn().mockResolvedValue(mockProblems),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        headers: { Cookie: 'sessionId=valid' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.problems).toHaveLength(2);
      expect(data.problems[0].title).toBe('Problem 1');
    });

    it('should filter by authorId', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      const filteredProblems = mockProblems.filter(p => p.authorId === 'user-1');
      mockGetStorage.mockResolvedValue({
        problems: {
          getAll: jest.fn().mockResolvedValue(filteredProblems),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems?authorId=user-1', {
        headers: { Cookie: 'sessionId=valid' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.problems).toHaveLength(1);
      expect(data.problems[0].authorId).toBe('user-1');
    });

    it('should filter by classId', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      const filteredProblems = mockProblems.filter(p => p.classId === 'class-1');
      mockGetStorage.mockResolvedValue({
        problems: {
          getAll: jest.fn().mockResolvedValue(filteredProblems),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems?classId=class-1', {
        headers: { Cookie: 'sessionId=valid' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.problems).toHaveLength(1);
      expect(data.problems[0].classId).toBe('class-1');
    });

    it('should handle includePublic parameter', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      mockGetStorage.mockResolvedValue({
        problems: {
          getAll: jest.fn().mockResolvedValue(mockProblems),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems?includePublic=false', {
        headers: { Cookie: 'sessionId=valid' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Verify the mock was called with includePublic: false
      const storage = await mockGetStorage();
      expect(storage.problems.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ includePublic: false })
      );
    });

    it('should handle sortBy and sortOrder parameters', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      mockGetStorage.mockResolvedValue({
        problems: {
          getAll: jest.fn().mockResolvedValue(mockProblems),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems?sortBy=title&sortOrder=asc', {
        headers: { Cookie: 'sessionId=valid' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Verify the mock was called with correct sort parameters
      const storage = await mockGetStorage();
      expect(storage.problems.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'title', sortOrder: 'asc' })
      );
    });

    it('should return empty array when no problems exist', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      mockGetStorage.mockResolvedValue({
        problems: {
          getAll: jest.fn().mockResolvedValue([]),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        headers: { Cookie: 'sessionId=valid' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.problems).toEqual([]);
    });

    it('should handle server errors gracefully', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      mockGetStorage.mockResolvedValue({
        problems: {
          getAll: jest.fn().mockRejectedValue(new Error('Database error')),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        headers: { Cookie: 'sessionId=valid' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });
  });

  describe('POST /api/problems', () => {
    const validProblemInput = {
      title: 'New Problem',
      description: 'New problem description',
      starterCode: 'def solution():\n    pass',
      testCases: [],
      classId: 'class-1',
    };

    it('should return 401 when not authenticated', async () => {
      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        body: JSON.stringify(validProblemInput),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when session is invalid', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(null),
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        headers: { Cookie: 'sessionId=invalid' },
        body: JSON.stringify(validProblemInput),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not an instructor', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockStudentSession),
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        headers: { Cookie: 'sessionId=valid' },
        body: JSON.stringify(validProblemInput),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Only instructors can create problems');
    });

    it('should create problem successfully for instructor', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      const createdProblem = {
        ...validProblemInput,
        id: 'problem-new',
        authorId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetStorage.mockResolvedValue({
        problems: {
          create: jest.fn().mockResolvedValue(createdProblem),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        headers: { Cookie: 'sessionId=valid' },
        body: JSON.stringify(validProblemInput),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.problem).toMatchObject({
        title: 'New Problem',
        authorId: 'user-1',
      });
    });

    it('should create problem with minimal fields', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      const minimalInput = {
        title: 'Minimal Problem',
      };

      const createdProblem = {
        id: 'problem-minimal',
        title: 'Minimal Problem',
        description: '',
        starterCode: '',
        testCases: [],
        authorId: 'user-1',
        classId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetStorage.mockResolvedValue({
        problems: {
          create: jest.fn().mockResolvedValue(createdProblem),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        headers: { Cookie: 'sessionId=valid' },
        body: JSON.stringify(minimalInput),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.problem.title).toBe('Minimal Problem');
      expect(data.problem.authorId).toBe('user-1');
    });

    it('should handle validation errors', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      const validationError = {
        code: 'INVALID_DATA',
        message: 'Title is required',
        details: { field: 'title' },
      };

      mockGetStorage.mockResolvedValue({
        problems: {
          create: jest.fn().mockRejectedValue(validationError),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        headers: { Cookie: 'sessionId=valid' },
        body: JSON.stringify({ title: '' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Title is required');
      expect(data.details).toEqual({ field: 'title' });
    });

    it('should handle server errors', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      mockGetStorage.mockResolvedValue({
        problems: {
          create: jest.fn().mockRejectedValue(new Error('Database error')),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        headers: { Cookie: 'sessionId=valid' },
        body: JSON.stringify(validProblemInput),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });

    it('should handle malformed JSON', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        headers: { Cookie: 'sessionId=valid' },
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeTruthy();
    });

    it('should set authorId to current user', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      let capturedInput: any;
      mockGetStorage.mockResolvedValue({
        problems: {
          create: jest.fn().mockImplementation((input) => {
            capturedInput = input;
            return Promise.resolve({ ...input, id: 'problem-new', createdAt: new Date(), updatedAt: new Date() });
          }),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        headers: { Cookie: 'sessionId=valid' },
        body: JSON.stringify(validProblemInput),
      });

      await POST(request);

      expect(capturedInput.authorId).toBe('user-1');
    });

    it('should handle problems with test cases', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      const inputWithTests = {
        ...validProblemInput,
        testCases: [
          {
            id: 'test-1',
            name: 'Test 1',
            input: 'test input',
            expectedOutput: 'test output',
          },
        ],
      };

      const createdProblem = {
        ...inputWithTests,
        id: 'problem-with-tests',
        authorId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetStorage.mockResolvedValue({
        problems: {
          create: jest.fn().mockResolvedValue(createdProblem),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        headers: { Cookie: 'sessionId=valid' },
        body: JSON.stringify(inputWithTests),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.problem.testCases).toHaveLength(1);
      expect(data.problem.testCases[0].name).toBe('Test 1');
    });

    it('should include executionSettings when provided', async () => {
      mockGetAuthProvider.mockResolvedValue({
        getSession: jest.fn().mockResolvedValue(mockInstructorSession),
      } as any);

      const inputWithExecSettings = {
        ...validProblemInput,
        executionSettings: {
          stdin: 'test input\n',
          randomSeed: 42,
          attachedFiles: [
            { name: 'input.txt', content: 'file content' },
          ],
        },
      };

      let capturedInput: any;
      mockGetStorage.mockResolvedValue({
        problems: {
          create: jest.fn().mockImplementation((input) => {
            capturedInput = input;
            return Promise.resolve({
              ...input,
              id: 'problem-exec',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }),
        },
      } as any);

      const request = new NextRequest('http://localhost/api/problems', {
        method: 'POST',
        headers: { Cookie: 'sessionId=valid' },
        body: JSON.stringify(inputWithExecSettings),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(capturedInput.executionSettings).toBeDefined();
      expect(capturedInput.executionSettings.stdin).toBe('test input\n');
      expect(capturedInput.executionSettings.randomSeed).toBe(42);
      expect(capturedInput.executionSettings.attachedFiles).toHaveLength(1);
      expect(capturedInput.executionSettings.attachedFiles[0].name).toBe('input.txt');
      expect(data.problem.executionSettings).toBeDefined();
    });
  });
});
