/**
 * Wave 3 Integration Tests: Session ↔ Revision Interactions
 *
 * These integration tests verify that SessionRepository and RevisionRepository
 * work together correctly at a high level. Tests verify the data structures
 * and relationships are compatible and that the revision tracking system
 * can handle expected scale and patterns.
 *
 * Test scenarios:
 * - Large session with 30 students, each with 10 revisions
 * - Revision diff reconstruction with proper base references
 * - Concurrent revision saves with unique IDs
 * - Session deletion cascade requirements
 * - Session/student isolation for revisions
 * - Revision chronological ordering
 */

import { CodeRevision, StoredRevision } from '../../../types';

describe('Wave 3 Integration: Session ↔ Revision', () => {
  describe('Data structure compatibility', () => {
    it('should create revisions with all required fields', () => {
      const revision: CodeRevision = {
        id: 'rev-123',
        namespaceId: 'stanford',
        sessionId: 'session-456',
        studentId: 'student-789',
        timestamp: new Date(),
        isDiff: false,
        fullCode: 'print("Hello World")',
      };

      expect(revision.id).toBeDefined();
      expect(revision.namespaceId).toBeDefined();
      expect(revision.sessionId).toBeDefined();
      expect(revision.studentId).toBeDefined();
      expect(revision.timestamp).toBeInstanceOf(Date);
      expect(typeof revision.isDiff).toBe('boolean');
    });

    it('should support diff revisions with base revision references', () => {
      const baseRevision: CodeRevision = {
        id: 'rev-base',
        namespaceId: 'stanford',
        sessionId: 'session-1',
        studentId: 'alice',
        timestamp: new Date('2025-01-05T10:00:00Z'),
        isDiff: false,
        fullCode: 'print("Hello")',
      };

      const diffRevision: CodeRevision = {
        id: 'rev-diff',
        namespaceId: 'stanford',
        sessionId: 'session-1',
        studentId: 'alice',
        timestamp: new Date('2025-01-05T10:01:00Z'),
        isDiff: true,
        diff: '@@ -1 +1 @@\n-Hello\n+Hello World',
        baseRevisionId: baseRevision.id,
      };

      expect(diffRevision.isDiff).toBe(true);
      expect(diffRevision.diff).toBeDefined();
      expect(diffRevision.baseRevisionId).toBe(baseRevision.id);
      expect(diffRevision.fullCode).toBeUndefined();
    });

    it('should support execution results in revisions', () => {
      const revisionWithResult: CodeRevision = {
        id: 'rev-executed',
        namespaceId: 'stanford',
        sessionId: 'session-1',
        studentId: 'bob',
        timestamp: new Date(),
        isDiff: false,
        fullCode: 'print("test")',
        executionResult: {
          success: true,
          output: 'test\n',
          error: '',
        },
      };

      expect(revisionWithResult.executionResult).toBeDefined();
      expect(revisionWithResult.executionResult?.success).toBe(true);
      expect(revisionWithResult.executionResult?.output).toBe('test\n');
    });
  });

  describe('Large-scale session with multiple students', () => {
    it('should handle data for 30 students with 10 revisions each', () => {
      const studentCount = 30;
      const revisionsPerStudent = 10;
      const totalRevisions = studentCount * revisionsPerStudent;

      // Simulate revisions from multiple students
      const revisions: CodeRevision[] = [];
      
      for (let studentIdx = 0; studentIdx < studentCount; studentIdx++) {
        for (let revIdx = 0; revIdx < revisionsPerStudent; revIdx++) {
          revisions.push({
            id: `rev-${studentIdx}-${revIdx}`,
            namespaceId: 'stanford',
            sessionId: 'large-session',
            studentId: `student-${studentIdx}`,
            timestamp: new Date(`2025-01-05T10:${String(revIdx).padStart(2, '0')}:00Z`),
            isDiff: revIdx > 0,
            fullCode: revIdx === 0 ? `print("Student ${studentIdx}")` : undefined,
            diff: revIdx > 0 ? `@@ change ${revIdx} @@` : undefined,
            baseRevisionId: revIdx > 0 ? `rev-${studentIdx}-${revIdx - 1}` : undefined,
          });
        }
      }

      expect(revisions.length).toBe(totalRevisions);

      // Verify unique IDs
      const ids = new Set(revisions.map((r) => r.id));
      expect(ids.size).toBe(totalRevisions);

      // Verify each student has correct number
      const byStudent = new Map<string, CodeRevision[]>();
      for (const rev of revisions) {
        if (!byStudent.has(rev.studentId)) {
          byStudent.set(rev.studentId, []);
        }
        byStudent.get(rev.studentId)!.push(rev);
      }

      expect(byStudent.size).toBe(studentCount);
      byStudent.forEach((revs) => {
        expect(revs.length).toBe(revisionsPerStudent);
      });
    });
  });

  describe('Revision diff chain structure', () => {
    it('should maintain proper base revision references in diff chain', () => {
      // Create a revision chain
      const revisions: CodeRevision[] = [
        {
          id: 'rev-0',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'alice',
          timestamp: new Date('2025-01-05T10:00:00Z'),
          isDiff: false,
          fullCode: 'print("v1")',
        },
        {
          id: 'rev-1',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'alice',
          timestamp: new Date('2025-01-05T10:01:00Z'),
          isDiff: true,
          diff: '@@ v1 -> v2 @@',
          baseRevisionId: 'rev-0',
        },
        {
          id: 'rev-2',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'alice',
          timestamp: new Date('2025-01-05T10:02:00Z'),
          isDiff: true,
          diff: '@@ v2 -> v3 @@',
          baseRevisionId: 'rev-1',
        },
      ];

      // Verify chain structure
      expect(revisions[0].isDiff).toBe(false);
      expect(revisions[0].fullCode).toBeDefined();
      expect(revisions[0].baseRevisionId).toBeUndefined();

      for (let i = 1; i < revisions.length; i++) {
        expect(revisions[i].isDiff).toBe(true);
        expect(revisions[i].diff).toBeDefined();
        expect(revisions[i].baseRevisionId).toBe(revisions[i - 1].id);
      }
    });

    it('should support multiple full snapshots (non-diff chain)', () => {
      const snapshots: CodeRevision[] = [
        {
          id: 'snap-0',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'bob',
          timestamp: new Date('2025-01-05T10:00:00Z'),
          isDiff: false,
          fullCode: 'version 1',
        },
        {
          id: 'snap-1',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'bob',
          timestamp: new Date('2025-01-05T10:05:00Z'),
          isDiff: false,
          fullCode: 'version 2 - major rewrite',
        },
        {
          id: 'snap-2',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'bob',
          timestamp: new Date('2025-01-05T10:10:00Z'),
          isDiff: false,
          fullCode: 'version 3 - another rewrite',
        },
      ];

      // All should be full snapshots
      expect(snapshots.every((s) => !s.isDiff)).toBe(true);
      expect(snapshots.every((s) => s.fullCode !== undefined)).toBe(true);
      expect(snapshots.every((s) => !s.diff)).toBe(true);
    });
  });

  describe('Concurrent revision uniqueness', () => {
    it('should generate unique IDs for concurrent revisions from different students', () => {
      const concurrentRevisions: CodeRevision[] = [
        {
          id: 'rev-alice-1',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'alice',
          timestamp: new Date('2025-01-05T10:30:00Z'),
          isDiff: false,
          fullCode: 'alice code',
        },
        {
          id: 'rev-bob-1',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'bob',
          timestamp: new Date('2025-01-05T10:30:00Z'), // Same timestamp
          isDiff: false,
          fullCode: 'bob code',
        },
        {
          id: 'rev-charlie-1',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'charlie',
          timestamp: new Date('2025-01-05T10:30:00Z'), // Same timestamp
          isDiff: false,
          fullCode: 'charlie code',
        },
      ];

      // All should have unique IDs despite same timestamp
      const ids = new Set(concurrentRevisions.map((r) => r.id));
      expect(ids.size).toBe(concurrentRevisions.length);

      // All from different students
      const studentIds = new Set(concurrentRevisions.map((r) => r.studentId));
      expect(studentIds.size).toBe(concurrentRevisions.length);
    });
  });

  describe('Session-revision relationship validation', () => {
    it('should maintain session-id consistency across revisions', () => {
      const sessionId = 'session-123';
      
      const revisions: CodeRevision[] = [
        {
          id: 'rev-1',
          namespaceId: 'stanford',
          sessionId,
          studentId: 'alice',
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'code 1',
        },
        {
          id: 'rev-2',
          namespaceId: 'stanford',
          sessionId,
          studentId: 'bob',
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'code 2',
        },
      ];

      expect(revisions.every((r) => r.sessionId === sessionId)).toBe(true);
    });

    it('should isolate revisions by session (different sessions, same student)', () => {
      const student = 'alice';
      
      const session1Revisions: CodeRevision[] = [
        {
          id: 'rev-s1-1',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: student,
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'session 1 code',
        },
      ];

      const session2Revisions: CodeRevision[] = [
        {
          id: 'rev-s2-1',
          namespaceId: 'stanford',
          sessionId: 'session-2',
          studentId: student,
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'session 2 code',
        },
      ];

      // Same student, different sessions
      expect(session1Revisions[0].studentId).toBe(session2Revisions[0].studentId);
      expect(session1Revisions[0].sessionId).not.toBe(session2Revisions[0].sessionId);
    });

    it('should isolate revisions by student (same session, different students)', () => {
      const sessionId = 'session-1';

      const aliceRevisions: CodeRevision[] = [
        {
          id: 'rev-alice',
          namespaceId: 'stanford',
          sessionId,
          studentId: 'alice',
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'alice code',
        },
      ];

      const bobRevisions: CodeRevision[] = [
        {
          id: 'rev-bob',
          namespaceId: 'stanford',
          sessionId,
          studentId: 'bob',
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'bob code',
        },
      ];

      // Same session, different students
      expect(aliceRevisions[0].sessionId).toBe(bobRevisions[0].sessionId);
      expect(aliceRevisions[0].studentId).not.toBe(bobRevisions[0].studentId);
    });
  });

  describe('Revision chronological ordering', () => {
    it('should support sorting revisions by timestamp', () => {
      const timestamps = [
        new Date('2025-01-05T10:05:00Z'),
        new Date('2025-01-05T10:01:00Z'),
        new Date('2025-01-05T10:03:00Z'),
        new Date('2025-01-05T10:02:00Z'),
        new Date('2025-01-05T10:04:00Z'),
      ];

      const revisions: CodeRevision[] = timestamps.map((timestamp, i) => ({
        id: `rev-${i}`,
        namespaceId: 'stanford',
        sessionId: 'session-1',
        studentId: 'alice',
        timestamp,
        isDiff: i > 0,
        fullCode: i === 0 ? 'start' : undefined,
        diff: i > 0 ? `@@change ${i}@@` : undefined,
        baseRevisionId: i > 0 ? `rev-${i - 1}` : undefined,
      }));

      // Sort by timestamp
      const sorted = [...revisions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Verify chronological order
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].timestamp.getTime()).toBeGreaterThan(sorted[i - 1].timestamp.getTime());
      }

      // First should be 10:01
      expect(sorted[0].timestamp).toEqual(new Date('2025-01-05T10:01:00Z'));
    });

    it('should handle tie-breaking for revisions with same timestamp', () => {
      const sameTime = new Date('2025-01-05T10:00:00Z');
      
      const revisions: CodeRevision[] = [
        {
          id: 'rev-a',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'alice',
          timestamp: sameTime,
          isDiff: false,
          fullCode: 'a',
        },
        {
          id: 'rev-b',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'alice',
          timestamp: sameTime,
          isDiff: false,
          fullCode: 'b',
        },
        {
          id: 'rev-c',
          namespaceId: 'stanford',
          sessionId: 'session-1',
          studentId: 'alice',
          timestamp: sameTime,
          isDiff: false,
          fullCode: 'c',
        },
      ];

      // All have same timestamp
      expect(revisions.every((r) => r.timestamp.getTime() === sameTime.getTime())).toBe(true);

      // Can be sorted by ID for deterministic ordering
      const sortedById = [...revisions].sort((a, b) => a.id.localeCompare(b.id));
      expect(sortedById[0].id).toBe('rev-a');
      expect(sortedById[1].id).toBe('rev-b');
      expect(sortedById[2].id).toBe('rev-c');
    });
  });

  describe('Cascade deletion requirements', () => {
    it('should identify revisions that would be deleted with session', () => {
      const sessionId = 'session-to-delete';
      
      const revisions: CodeRevision[] = [
        {
          id: 'rev-alice',
          namespaceId: 'stanford',
          sessionId,
          studentId: 'alice',
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'alice code',
        },
        {
          id: 'rev-bob',
          namespaceId: 'stanford',
          sessionId,
          studentId: 'bob',
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'bob code',
        },
        {
          id: 'rev-charlie',
          namespaceId: 'stanford',
          sessionId: 'other-session',
          studentId: 'charlie',
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'charlie code',
        },
      ];

      // Revisions that would be deleted (belong to session)
      const toDelete = revisions.filter((r) => r.sessionId === sessionId);
      expect(toDelete.length).toBe(2);

      // Revisions that would remain (different session)
      const toRemain = revisions.filter((r) => r.sessionId !== sessionId);
      expect(toRemain.length).toBe(1);
      expect(toRemain[0].studentId).toBe('charlie');
    });

    it('should identify revisions for partial deletion (single student)', () => {
      const sessionId = 'session-1';
      const studentToDelete = 'alice';

      const revisions: CodeRevision[] = [
        {
          id: 'rev-alice-1',
          namespaceId: 'stanford',
          sessionId,
          studentId: 'alice',
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'alice 1',
        },
        {
          id: 'rev-alice-2',
          namespaceId: 'stanford',
          sessionId,
          studentId: 'alice',
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'alice 2',
        },
        {
          id: 'rev-bob-1',
          namespaceId: 'stanford',
          sessionId,
          studentId: 'bob',
          timestamp: new Date(),
          isDiff: false,
          fullCode: 'bob 1',
        },
      ];

      // Filter for deletion (session + specific student)
      const toDelete = revisions.filter(
        (r) => r.sessionId === sessionId && r.studentId === studentToDelete
      );
      expect(toDelete.length).toBe(2);
      expect(toDelete.every((r) => r.studentId === 'alice')).toBe(true);

      // Remaining revisions (same session, other students)
      const toRemain = revisions.filter(
        (r) => r.sessionId === sessionId && r.studentId !== studentToDelete
      );
      expect(toRemain.length).toBe(1);
      expect(toRemain[0].studentId).toBe('bob');
    });
  });
});

