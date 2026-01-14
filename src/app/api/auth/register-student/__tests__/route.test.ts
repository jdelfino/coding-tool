/**
 * Tests for /api/auth/register-student endpoints
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { StudentRegistrationError } from '@/server/invitations';

// Mock dependencies
jest.mock('@/server/invitations', () => ({
  getStudentRegistrationService: jest.fn(),
  StudentRegistrationError: class StudentRegistrationError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message);
      this.name = 'StudentRegistrationError';
    }
  },
}));

jest.mock('@/server/persistence', () => ({
  getStorage: jest.fn(),
}));

import { getStudentRegistrationService } from '@/server/invitations';
import { getStorage } from '@/server/persistence';

describe('/api/auth/register-student', () => {
  // Mock data
  const mockSection = {
    id: 'section-123',
    name: 'Section A',
    semester: 'Fall 2024',
    namespaceId: 'test-namespace',
    classId: 'class-123',
    instructorIds: ['instructor-1', 'instructor-2'],
    joinCode: 'ABC-123-XYZ',
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockClass = {
    id: 'class-123',
    name: 'CS 101 - Intro to Programming',
    description: 'An introductory course',
    namespaceId: 'test-namespace',
    createdBy: 'instructor-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockNamespace = {
    id: 'test-namespace',
    displayName: 'Test University',
  };

  const mockInstructor = {
    id: 'instructor-1',
    username: 'prof_smith',
    displayName: 'Professor Smith',
  };

  const mockUser = {
    id: 'student-123',
    email: 'student@example.com',
    username: 'newstudent',
    role: 'student' as const,
    namespaceId: 'test-namespace',
    createdAt: new Date('2024-01-01'),
  };

  let mockStudentRegistrationService: any;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup student registration service mock
    mockStudentRegistrationService = {
      validateSectionCode: jest.fn().mockResolvedValue({
        valid: true,
        section: mockSection,
        namespace: mockNamespace,
        capacityAvailable: true,
      }),
      registerStudent: jest.fn().mockResolvedValue({
        user: mockUser,
        section: mockSection,
      }),
    };
    (getStudentRegistrationService as jest.Mock).mockResolvedValue(mockStudentRegistrationService);

    // Setup storage mock
    mockStorage = {
      classes: {
        getClass: jest.fn().mockResolvedValue(mockClass),
      },
      users: {
        getUser: jest.fn().mockResolvedValue(mockInstructor),
      },
    };
    (getStorage as jest.Mock).mockResolvedValue(mockStorage);
  });

  describe('GET /api/auth/register-student', () => {
    it('returns 400 if code is missing', async () => {
      const request = new NextRequest('http://localhost/api/auth/register-student');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Join code is required');
      expect(data.code).toBe('MISSING_CODE');
    });

    it('returns 400 for invalid code', async () => {
      mockStudentRegistrationService.validateSectionCode.mockResolvedValue({
        valid: false,
        error: 'INVALID_CODE',
      });

      const request = new NextRequest('http://localhost/api/auth/register-student?code=INVALID');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid join code');
      expect(data.code).toBe('INVALID_CODE');
    });

    it('returns 400 for inactive section', async () => {
      mockStudentRegistrationService.validateSectionCode.mockResolvedValue({
        valid: false,
        error: 'SECTION_INACTIVE',
      });

      const request = new NextRequest('http://localhost/api/auth/register-student?code=ABC-123-XYZ');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('This section is no longer accepting new students');
      expect(data.code).toBe('SECTION_INACTIVE');
    });

    it('returns section/class info for valid code', async () => {
      // Mock different instructors for each ID
      mockStorage.users.getUser.mockImplementation((id: string) => {
        if (id === 'instructor-1') {
          return Promise.resolve({ id: 'instructor-1', username: 'prof_smith', displayName: 'Professor Smith' });
        }
        if (id === 'instructor-2') {
          return Promise.resolve({ id: 'instructor-2', username: 'prof_jones', displayName: 'Professor Jones' });
        }
        return Promise.resolve(null);
      });

      const request = new NextRequest('http://localhost/api/auth/register-student?code=ABC-123-XYZ');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.section).toEqual({
        id: 'section-123',
        name: 'Section A',
        semester: 'Fall 2024',
      });
      expect(data.class).toEqual({
        id: 'class-123',
        name: 'CS 101 - Intro to Programming',
        description: 'An introductory course',
      });
      expect(data.namespace).toEqual({
        id: 'test-namespace',
        displayName: 'Test University',
      });
      expect(data.capacityAvailable).toBe(true);
      expect(data.instructors).toHaveLength(2);
      expect(data.instructors[0].displayName).toBe('Professor Smith');
      expect(data.instructors[1].displayName).toBe('Professor Jones');
    });

    it('handles missing class gracefully', async () => {
      mockStorage.classes.getClass.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/auth/register-student?code=ABC-123-XYZ');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.class).toBeNull();
    });

    it('shows capacity available as false when at limit', async () => {
      mockStudentRegistrationService.validateSectionCode.mockResolvedValue({
        valid: true,
        section: mockSection,
        namespace: mockNamespace,
        capacityAvailable: false,
      });

      const request = new NextRequest('http://localhost/api/auth/register-student?code=ABC-123-XYZ');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.capacityAvailable).toBe(false);
    });
  });

  describe('POST /api/auth/register-student', () => {
    const validBody = {
      code: 'ABC-123-XYZ',
      email: 'student@example.com',
      password: 'Password123',
      username: 'newstudent',
    };

    it('returns 400 for missing required fields', async () => {
      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for weak password (too short)', async () => {
      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, password: 'short' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('at least 8 characters');
      expect(data.code).toBe('WEAK_PASSWORD');
    });

    it('returns 400 for weak password (no numbers)', async () => {
      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, password: 'passwordonly' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('letter and one number');
      expect(data.code).toBe('WEAK_PASSWORD');
    });

    it('returns 400 for invalid username', async () => {
      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, username: 'ab' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_USERNAME');
    });

    it('returns 400 for invalid email format', async () => {
      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, email: 'not-an-email' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid email format');
      expect(data.code).toBe('INVALID_EMAIL');
    });

    it('returns 400 for invalid code', async () => {
      // Create an error with the correct name and code
      const error = new Error('Invalid join code') as any;
      error.name = 'StudentRegistrationError';
      error.code = 'INVALID_CODE';

      mockStudentRegistrationService.registerStudent.mockRejectedValue(error);

      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, code: 'INVALID' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_CODE');
    });

    it('returns 400 when namespace at capacity', async () => {
      // Create a real error with the code property
      const error = new Error('Namespace is at capacity') as any;
      error.name = 'StudentRegistrationError';
      error.code = 'NAMESPACE_AT_CAPACITY';

      mockStudentRegistrationService.registerStudent.mockRejectedValue(error);

      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('student limit');
    });

    it('returns 409 for duplicate email', async () => {
      mockStudentRegistrationService.registerStudent.mockRejectedValue(
        new Error('User with this email already exists')
      );

      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await POST(request);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('already exists');
      expect(data.code).toBe('EMAIL_EXISTS');
    });

    it('creates student user and joins section on success', async () => {
      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();

      // createdAt gets serialized to string in JSON response
      expect(data.user).toEqual({
        id: 'student-123',
        email: 'student@example.com',
        username: 'newstudent',
        role: 'student',
        namespaceId: 'test-namespace',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      expect(data.section).toEqual({
        id: 'section-123',
        name: 'Section A',
        semester: 'Fall 2024',
      });

      expect(mockStudentRegistrationService.registerStudent).toHaveBeenCalledWith(
        'ABC-123-XYZ',
        'student@example.com',
        'Password123',
        'newstudent'
      );
    });

    it('trims whitespace from email and username', async () => {
      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify({
          ...validBody,
          email: '  student@example.com  ',
          username: '  newstudent  ',
        }),
      });
      await POST(request);

      expect(mockStudentRegistrationService.registerStudent).toHaveBeenCalledWith(
        'ABC-123-XYZ',
        'student@example.com',
        'Password123',
        'newstudent'
      );
    });

    it('handles unexpected errors gracefully', async () => {
      mockStudentRegistrationService.registerStudent.mockRejectedValue(
        new Error('Unexpected database error')
      );

      const request = new NextRequest('http://localhost/api/auth/register-student', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Registration failed');
    });
  });
});
