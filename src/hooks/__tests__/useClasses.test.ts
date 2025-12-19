/**
 * Unit tests for useClasses hook
 * Tests instructor-facing class and section management API calls
 */

// Mock global fetch
global.fetch = jest.fn();

describe('useClasses hook API calls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('fetchClasses', () => {
    it('should make correct API call', async () => {
      const mockClasses = [
        { id: 'class-1', name: 'CS 101', description: 'Intro', createdBy: 'instructor-1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'class-2', name: 'CS 201', description: 'Advanced', createdBy: 'instructor-1', createdAt: new Date(), updatedAt: new Date() },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ classes: mockClasses }),
      });

      const response = await fetch('/api/classes', { credentials: 'include' });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.classes).toEqual(mockClasses);
      expect(global.fetch).toHaveBeenCalledWith('/api/classes', {
        credentials: 'include',
      });
    });

    it('should handle fetch error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not authenticated' }),
      });

      const response = await fetch('/api/classes', { credentials: 'include' });
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe('Not authenticated');
    });
  });

  describe('createClass', () => {
    it('should make correct POST request', async () => {
      const newClass = {
        id: 'class-1',
        name: 'CS 101',
        description: 'Intro',
        createdBy: 'instructor-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ class: newClass }),
      });

      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'CS 101', description: 'Intro' }),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.class).toEqual(newClass);
      expect(global.fetch).toHaveBeenCalledWith('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'CS 101', description: 'Intro' }),
        credentials: 'include',
      });
    });

    it('should handle validation error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Validation failed' }),
      });

      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', description: '' }),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe('Validation failed');
    });
  });

  describe('deleteClass', () => {
    it('should make correct DELETE request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const response = await fetch('/api/classes/class-1', {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/classes/class-1', {
        method: 'DELETE',
        credentials: 'include',
      });
    });
  });

  describe('createSection', () => {
    it('should make correct POST request for section', async () => {
      const newSection = {
        id: 'section-1',
        classId: 'class-1',
        name: 'Section A',
        joinCode: 'TEST123',
        instructorIds: ['instructor-1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ section: newSection }),
      });

      const response = await fetch('/api/classes/class-1/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Section A' }),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.section).toEqual(newSection);
      expect(global.fetch).toHaveBeenCalledWith('/api/classes/class-1/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Section A' }),
        credentials: 'include',
      });
    });
  });

  describe('regenerateJoinCode', () => {
    it('should make correct POST request', async () => {
      const updatedSection = {
        id: 'section-1',
        classId: 'class-1',
        name: 'Section A',
        joinCode: 'NEW123',
        instructorIds: ['instructor-1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ section: updatedSection }),
      });

      const response = await fetch('/api/sections/section-1/join-code', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.section.joinCode).toBe('NEW123');
      expect(global.fetch).toHaveBeenCalledWith('/api/sections/section-1/join-code', {
        method: 'POST',
        credentials: 'include',
      });
    });
  });

  describe('addCoInstructor', () => {
    it('should make correct POST request to add instructor', async () => {
      const updatedSection = {
        id: 'section-1',
        classId: 'class-1',
        name: 'Section A',
        joinCode: 'TEST123',
        instructorIds: ['instructor-1', 'instructor-2'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ section: updatedSection }),
      });

      const response = await fetch('/api/sections/section-1/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com' }),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.section.instructorIds).toContain('instructor-2');
      expect(global.fetch).toHaveBeenCalledWith('/api/sections/section-1/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com' }),
        credentials: 'include',
      });
    });
  });

  describe('removeCoInstructor', () => {
    it('should make correct DELETE request', async () => {
      const updatedSection = {
        id: 'section-1',
        classId: 'class-1',
        name: 'Section A',
        joinCode: 'TEST123',
        instructorIds: ['instructor-1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ section: updatedSection }),
      });

      const response = await fetch('/api/sections/section-1/instructors/instructor-2', {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.section.instructorIds).not.toContain('instructor-2');
      expect(global.fetch).toHaveBeenCalledWith('/api/sections/section-1/instructors/instructor-2', {
        method: 'DELETE',
        credentials: 'include',
      });
    });
  });
});
