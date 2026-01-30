/**
 * Tests for GET /api/problems/[id]/public
 *
 * Unauthenticated endpoint returning public problem fields.
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { createStorage } from '@/server/persistence';

jest.mock('@/server/persistence');

const mockCreateStorage = createStorage as jest.MockedFunction<typeof createStorage>;

describe('GET /api/problems/[id]/public', () => {
  const mockProblem = {
    id: 'problem-123',
    title: 'Two Sum',
    description: 'Find two numbers that add up to a target.',
    solution: 'def two_sum(nums, target):\n    pass',
    starterCode: 'def two_sum():\n    pass',
    testCases: [],
    authorId: 'user-1',
    classId: 'class-1',
    namespaceId: 'default',
    tags: ['arrays'],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return public problem fields without auth', async () => {
    mockCreateStorage.mockResolvedValue({
      problems: {
        getById: jest.fn().mockResolvedValue(mockProblem),
      },
    } as any);

    const request = new NextRequest('http://localhost/api/problems/problem-123/public');
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await GET(request, params);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: 'problem-123',
      title: 'Two Sum',
      description: 'Find two numbers that add up to a target.',
      solution: 'def two_sum(nums, target):\n    pass',
    });
  });

  it('should return 404 for missing problem', async () => {
    mockCreateStorage.mockResolvedValue({
      problems: {
        getById: jest.fn().mockResolvedValue(null),
      },
    } as any);

    const request = new NextRequest('http://localhost/api/problems/nonexistent/public');
    const params = { params: Promise.resolve({ id: 'nonexistent' }) };

    const response = await GET(request, params);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Problem not found');
  });

  it('should not include sensitive fields like authorId or testCases', async () => {
    mockCreateStorage.mockResolvedValue({
      problems: {
        getById: jest.fn().mockResolvedValue(mockProblem),
      },
    } as any);

    const request = new NextRequest('http://localhost/api/problems/problem-123/public');
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await GET(request, params);
    const data = await response.json();

    expect(data.authorId).toBeUndefined();
    expect(data.testCases).toBeUndefined();
    expect(data.starterCode).toBeUndefined();
    expect(data.classId).toBeUndefined();
    expect(data.namespaceId).toBeUndefined();
  });

  it('should handle storage errors gracefully', async () => {
    mockCreateStorage.mockResolvedValue({
      problems: {
        getById: jest.fn().mockRejectedValue(new Error('DB error')),
      },
    } as any);

    const request = new NextRequest('http://localhost/api/problems/problem-123/public');
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await GET(request, params);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
