/**
 * Tests for POST /api/problems/[id]/duplicate
 *
 * Verifies:
 * - Instructor can duplicate a problem: returns 201 with title ending ' (copy)',
 *   authorId === caller, namespaceId === caller's namespace.
 * - Student gets 403; nothing is created.
 * - Cross-namespace problem id (getById returns null scoped to caller's namespace) -> 404.
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import { createStorage } from '@/server/persistence';

// Mock dependencies
jest.mock('@/server/persistence');

jest.mock('@/server/auth/api-helpers', () => ({
  requireAuth: jest.fn(),
  getNamespaceContext: jest.fn((req: any, user: any) => user.namespaceId || 'default'),
}));

import { requireAuth, getNamespaceContext } from '@/server/auth/api-helpers';
import type { User } from '@/server/auth/types';
import { RBACService } from '@/server/auth/rbac';

const mockCreateStorage = createStorage as jest.MockedFunction<typeof createStorage>;

// Per-file pattern from route.test.ts
function createAuthContext(user: User) {
  return {
    user,
    accessToken: 'test-access-token',
    rbac: new RBACService(user),
  };
}

const mockInstructorUser: User = {
  id: 'caller-instructor-id',
  email: 'instructor@example.com',
  role: 'instructor',
  namespaceId: 'ns-caller',
  createdAt: new Date('2025-01-01'),
};

const mockStudentUser: User = {
  id: 'caller-student-id',
  email: 'student@example.com',
  role: 'student',
  namespaceId: 'ns-caller',
  createdAt: new Date('2025-01-01'),
};

const mockOriginalProblem = {
  id: 'problem-original',
  namespaceId: 'ns-caller',
  title: 'Original Problem',
  description: 'A description',
  starterCode: 'def solve(): pass',
  solution: 'def solve(): return 42',
  testCases: [],
  executionSettings: undefined,
  authorId: 'other-instructor-id',
  classId: 'class-1',
  tags: ['loops'],
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

function makeRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/problems/${id}/duplicate`, {
    method: 'POST',
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/problems/[id]/duplicate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('instructor role', () => {
    it('returns 201 with title ending (copy), authorId === caller, namespaceId === caller ns', async () => {
      /**
       * Contract: instructor can duplicate any problem in their namespace;
       * the copy is owned by the caller (not the original author) and has
       * title = original.title + ' (copy)'.
       * Verifies the core ownership-transfer behavior at the route level.
       */
      (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockInstructorUser));

      const duplicatedProblem = {
        ...mockOriginalProblem,
        id: 'problem-copy',
        title: 'Original Problem (copy)',
        authorId: mockInstructorUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const getByIdMock = jest.fn().mockResolvedValue(mockOriginalProblem);
      const duplicateMock = jest.fn().mockResolvedValue(duplicatedProblem);

      mockCreateStorage.mockResolvedValue({
        problems: {
          getById: getByIdMock,
          duplicate: duplicateMock,
        },
      } as any);

      const response = await POST(makeRequest('problem-original'), makeParams('problem-original'));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.problem.title).toBe('Original Problem (copy)');
      expect(data.problem.authorId).toBe(mockInstructorUser.id);
      expect(data.problem.namespaceId).toBe(mockInstructorUser.namespaceId);

      // Verify it called getById scoped to caller namespace
      expect(getByIdMock).toHaveBeenCalledWith('problem-original', 'ns-caller');

      // Verify duplicate called with correct args
      expect(duplicateMock).toHaveBeenCalledWith(
        'problem-original',
        'Original Problem (copy)',
        mockInstructorUser.id
      );
    });
  });

  describe('student role', () => {
    it('returns 403 and does not create a copy', async () => {
      /**
       * Contract: students cannot duplicate problems (role below instructor).
       * Ensures the INLINE role check mirrors POST /api/problems behavior.
       */
      (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockStudentUser));

      const duplicateMock = jest.fn();
      mockCreateStorage.mockResolvedValue({
        problems: {
          getById: jest.fn(),
          duplicate: duplicateMock,
        },
      } as any);

      const response = await POST(makeRequest('problem-original'), makeParams('problem-original'));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(duplicateMock).not.toHaveBeenCalled();
    });
  });

  describe('cross-namespace problem id', () => {
    it('returns 404 and does not create a copy when problem not found in caller namespace', async () => {
      /**
       * Contract: if getById returns null (problem missing or in another namespace),
       * the route returns 404 and does NOT call duplicate().
       * Prevents cross-namespace data copying.
       */
      (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockInstructorUser));

      const duplicateMock = jest.fn();
      mockCreateStorage.mockResolvedValue({
        problems: {
          getById: jest.fn().mockResolvedValue(null),
          duplicate: duplicateMock,
        },
      } as any);

      const response = await POST(
        makeRequest('problem-from-other-ns'),
        makeParams('problem-from-other-ns')
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(duplicateMock).not.toHaveBeenCalled();
    });
  });

  describe('unauthenticated request', () => {
    it('returns 401 when not authenticated', async () => {
      (requireAuth as jest.Mock).mockResolvedValue(
        NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      );

      const response = await POST(makeRequest('problem-original'), makeParams('problem-original'));

      expect(response.status).toBe(401);
    });
  });
});
