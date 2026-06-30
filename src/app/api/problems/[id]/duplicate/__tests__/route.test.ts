/**
 * Tests for POST /api/problems/[id]/duplicate
 *
 * Tests:
 * - Authentication via requirePermission('problem.create')
 * - 401/403 from auth gate (unauthenticated, student)
 * - 400 for blank title
 * - 404 for unknown source problem
 * - 404 for unknown target class
 * - 403 for target class not owned by instructor
 * - 201 same-class duplicate (no targetClassId)
 * - 201 cross-class duplicate (owned target class)
 *
 * Pattern: mock requirePermission (not requireAuth), following
 * src/app/api/admin/users/[id]/__tests__/route.test.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import { createStorage } from '@/server/persistence';
import { getClassRepository } from '@/server/classes';
import { requirePermission, getNamespaceContext } from '@/server/auth/api-helpers';
import { rateLimit } from '@/server/rate-limit';
import type { User } from '@/server/auth/types';
import { RBACService } from '@/server/auth/rbac';

// Mock dependencies
jest.mock('@/server/persistence');
jest.mock('@/server/classes');
jest.mock('@/server/rate-limit');
jest.mock('@/server/auth/api-helpers', () => ({
  requirePermission: jest.fn(),
  getNamespaceContext: jest.fn((req: any, user: any) => user.namespaceId || 'default'),
}));

const mockCreateStorage = createStorage as jest.MockedFunction<typeof createStorage>;
const mockGetClassRepository = getClassRepository as jest.MockedFunction<typeof getClassRepository>;
const mockRequirePermission = requirePermission as jest.MockedFunction<typeof requirePermission>;
const mockRateLimit = rateLimit as jest.MockedFunction<typeof rateLimit>;

function createAuthContext(user: User) {
  return {
    user,
    accessToken: 'test-access-token',
    rbac: new RBACService(),
  };
}

describe('POST /api/problems/[id]/duplicate', () => {
  const mockInstructor: User = {
    id: 'instructor-1',
    email: 'instructor@test.com',
    role: 'instructor' as const,
    namespaceId: 'ns-default',
    createdAt: new Date('2025-01-01'),
  };

  const mockStudent: User = {
    id: 'student-1',
    email: 'student@test.com',
    role: 'student' as const,
    namespaceId: 'ns-default',
    createdAt: new Date('2025-01-01'),
  };

  const mockSourceProblem = {
    id: 'problem-source',
    title: 'Original Problem',
    description: 'A description',
    starterCode: 'print("hello")',
    testCases: [],
    authorId: 'instructor-1',
    classId: 'class-A',
    namespaceId: 'ns-default',
    tags: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockDuplicatedProblem = {
    ...mockSourceProblem,
    id: 'problem-copy',
    title: 'Copy of Original Problem',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function makeRequest(body: object) {
    return new NextRequest('http://localhost/api/problems/problem-source/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: rate limiter allows
    mockRateLimit.mockResolvedValue(null);
  });

  it('should return 401 when requirePermission returns unauthenticated response', async () => {
    /**
     * Verifies that the route propagates the 401 from the auth gate.
     * Catches: missing or bypassed requirePermission call.
     */
    mockRequirePermission.mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    );

    const response = await POST(makeRequest({ title: 'Copy' }), {
      params: Promise.resolve({ id: 'problem-source' }),
    });

    expect(response.status).toBe(401);
  });

  it('should return 403 when user is a student (lacks problem.create permission)', async () => {
    /**
     * Verifies that students cannot duplicate problems.
     * requirePermission('problem.create') returns 403 for students.
     * Catches: missing role gate; wrong permission checked.
     */
    mockRequirePermission.mockResolvedValue(
      NextResponse.json(
        { error: 'Forbidden: Requires problem.create permission' },
        { status: 403 }
      )
    );

    const mockDuplicateFn = jest.fn();
    mockCreateStorage.mockResolvedValue({
      problems: { getById: jest.fn(), duplicate: mockDuplicateFn },
    } as any);

    const response = await POST(makeRequest({ title: 'Copy' }), {
      params: Promise.resolve({ id: 'problem-source' }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(mockDuplicateFn).not.toHaveBeenCalled();
  });

  it('should return 400 when title is blank or whitespace-only', async () => {
    /**
     * Verifies title validation before any DB calls.
     * Catches: missing blank-title guard; whitespace not trimmed.
     */
    mockRequirePermission.mockResolvedValue(createAuthContext(mockInstructor));

    const mockDuplicateFn = jest.fn();
    mockCreateStorage.mockResolvedValue({
      problems: { getById: jest.fn(), duplicate: mockDuplicateFn },
    } as any);

    const response = await POST(makeRequest({ title: '   ' }), {
      params: Promise.resolve({ id: 'problem-source' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Title is required');
    expect(mockDuplicateFn).not.toHaveBeenCalled();
  });

  it('should return 404 when source problem is not found', async () => {
    /**
     * Verifies namespace-scoped source lookup returns 404 on miss.
     * Also asserts namespaceId is forwarded to getById — if omitted, a problem
     * from another namespace could be resolved, leaking cross-tenant data.
     * Catches: missing null check; namespace not passed to getById.
     */
    mockRequirePermission.mockResolvedValue(createAuthContext(mockInstructor));

    const mockGetById = jest.fn().mockResolvedValue(null);
    const mockDuplicateFn = jest.fn();
    mockCreateStorage.mockResolvedValue({
      problems: {
        getById: mockGetById,
        duplicate: mockDuplicateFn,
      },
    } as any);

    const response = await POST(makeRequest({ title: 'Copy' }), {
      params: Promise.resolve({ id: 'problem-source' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Problem not found');
    expect(mockDuplicateFn).not.toHaveBeenCalled();
    // Namespace must be forwarded so cross-tenant problems are never resolved.
    expect(mockGetById).toHaveBeenCalledWith('problem-source', 'ns-default');
  });

  it('should return 201 for same-class duplicate with no targetClassId', async () => {
    /**
     * Verifies the happy path: same-class copy authored by the requesting instructor.
     * duplicate must be called with { title, classId: source.classId, authorId: user.id }.
     * Also asserts the route calls requirePermission with 'problem.create' — if it were
     * changed to 'problem.read' (which students have), all other tests would still pass.
     * Catches: authorId not set to current user; classId defaulting wrong; wrong permission.
     */
    mockRequirePermission.mockResolvedValue(createAuthContext(mockInstructor));

    const mockGetById = jest.fn().mockResolvedValue(mockSourceProblem);
    const mockDuplicateFn = jest.fn().mockResolvedValue(mockDuplicatedProblem);
    mockCreateStorage.mockResolvedValue({
      problems: { getById: mockGetById, duplicate: mockDuplicateFn },
    } as any);

    const response = await POST(makeRequest({ title: 'Copy of Original Problem' }), {
      params: Promise.resolve({ id: 'problem-source' }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.problem).toBeDefined();
    expect(mockDuplicateFn).toHaveBeenCalledWith('problem-source', {
      title: 'Copy of Original Problem',
      classId: mockSourceProblem.classId,
      authorId: mockInstructor.id,
    });
    // Gate on exact permission string: students have problem.read but NOT problem.create.
    expect(mockRequirePermission).toHaveBeenCalledWith(expect.anything(), 'problem.create');
  });

  it('should return 201 for cross-class duplicate when instructor owns the target class', async () => {
    /**
     * Verifies that an instructor can port a problem to a class they own.
     * Verifies that duplicate is called with the targetClassId, not the source classId.
     * Catches: targetClassId ignored; ownership check wrongly blocking owned class.
     */
    mockRequirePermission.mockResolvedValue(createAuthContext(mockInstructor));

    const mockGetById = jest.fn().mockResolvedValue(mockSourceProblem);
    const mockDuplicateFn = jest.fn().mockResolvedValue({
      ...mockDuplicatedProblem,
      classId: 'class-B',
    });
    mockCreateStorage.mockResolvedValue({
      problems: { getById: mockGetById, duplicate: mockDuplicateFn },
    } as any);

    const mockTargetClass = {
      id: 'class-B',
      createdBy: mockInstructor.id,
      namespaceId: 'ns-default',
    };
    const mockClassRepo = {
      getClass: jest.fn().mockResolvedValue(mockTargetClass),
    };
    mockGetClassRepository.mockReturnValue(mockClassRepo as any);

    const response = await POST(
      makeRequest({ title: 'Copy', targetClassId: 'class-B' }),
      { params: Promise.resolve({ id: 'problem-source' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockDuplicateFn).toHaveBeenCalledWith('problem-source', {
      title: 'Copy',
      classId: 'class-B',
      authorId: mockInstructor.id,
    });
  });

  it('should return 403 when instructor does not own the target class', async () => {
    /**
     * Verifies that an instructor cannot port a problem to a class they do not own.
     * The createdBy check is a custom authorization layer on top of requirePermission.
     * Catches: ownership check missing; wrong field compared.
     */
    mockRequirePermission.mockResolvedValue(createAuthContext(mockInstructor));

    const mockGetById = jest.fn().mockResolvedValue(mockSourceProblem);
    const mockDuplicateFn = jest.fn();
    mockCreateStorage.mockResolvedValue({
      problems: { getById: mockGetById, duplicate: mockDuplicateFn },
    } as any);

    const mockTargetClass = {
      id: 'class-B',
      createdBy: 'someone-else',
      namespaceId: 'ns-default',
    };
    const mockClassRepo = {
      getClass: jest.fn().mockResolvedValue(mockTargetClass),
    };
    mockGetClassRepository.mockReturnValue(mockClassRepo as any);

    const response = await POST(
      makeRequest({ title: 'Copy', targetClassId: 'class-B' }),
      { params: Promise.resolve({ id: 'problem-source' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You do not own the target class');
    expect(mockDuplicateFn).not.toHaveBeenCalled();
  });

  it('should return 404 when target class is not found', async () => {
    /**
     * Verifies that a non-existent (or out-of-namespace) target class yields 404.
     * Also asserts namespaceId is forwarded to getClass — without it, a class from
     * another tenant could be resolved, enabling cross-tenant problem porting.
     * Catches: null not handled; missing namespace filter on getClass.
     */
    mockRequirePermission.mockResolvedValue(createAuthContext(mockInstructor));

    const mockGetById = jest.fn().mockResolvedValue(mockSourceProblem);
    const mockDuplicateFn = jest.fn();
    mockCreateStorage.mockResolvedValue({
      problems: { getById: mockGetById, duplicate: mockDuplicateFn },
    } as any);

    const mockClassRepo = {
      getClass: jest.fn().mockResolvedValue(null),
    };
    mockGetClassRepository.mockReturnValue(mockClassRepo as any);

    const response = await POST(
      makeRequest({ title: 'Copy', targetClassId: 'class-nonexistent' }),
      { params: Promise.resolve({ id: 'problem-source' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Target class not found');
    expect(mockDuplicateFn).not.toHaveBeenCalled();
    // Namespace must be forwarded to prevent cross-tenant class resolution.
    expect(mockClassRepo.getClass).toHaveBeenCalledWith('class-nonexistent', 'ns-default');
  });

  it('should call duplicate with trimmed title when title has surrounding whitespace', async () => {
    /**
     * Verifies that title.trim() is applied before storing: a title of '  Foo  '
     * must reach the repository as 'Foo'. Without this, stored titles would
     * carry invisible leading/trailing spaces.
     */
    mockRequirePermission.mockResolvedValue(createAuthContext(mockInstructor));

    const mockGetById = jest.fn().mockResolvedValue(mockSourceProblem);
    const mockDuplicateFn = jest.fn().mockResolvedValue({ ...mockDuplicatedProblem, title: 'Foo' });
    mockCreateStorage.mockResolvedValue({
      problems: { getById: mockGetById, duplicate: mockDuplicateFn },
    } as any);

    const response = await POST(makeRequest({ title: '  Foo  ' }), {
      params: Promise.resolve({ id: 'problem-source' }),
    });

    expect(response.status).toBe(201);
    expect(mockDuplicateFn).toHaveBeenCalledWith('problem-source', {
      title: 'Foo',
      classId: mockSourceProblem.classId,
      authorId: mockInstructor.id,
    });
  });

  it('should skip class lookup when targetClassId equals source.classId', async () => {
    /**
     * Verifies the same-class short-circuit: when targetClassId === source.classId,
     * the route skips getClass and ownership checks and duplicates within the same class.
     * Catches: unnecessary ownership check blocking same-class duplicate with targetClassId set;
     * or, missing short-circuit causing a wasted DB lookup.
     */
    mockRequirePermission.mockResolvedValue(createAuthContext(mockInstructor));

    const mockGetById = jest.fn().mockResolvedValue(mockSourceProblem);
    const mockDuplicateFn = jest.fn().mockResolvedValue(mockDuplicatedProblem);
    mockCreateStorage.mockResolvedValue({
      problems: { getById: mockGetById, duplicate: mockDuplicateFn },
    } as any);

    // Pass targetClassId equal to source.classId ('class-A')
    const response = await POST(
      makeRequest({ title: 'Same Class Copy', targetClassId: mockSourceProblem.classId }),
      { params: Promise.resolve({ id: 'problem-source' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    // getClassRepository must NOT be called — no ownership check needed
    expect(mockGetClassRepository).not.toHaveBeenCalled();
    expect(mockDuplicateFn).toHaveBeenCalledWith('problem-source', {
      title: 'Same Class Copy',
      classId: mockSourceProblem.classId,
      authorId: mockInstructor.id,
    });
  });

  it('should skip class ownership check for namespace-admin targeting any class', async () => {
    /**
     * Verifies that namespace-admins can duplicate to any class in their namespace
     * without the createdBy ownership check.
     * Catches: ownership check incorrectly applied to admins.
     */
    const mockAdmin: User = {
      id: 'admin-1',
      email: 'admin@test.com',
      role: 'namespace-admin' as const,
      namespaceId: 'ns-default',
      createdAt: new Date('2025-01-01'),
    };
    mockRequirePermission.mockResolvedValue(createAuthContext(mockAdmin));

    const mockGetById = jest.fn().mockResolvedValue(mockSourceProblem);
    const mockDuplicateFn = jest.fn().mockResolvedValue({
      ...mockDuplicatedProblem,
      classId: 'class-B',
      authorId: mockAdmin.id,
    });
    mockCreateStorage.mockResolvedValue({
      problems: { getById: mockGetById, duplicate: mockDuplicateFn },
    } as any);

    // Class is owned by someone else — admin should still be allowed
    const mockTargetClass = {
      id: 'class-B',
      createdBy: 'another-instructor',
      namespaceId: 'ns-default',
    };
    const mockClassRepo = {
      getClass: jest.fn().mockResolvedValue(mockTargetClass),
    };
    mockGetClassRepository.mockReturnValue(mockClassRepo as any);

    const response = await POST(
      makeRequest({ title: 'Admin Copy', targetClassId: 'class-B' }),
      { params: Promise.resolve({ id: 'problem-source' }) }
    );

    expect(response.status).toBe(201);
    expect(mockDuplicateFn).toHaveBeenCalledWith('problem-source', {
      title: 'Admin Copy',
      classId: 'class-B',
      authorId: mockAdmin.id,
    });
  });
});
