/**
 * Unit tests for POST /api/sections/join
 * Tests student joining sections via join code
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
jest.mock('@/server/auth', () => ({
  getAuthProvider: jest.fn(),
}));

jest.mock('@/server/classes', () => ({
  getSectionRepository: jest.fn(),
  getMembershipRepository: jest.fn(),
}));

import { getAuthProvider } from '@/server/auth';
import { getSectionRepository, getMembershipRepository } from '@/server/classes';

describe('POST /api/sections/join', () => {
  const mockAuthProvider = {
    getSession: jest.fn(),
  };

  const mockSectionRepo = {
    getSectionByJoinCode: jest.fn(),
  };

  const mockMembershipRepo = {
    addMembership: jest.fn(),
    getMembership: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthProvider as jest.Mock).mockResolvedValue(mockAuthProvider);
    (getSectionRepository as jest.Mock).mockReturnValue(mockSectionRepo);
    (getMembershipRepository as jest.Mock).mockReturnValue(mockMembershipRepo);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest('http://localhost/api/sections/join', {
      method: 'POST',
      body: JSON.stringify({ joinCode: 'TEST123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('should return 400 if join code is missing', async () => {
    const mockSession = {
      user: { id: 'student-1', username: 'bob@example.com', role: 'student' },
      sessionId: 'test-session',
    };
    mockAuthProvider.getSession.mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost/api/sections/join', {
      method: 'POST',
      headers: { Cookie: 'sessionId=test-session' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Join code is required');
  });

  it('should return 404 if join code is invalid', async () => {
    const mockSession = {
      user: { id: 'student-1', username: 'bob@example.com', role: 'student' },
      sessionId: 'test-session',
    };
    mockAuthProvider.getSession.mockResolvedValue(mockSession);
    mockSectionRepo.getSectionByJoinCode.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sections/join', {
      method: 'POST',
      headers: { Cookie: 'sessionId=test-session' },
      body: JSON.stringify({ joinCode: 'INVALID' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Invalid join code');
  });

  it('should return 400 if already enrolled', async () => {
    const mockSession = {
      user: { id: 'student-1', username: 'bob@example.com', role: 'student' },
      sessionId: 'test-session',
    };
    mockAuthProvider.getSession.mockResolvedValue(mockSession);

    const mockSection = {
      id: 'section-1',
      classId: 'class-1',
      name: 'Section A',
      joinCode: 'TEST123',
      instructorIds: ['instructor-1'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockSectionRepo.getSectionByJoinCode.mockResolvedValue(mockSection);

    const existingMembership = {
      id: 'membership-1',
      sectionId: 'section-1',
      userId: 'student-1',
      joinedAt: new Date(),
    };
    mockMembershipRepo.getMembership.mockResolvedValue(existingMembership);

    const request = new NextRequest('http://localhost/api/sections/join', {
      method: 'POST',
      headers: { Cookie: 'sessionId=test-session' },
      body: JSON.stringify({ joinCode: 'TEST123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe('You are already a member of this section');
  });

  it('should successfully join section with valid code', async () => {
    const mockSession = {
      user: { id: 'student-1', username: 'bob@example.com', role: 'student' },
      sessionId: 'test-session',
    };
    mockAuthProvider.getSession.mockResolvedValue(mockSession);

    const mockSection = {
      id: 'section-1',
      classId: 'class-1',
      name: 'Section A',
      joinCode: 'TEST123',
      instructorIds: ['instructor-1'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockSectionRepo.getSectionByJoinCode.mockResolvedValue(mockSection);
      mockMembershipRepo.getMembership.mockResolvedValue(null);
    const newMembership = {
      id: 'membership-1',
      sectionId: 'section-1',
      userId: 'student-1',
      joinedAt: new Date(),
    };
    mockMembershipRepo.addMembership.mockResolvedValue(newMembership);

    const request = new NextRequest('http://localhost/api/sections/join', {
      method: 'POST',
      headers: { Cookie: 'sessionId=test-session' },
      body: JSON.stringify({ joinCode: 'TEST123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.section).toMatchObject({ id: 'section-1', name: 'Section A' });
    expect(mockMembershipRepo.addMembership).toHaveBeenCalledWith({
      sectionId: 'section-1',
      userId: 'student-1',
      role: 'student',
    });
  });

  it('should normalize join code (uppercase and trim)', async () => {
    const mockSession = {
      user: { id: 'student-1', username: 'bob@example.com', role: 'student' },
      sessionId: 'test-session',
    };
    mockAuthProvider.getSession.mockResolvedValue(mockSession);

    mockSectionRepo.getSectionByJoinCode.mockResolvedValue({
      id: 'section-1',
      classId: 'class-1',
      name: 'Section A',
      joinCode: 'TEST123',
      instructorIds: ['instructor-1'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockMembershipRepo.getMembership.mockResolvedValue(null);
    mockMembershipRepo.addMembership.mockResolvedValue({
      id: 'membership-1',
      sectionId: 'section-1',
      userId: 'student-1',
      joinedAt: new Date(),
    });

    const request = new NextRequest('http://localhost/api/sections/join', {
      method: 'POST',
      headers: { Cookie: 'sessionId=test-session' },
      body: JSON.stringify({ joinCode: '  test123  ' }),
    });

    await POST(request);

    expect(mockSectionRepo.getSectionByJoinCode).toHaveBeenCalledWith('TEST123');
  });
});
