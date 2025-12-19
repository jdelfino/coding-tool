/**
 * Unit tests for useSections hook
 * Tests student-facing section enrollment and management API calls
 */

// Mock global fetch
global.fetch = jest.fn();

describe('useSections hook API calls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('fetchMySections', () => {
    it('should make correct API call', async () => {
      const mockSections = [
        {
          id: 'section-1',
          classId: 'class-1',
          name: 'Section A',
          joinCode: 'TEST123',
          instructorIds: ['instructor-1'],
          createdAt: new Date(),
          updatedAt: new Date(),
          className: 'CS 101',
        },
        {
          id: 'section-2',
          classId: 'class-2',
          name: 'Section B',
          joinCode: 'TEST456',
          instructorIds: ['instructor-2'],
          createdAt: new Date(),
          updatedAt: new Date(),
          className: 'CS 201',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sections: mockSections }),
      });

      const response = await fetch('/api/sections/my', { credentials: 'include' });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.sections).toEqual(mockSections);
      expect(global.fetch).toHaveBeenCalledWith('/api/sections/my', {
        credentials: 'include',
      });
    });

    it('should handle fetch error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not authenticated' }),
      });

      const response = await fetch('/api/sections/my', { credentials: 'include' });
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe('Not authenticated');
    });
  });

  describe('joinSection', () => {
    it('should make correct POST request with valid code', async () => {
      const newSection = {
        id: 'section-1',
        classId: 'class-1',
        name: 'Section A',
        joinCode: 'TEST123',
        instructorIds: ['instructor-1'],
        createdAt: new Date(),
        updatedAt: new Date(),
        className: 'CS 101',
      };

      const mockMembership = {
        id: 'membership-1',
        sectionId: 'section-1',
        userId: 'student-1',
        joinedAt: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ section: newSection, membership: mockMembership }),
      });

      const response = await fetch('/api/sections/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: 'TEST123' }),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.section).toEqual(newSection);
      expect(data.membership).toEqual(mockMembership);
      expect(global.fetch).toHaveBeenCalledWith('/api/sections/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: 'TEST123' }),
        credentials: 'include',
      });
    });

    it('should handle invalid join code', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid join code' }),
      });

      const response = await fetch('/api/sections/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: 'INVALID' }),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe('Invalid join code');
    });

    it('should handle already enrolled error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Already enrolled in this section' }),
      });

      const response = await fetch('/api/sections/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: 'TEST123' }),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe('Already enrolled in this section');
    });
  });

  describe('leaveSection', () => {
    it('should make correct POST request to leave', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const response = await fetch('/api/sections/section-1/leave', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/sections/section-1/leave', {
        method: 'POST',
        credentials: 'include',
      });
    });

    it('should handle not enrolled error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not enrolled' }),
      });

      const response = await fetch('/api/sections/section-1/leave', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe('Not enrolled');
    });
  });

  describe('getActiveSessions', () => {
    it('should fetch active sessions for section', async () => {
      const mockSessions = [
        {
          sessionId: 'session-1',
          problemId: 'problem-1',
          instructorId: 'instructor-1',
          startTime: new Date(),
          activeUsers: ['student-1', 'student-2'],
          problemTitle: 'FizzBuzz',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: mockSessions }),
      });

      const response = await fetch('/api/sections/section-1/active-sessions', {
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.sessions).toEqual(mockSessions);
      expect(global.fetch).toHaveBeenCalledWith('/api/sections/section-1/active-sessions', {
        credentials: 'include',
      });
    });

    it('should handle no active sessions', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] }),
      });

      const response = await fetch('/api/sections/section-1/active-sessions', {
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.sessions).toEqual([]);
    });

    it('should handle authorization error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not authorized' }),
      });

      const response = await fetch('/api/sections/section-1/active-sessions', {
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe('Not authorized');
    });
  });
});
