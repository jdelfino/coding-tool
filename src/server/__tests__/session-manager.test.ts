/**
 * Unit tests for SessionManager
 * 
 * Comprehensive test coverage for the session lifecycle manager including:
 * - Session creation and join code management
 * - Student operations (add, remove, rejoin)
 * - Problem and code management
 * - Session lifecycle and cleanup
 * - Creator/participant queries
 * - Error handling and edge cases
 */

import { SessionManager } from '../session-manager';
import { FakeStorageBackend } from './test-utils/fake-storage';
import { Session, Student } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid to make tests deterministic
jest.mock('uuid');
const mockUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>;

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let storage: FakeStorageBackend;
  let uuidCounter: number;

  beforeEach(() => {
    // Reset UUID counter for deterministic IDs
    uuidCounter = 0;
    mockUuid.mockImplementation(() => `session-${uuidCounter++}`);

    // Create fresh instances
    storage = new FakeStorageBackend();
    sessionManager = new SessionManager(storage);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Creation', () => {
    it('should create session with auto-generated join code', async () => {
      const session = await sessionManager.createSession();

      expect(session).toBeDefined();
      expect(session.id).toBe('session-0');
      expect(session.joinCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(session.problemText).toBe('');
      expect(session.students).toBeInstanceOf(Map);
      expect(session.students.size).toBe(0);
      expect(session.status).toBe('active');
      expect(session.creatorId).toBe('system');
    });

    it('should create session with custom creator ID', async () => {
      const session = await sessionManager.createSession('instructor-123');

      expect(session.creatorId).toBe('instructor-123');
      expect(session.id).toBe('session-0');
    });

    it('should generate unique join codes (collision handling)', async () => {
      // Mock random to force collision on first attempt
      const originalRandom = Math.random;
      let callCount = 0;
      Math.random = jest.fn(() => {
        // First call returns same value to cause collision
        // Second call returns different value
        return callCount++ < 2 ? 0.5 : 0.7;
      });

      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      expect(session1.joinCode).toBeDefined();
      expect(session2.joinCode).toBeDefined();
      expect(session1.joinCode).not.toBe(session2.joinCode);

      Math.random = originalRandom;
    });

    it('should assign unique session IDs', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      expect(session1.id).toBe('session-0');
      expect(session2.id).toBe('session-1');
      expect(session1.id).not.toBe(session2.id);
    });

    it('should validate initial session state', async () => {
      const session = await sessionManager.createSession('instructor-1');

      expect(session.problemText).toBe('');
      expect(session.participants).toEqual([]);
      expect(session.status).toBe('active');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActivity).toBeInstanceOf(Date);
      expect(session.endedAt).toBeUndefined();
    });

    it('should persist session to storage', async () => {
      const session = await sessionManager.createSession();

      const stored = await storage.sessions.getSession(session.id);
      expect(stored).toBeDefined();
      expect(stored?.id).toBe(session.id);
      expect(stored?.joinCode).toBe(session.joinCode);
    });

    it('should throw error if storage fails during create', async () => {
      // Mock storage to throw error
      storage.sessions.createSession = jest.fn().mockRejectedValue(new Error('Storage error'));

      await expect(sessionManager.createSession()).rejects.toThrow('Storage error');
    });
  });

  describe('Join Code Management', () => {
    it('should generate 6-character uppercase codes', async () => {
      const session = await sessionManager.createSession();

      expect(session.joinCode).toHaveLength(6);
      expect(session.joinCode).toMatch(/^[A-Z0-9]+$/);
    });

    it('should normalize join codes to uppercase', async () => {
      const session = await sessionManager.createSession();
      
      // Test case-insensitive lookup
      const found = await sessionManager.getSessionByJoinCode(session.joinCode.toLowerCase());
      expect(found).toBeDefined();
      expect(found?.id).toBe(session.id);
    });

    it('should find session by join code', async () => {
      const session = await sessionManager.createSession();

      const found = await sessionManager.getSessionByJoinCode(session.joinCode);
      expect(found).toBeDefined();
      expect(found?.id).toBe(session.id);
      expect(found?.joinCode).toBe(session.joinCode);
    });

    it('should return null for non-existent join code', async () => {
      const found = await sessionManager.getSessionByJoinCode('INVALID');
      expect(found).toBeNull();
    });

    it('should handle case-insensitive join code lookup', async () => {
      const session = await sessionManager.createSession();
      const lowerCode = session.joinCode.toLowerCase();
      const mixedCode = session.joinCode.split('').map((c, i) => 
        i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
      ).join('');

      const found1 = await sessionManager.getSessionByJoinCode(lowerCode);
      const found2 = await sessionManager.getSessionByJoinCode(mixedCode);

      expect(found1?.id).toBe(session.id);
      expect(found2?.id).toBe(session.id);
    });
  });

  describe('Student Operations', () => {
    let session: Session;

    beforeEach(async () => {
      session = await sessionManager.createSession('instructor-1');
    });

    it('should add student to session', async () => {
      const result = await sessionManager.addStudent(session.id, 'student-1', 'Alice');

      expect(result).toBe(true);

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.students.has('student-1')).toBe(true);
      expect(updated?.students.get('student-1')?.name).toBe('Alice');
    });

    it('should preserve student code when rejoining', async () => {
      // First join
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("hello")');

      // Rejoin (simulate disconnect and reconnect)
      await sessionManager.removeStudent(session.id, 'student-1');
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');

      const code = await sessionManager.getStudentCode(session.id, 'student-1');
      expect(code).toBe('print("hello")');
    });

    it('should add student to participants list', async () => {
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.participants).toContain('student-1');
    });

    it('should not duplicate student in participants', async () => {
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.participants.filter(p => p === 'student-1').length).toBe(1);
    });

    it('should remove student while preserving code', async () => {
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("test")');

      const result = await sessionManager.removeStudent(session.id, 'student-1');
      expect(result).toBe(true);

      // Code should still be accessible
      const code = await sessionManager.getStudentCode(session.id, 'student-1');
      expect(code).toBe('print("test")');
    });

    it('should handle multiple students in same session', async () => {
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');
      await sessionManager.addStudent(session.id, 'student-2', 'Bob');
      await sessionManager.addStudent(session.id, 'student-3', 'Charlie');

      const students = await sessionManager.getStudents(session.id);
      expect(students).toHaveLength(3);
      expect(students.map(s => s.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should return false when removing non-existent student', async () => {
      const result = await sessionManager.removeStudent(session.id, 'non-existent');
      expect(result).toBe(false);
    });

    it('should return false when adding to non-existent session', async () => {
      const result = await sessionManager.addStudent('invalid-session', 'student-1', 'Alice');
      expect(result).toBe(false);
    });

    it('should update student last update time', async () => {
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');
      
      const updated = await sessionManager.getSession(session.id);
      const student = updated?.students.get('student-1');
      expect(student?.lastUpdate).toBeInstanceOf(Date);
    });
  });

  describe('Problem Management', () => {
    let session: Session;

    beforeEach(async () => {
      session = await sessionManager.createSession();
    });

    it('should update problem text', async () => {
      const problemText = 'Write a function to reverse a string';
      const result = await sessionManager.updateProblem(session.id, problemText);

      expect(result).toBe(true);

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.problemText).toBe(problemText);
    });

    it('should clear problem text', async () => {
      await sessionManager.updateProblem(session.id, 'Some problem');
      await sessionManager.updateProblem(session.id, '');

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.problemText).toBe('');
    });

    it('should persist problem updates', async () => {
      const problemText = 'Calculate factorial';
      await sessionManager.updateProblem(session.id, problemText);

      const stored = await storage.sessions.getSession(session.id);
      expect(stored?.problemText).toBe(problemText);
    });

    it('should update last activity on problem change', async () => {
      const before = session.lastActivity;
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await sessionManager.updateProblem(session.id, 'New problem');

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.lastActivity.getTime()).toBeGreaterThan(before.getTime());
    });

    it('should succeed even for non-existent session (no existence check)', async () => {
      // Note: updateProblem doesn't validate session existence, just attempts update
      const result = await sessionManager.updateProblem('invalid-id', 'Problem');
      expect(result).toBe(true);
    });
  });

  describe('Code Management', () => {
    let session: Session;

    beforeEach(async () => {
      session = await sessionManager.createSession();
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');
    });

    it('should save student code', async () => {
      const code = 'def hello():\n    print("Hello")';
      const result = await sessionManager.updateStudentCode(session.id, 'student-1', code);

      expect(result).toBe(true);

      const saved = await sessionManager.getStudentCode(session.id, 'student-1');
      expect(saved).toBe(code);
    });

    it('should retrieve student code', async () => {
      const code = 'x = 42';
      await sessionManager.updateStudentCode(session.id, 'student-1', code);

      const retrieved = await sessionManager.getStudentCode(session.id, 'student-1');
      expect(retrieved).toBe(code);
    });

    it('should persist code across rejoin', async () => {
      await sessionManager.updateStudentCode(session.id, 'student-1', 'original code');
      await sessionManager.removeStudent(session.id, 'student-1');
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');

      const code = await sessionManager.getStudentCode(session.id, 'student-1');
      expect(code).toBe('original code');
    });

    it('should handle empty code', async () => {
      await sessionManager.updateStudentCode(session.id, 'student-1', '');

      const code = await sessionManager.getStudentCode(session.id, 'student-1');
      expect(code).toBe('');
    });

    it('should maintain independent code for multiple students', async () => {
      await sessionManager.addStudent(session.id, 'student-2', 'Bob');

      await sessionManager.updateStudentCode(session.id, 'student-1', 'code for alice');
      await sessionManager.updateStudentCode(session.id, 'student-2', 'code for bob');

      const code1 = await sessionManager.getStudentCode(session.id, 'student-1');
      const code2 = await sessionManager.getStudentCode(session.id, 'student-2');

      expect(code1).toBe('code for alice');
      expect(code2).toBe('code for bob');
    });

    it('should update code timestamp', async () => {
      await sessionManager.updateStudentCode(session.id, 'student-1', 'code v1');
      
      const updated = await sessionManager.getSession(session.id);
      const student = updated?.students.get('student-1');
      const timestamp1 = student?.lastUpdate;

      await new Promise(resolve => setTimeout(resolve, 10));
      await sessionManager.updateStudentCode(session.id, 'student-1', 'code v2');

      const updated2 = await sessionManager.getSession(session.id);
      const student2 = updated2?.students.get('student-1');
      const timestamp2 = student2?.lastUpdate;

      expect(timestamp2!.getTime()).toBeGreaterThan(timestamp1!.getTime());
    });

    it('should return undefined for non-existent student', async () => {
      const code = await sessionManager.getStudentCode(session.id, 'non-existent');
      expect(code).toBeUndefined();
    });

    it('should return false when updating code for non-existent student', async () => {
      const result = await sessionManager.updateStudentCode(session.id, 'non-existent', 'code');
      expect(result).toBe(false);
    });
  });

  describe('Session Lifecycle', () => {
    it('should list all sessions', async () => {
      await sessionManager.createSession('instructor-1');
      await sessionManager.createSession('instructor-2');
      await sessionManager.createSession('instructor-1');

      const sessions = await sessionManager.listSessions();
      expect(sessions).toHaveLength(3);
    });

    it('should get session by ID', async () => {
      const session = await sessionManager.createSession();

      const found = await sessionManager.getSession(session.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(session.id);
    });

    it('should return null for non-existent session', async () => {
      const found = await sessionManager.getSession('non-existent-id');
      expect(found).toBeNull();
    });

    it('should delete session and cleanup', async () => {
      const session = await sessionManager.createSession();
      
      const result = await sessionManager.deleteSession(session.id);
      expect(result).toBe(true);

      const found = await sessionManager.getSession(session.id);
      expect(found).toBeNull();
    });

    it('should remove join code index on delete', async () => {
      const session = await sessionManager.createSession();
      const joinCode = session.joinCode;

      await sessionManager.deleteSession(session.id);

      const found = await sessionManager.getSessionByJoinCode(joinCode);
      expect(found).toBeNull();
    });

    it('should track active vs inactive sessions', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      await sessionManager.endSession(session1.id);

      const updated1 = await sessionManager.getSession(session1.id);
      const updated2 = await sessionManager.getSession(session2.id);

      expect(updated1?.status).toBe('completed');
      expect(updated2?.status).toBe('active');
    });

    it('should update last activity timestamp', async () => {
      const session = await sessionManager.createSession();
      const initialActivity = session.lastActivity;

      await new Promise(resolve => setTimeout(resolve, 10));
      await sessionManager.updateProblem(session.id, 'New problem');

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.lastActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
    });

    it('should return session count', async () => {
      await sessionManager.createSession();
      await sessionManager.createSession();

      const count = await sessionManager.getSessionCount();
      expect(count).toBe(2);
    });

    it('should return 0 count when no sessions', async () => {
      const count = await sessionManager.getSessionCount();
      expect(count).toBe(0);
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup old sessions (>24h)', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      // Manually set old lastActivity (25 hours ago)
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await storage.sessions.updateSession(session1.id, { lastActivity: oldDate });

      const cleaned = await sessionManager.cleanupOldSessions();

      expect(cleaned).toBe(1);
      expect(await sessionManager.getSession(session1.id)).toBeNull();
      expect(await sessionManager.getSession(session2.id)).toBeDefined();
    });

    it('should not cleanup recent sessions', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      const cleaned = await sessionManager.cleanupOldSessions();

      expect(cleaned).toBe(0);
      expect(await sessionManager.getSession(session1.id)).toBeDefined();
      expect(await sessionManager.getSession(session2.id)).toBeDefined();
    });

    it('should handle batch cleanup performance', async () => {
      // Create multiple old sessions
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      
      for (let i = 0; i < 10; i++) {
        const session = await sessionManager.createSession();
        await storage.sessions.updateSession(session.id, { lastActivity: oldDate });
      }

      const cleaned = await sessionManager.cleanupOldSessions();
      expect(cleaned).toBe(10);

      const count = await sessionManager.getSessionCount();
      expect(count).toBe(0);
    });

    it('should return 0 when no old sessions to clean', async () => {
      const cleaned = await sessionManager.cleanupOldSessions();
      expect(cleaned).toBe(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      const session = await sessionManager.createSession();
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await storage.sessions.updateSession(session.id, { lastActivity: oldDate });

      // Mock deleteSession to return false (simulating failure)
      const originalDelete = sessionManager.deleteSession.bind(sessionManager);
      sessionManager.deleteSession = jest.fn().mockResolvedValue(false);

      const cleaned = await sessionManager.cleanupOldSessions();

      // Should still count as cleaned even if delete returns false
      // (the implementation counts iterations, not successful deletes)
      expect(cleaned).toBe(1);

      sessionManager.deleteSession = originalDelete;
    });
  });

  describe('Creator/Participant Queries', () => {
    it('should get sessions by creator', async () => {
      await sessionManager.createSession('instructor-1');
      await sessionManager.createSession('instructor-2');
      await sessionManager.createSession('instructor-1');

      const sessions = await sessionManager.getSessionsByCreator('instructor-1');
      expect(sessions).toHaveLength(2);
      expect(sessions.every(s => s.creatorId === 'instructor-1')).toBe(true);
    });

    it('should get sessions by participant', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();
      const session3 = await sessionManager.createSession();

      await sessionManager.addStudent(session1.id, 'student-1', 'Alice');
      await sessionManager.addStudent(session3.id, 'student-1', 'Alice');

      const sessions = await sessionManager.getSessionsByParticipant('student-1');
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toContain(session1.id);
      expect(sessions.map(s => s.id)).toContain(session3.id);
    });

    it('should return empty array when no sessions for creator', async () => {
      const sessions = await sessionManager.getSessionsByCreator('non-existent');
      expect(sessions).toEqual([]);
    });

    it('should return empty array when no sessions for participant', async () => {
      const sessions = await sessionManager.getSessionsByParticipant('non-existent');
      expect(sessions).toEqual([]);
    });

    it('should handle multiple sessions per creator', async () => {
      for (let i = 0; i < 5; i++) {
        await sessionManager.createSession('instructor-1');
      }

      const sessions = await sessionManager.getSessionsByCreator('instructor-1');
      expect(sessions).toHaveLength(5);
    });

    it('should handle creator and participant overlap', async () => {
      const session1 = await sessionManager.createSession('user-1');
      const session2 = await sessionManager.createSession('user-2');
      
      await sessionManager.addStudent(session2.id, 'user-1', 'User 1');

      const asCreator = await sessionManager.getSessionsByCreator('user-1');
      const asParticipant = await sessionManager.getSessionsByParticipant('user-1');

      expect(asCreator).toHaveLength(1);
      expect(asParticipant).toHaveLength(1);
      expect(asCreator[0].id).toBe(session1.id);
      expect(asParticipant[0].id).toBe(session2.id);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors during create', async () => {
      storage.sessions.createSession = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(sessionManager.createSession()).rejects.toThrow('DB error');
    });

    it('should handle storage errors during update', async () => {
      const session = await sessionManager.createSession();
      
      storage.sessions.updateSession = jest.fn().mockRejectedValue(new Error('Update failed'));

      const result = await sessionManager.updateProblem(session.id, 'New problem');
      expect(result).toBe(false);
    });

    it('should handle missing session gracefully', async () => {
      // Note: updateProblem doesn't validate session existence
      const result = await sessionManager.updateProblem('invalid-id', 'Problem');
      expect(result).toBe(true);
    });

    it('should handle invalid session IDs', async () => {
      const session = await sessionManager.getSession('');
      expect(session).toBeNull();
    });

    it('should handle concurrent operations', async () => {
      const session = await sessionManager.createSession();

      // Concurrent student additions
      await Promise.all([
        sessionManager.addStudent(session.id, 'student-1', 'Alice'),
        sessionManager.addStudent(session.id, 'student-2', 'Bob'),
        sessionManager.addStudent(session.id, 'student-3', 'Charlie'),
      ]);

      const students = await sessionManager.getStudents(session.id);
      expect(students).toHaveLength(3);
    });
  });

  describe('Storage Integration', () => {
    it('should persist session on create', async () => {
      const session = await sessionManager.createSession();

      const stored = await storage.sessions.getSession(session.id);
      expect(stored).toBeDefined();
      expect(stored?.id).toBe(session.id);
    });

    it('should persist updates to storage', async () => {
      const session = await sessionManager.createSession();
      await sessionManager.updateProblem(session.id, 'Test problem');

      const stored = await storage.sessions.getSession(session.id);
      expect(stored?.problemText).toBe('Test problem');
    });

    it('should load sessions on initialize', async () => {
      // Create sessions
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      // Create new manager instance
      const newManager = new SessionManager(storage);
      await newManager.initialize();

      // Should be able to find sessions by join code
      const found1 = await newManager.getSessionByJoinCode(session1.joinCode);
      const found2 = await newManager.getSessionByJoinCode(session2.joinCode);

      expect(found1?.id).toBe(session1.id);
      expect(found2?.id).toBe(session2.id);
    });

    it('should rebuild join code index on initialize', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      // Create new manager and initialize
      const newManager = new SessionManager(storage);
      await newManager.initialize();

      // Join code index should work
      const found = await newManager.getSessionByJoinCode(session1.joinCode);
      expect(found?.id).toBe(session1.id);
    });

    it('should auto-initialize storage when needed', async () => {
      // Create manager without storage
      const managerWithoutStorage = new SessionManager();

      // This should auto-initialize storage
      const sessions = await managerWithoutStorage.getSessionsByCreator('test');
      expect(sessions).toEqual([]);
    });

    it('should handle initialization errors', async () => {
      storage.sessions.listAllSessions = jest.fn().mockRejectedValue(new Error('Load failed'));

      await expect(sessionManager.initialize()).rejects.toThrow('Load failed');
    });
  });

  describe('Featured Submission', () => {
    let session: Session;

    beforeEach(async () => {
      session = await sessionManager.createSession();
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("featured")');
    });

    it('should set featured submission', async () => {
      const result = await sessionManager.setFeaturedSubmission(session.id, 'student-1');
      expect(result).toBe(true);

      const featured = await sessionManager.getFeaturedSubmission(session.id);
      expect(featured.studentId).toBe('student-1');
      expect(featured.code).toBe('print("featured")');
    });

    it('should clear featured submission', async () => {
      await sessionManager.setFeaturedSubmission(session.id, 'student-1');
      await sessionManager.clearFeaturedSubmission(session.id);

      const featured = await sessionManager.getFeaturedSubmission(session.id);
      expect(featured.studentId).toBeUndefined();
      expect(featured.code).toBeUndefined();
    });

    it('should update featured code', async () => {
      await sessionManager.setFeaturedSubmission(session.id, 'student-1');
      await sessionManager.updateFeaturedCode(session.id, 'print("edited")');

      const featured = await sessionManager.getFeaturedSubmission(session.id);
      expect(featured.code).toBe('print("edited")');
    });

    it('should return false when setting featured for non-existent student', async () => {
      const result = await sessionManager.setFeaturedSubmission(session.id, 'non-existent');
      expect(result).toBe(false);
    });

    it('should return empty object for session without featured submission', async () => {
      const featured = await sessionManager.getFeaturedSubmission(session.id);
      expect(featured).toEqual({});
    });
  });

  describe('End Session', () => {
    it('should end session and set status to completed', async () => {
      const session = await sessionManager.createSession();
      
      const result = await sessionManager.endSession(session.id);
      expect(result).toBe(true);

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.endedAt).toBeInstanceOf(Date);
    });

    it('should return false for non-existent session', async () => {
      const result = await sessionManager.endSession('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long problem text', async () => {
      const session = await sessionManager.createSession();
      const longText = 'x'.repeat(10000);

      await sessionManager.updateProblem(session.id, longText);

      const updated = await sessionManager.getSession(session.id);
      expect(updated?.problemText).toBe(longText);
    });

    it('should handle special characters in student names', async () => {
      const session = await sessionManager.createSession();
      const specialName = "O'Brien <script>alert('xss')</script>";

      await sessionManager.addStudent(session.id, 'student-1', specialName);

      const students = await sessionManager.getStudents(session.id);
      expect(students[0].name).toBe(specialName);
    });

    it('should handle empty student name', async () => {
      const session = await sessionManager.createSession();

      await sessionManager.addStudent(session.id, 'student-1', '');

      const students = await sessionManager.getStudents(session.id);
      expect(students[0].name).toBe('');
    });

    it('should handle null/undefined values gracefully', async () => {
      const session = await sessionManager.createSession();

      // These should not throw
      await sessionManager.updateProblem(session.id, '');
      await sessionManager.updateStudentCode(session.id, 'student-1', '');
    });

    it('should handle operations without storage (backward compatibility)', async () => {
      const managerNoStorage = new SessionManager();

      // Operations should return false/empty without storage
      const result = await managerNoStorage.updateProblem('id', 'text');
      expect(result).toBe(false);

      const sessions = await managerNoStorage.listSessions();
      expect(sessions).toEqual([]);
    });

    it('should handle storage failures mid-operation', async () => {
      const session = await sessionManager.createSession();
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');

      // Mock storage to fail on next update
      storage.sessions.updateSession = jest.fn().mockRejectedValue(new Error('Storage full'));

      const result = await sessionManager.updateStudentCode(session.id, 'student-1', 'code');
      expect(result).toBe(false);
    });
  });
});
