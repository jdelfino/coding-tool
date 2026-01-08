/**
 * Unit tests for POST /api/sections/[id]/regenerate-code
 * Tests regenerating join codes for sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import type { User } from '@/server/auth/types';

// Mock dependencies
jest.mock('@/server/auth', () => ({
  getAuthProvider: jest.fn(),
}));

jest.mock('@/server/classes', () => ({
  getSectionRepository: jest.fn(),
}));

import { getAuthProvider } from '@/server/auth';
import { getSectionRepository } from '@/server/classes';

// Test fixture factory
function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: 'instructor-1',
    username: 'instructor@example.com',
    email: 'instructor@example.com',
    role: 'instructor',
    namespaceId: 'default',
    createdAt: new Date(),
    ...overrides,
  };
}

function createTestSection(overrides: any = {}) {
  return {
    id: 'section-1',
    classId: 'class-1',
    name: 'Test Section',
    joinCode: 'ABC123',
    namespaceId: 'default',
    instructorIds: ['instructor-1'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('POST /api/sections/[id]/regenerate-code', () => {
  const mockAuthProvider = {
    getSessionFromRequest: jest.fn(),
  };

  const mockSectionRepo = {
    getSection: jest.fn(),
    regenerateJoinCode: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthProvider as jest.Mock).mockResolvedValue(mockAuthProvider);
    (getSectionRepository as jest.Mock).mockResolvedValue(mockSectionRepo);
  });

  it('should return 401 if not authenticated', async () => {
    mockAuthProvider.getSessionFromRequest.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sections/section-1/regenerate-code', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'section-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('should return 401 if session has no user', async () => {
    mockAuthProvider.getSessionFromRequest.mockResolvedValue({ user: null });

    const request = new NextRequest('http://localhost/api/sections/section-1/regenerate-code', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'section-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('should return 404 if section not found', async () => {
    const user = createTestUser();
    mockAuthProvider.getSessionFromRequest.mockResolvedValue({ user });
    mockSectionRepo.getSection.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sections/nonexistent/regenerate-code', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'nonexistent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Section not found');
  });

  it('should return 403 if user is not an instructor of the section', async () => {
    const user = createTestUser({ id: 'other-user' });
    mockAuthProvider.getSessionFromRequest.mockResolvedValue({ user });

    const mockSection = createTestSection({ instructorIds: ['instructor-1'] });
    mockSectionRepo.getSection.mockResolvedValue(mockSection);

    const request = new NextRequest('http://localhost/api/sections/section-1/regenerate-code', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'section-1' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Only section instructors can regenerate join codes');
  });

  it('should return 403 for students', async () => {
    const user = createTestUser({ id: 'student-1', role: 'student' });
    mockAuthProvider.getSessionFromRequest.mockResolvedValue({ user });

    const mockSection = createTestSection({ instructorIds: ['instructor-1'] });
    mockSectionRepo.getSection.mockResolvedValue(mockSection);

    const request = new NextRequest('http://localhost/api/sections/section-1/regenerate-code', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'section-1' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Only section instructors can regenerate join codes');
  });

  it('should successfully regenerate join code for section instructor', async () => {
    const user = createTestUser();
    mockAuthProvider.getSessionFromRequest.mockResolvedValue({ user });

    const mockSection = createTestSection();
    mockSectionRepo.getSection.mockResolvedValue(mockSection);
    mockSectionRepo.regenerateJoinCode.mockResolvedValue('NEW456');

    const request = new NextRequest('http://localhost/api/sections/section-1/regenerate-code', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'section-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.joinCode).toBe('NEW456');
    expect(mockSectionRepo.regenerateJoinCode).toHaveBeenCalledWith('section-1');
  });

  it('should allow co-instructor to regenerate join code', async () => {
    const user = createTestUser({ id: 'instructor-2' });
    mockAuthProvider.getSessionFromRequest.mockResolvedValue({ user });

    const mockSection = createTestSection({ instructorIds: ['instructor-1', 'instructor-2'] });
    mockSectionRepo.getSection.mockResolvedValue(mockSection);
    mockSectionRepo.regenerateJoinCode.mockResolvedValue('XYZ789');

    const request = new NextRequest('http://localhost/api/sections/section-1/regenerate-code', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'section-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.joinCode).toBe('XYZ789');
  });
});
