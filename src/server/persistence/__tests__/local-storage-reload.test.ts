/**
 * Integration tests for LocalSessionRepository cross-process data reloading
 * 
 * These tests verify that session updates made by one repository instance
 * are visible to another instance (simulating cross-process behavior)
 */

import { LocalSessionRepository } from '../local';
import { Session } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('LocalSessionRepository - Cross-Process Data Reloading', () => {
  let testDir: string;
  let repository1: LocalSessionRepository;
  let repository2: LocalSessionRepository;

  beforeEach(async () => {
    // Create a temporary directory for test data
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-repo-test-'));
    
    // Create two repository instances pointing to the same data directory
    const config = { type: 'local' as const, baseDir: testDir };
    repository1 = new LocalSessionRepository(config);
    repository2 = new LocalSessionRepository(config);
    
    await repository1.initialize();
    await repository2.initialize();
  });

  afterEach(async () => {
    await repository1.shutdown();
    await repository2.shutdown();
    
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should see sessions created by another repository instance', async () => {
    // Repository 1 creates a session
    const session: Session = {
      id: 'session-123',
      joinCode: 'ABC123',
      problem: {
        id: 'problem-1',
        title: 'Test problem',
        authorId: 'instructor-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      students: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: 'instructor-1',
      participants: [],
      status: 'active',
      sectionId: 'section-1',
      sectionName: 'Test Section',
    };
    await repository1.createSession(session);

    // Repository 2 should see the session
    const retrievedSession = await repository2.getSession('session-123');
    
    expect(retrievedSession).not.toBeNull();
    expect(retrievedSession?.id).toBe('session-123');
    expect(retrievedSession?.joinCode).toBe('ABC123');
    expect(retrievedSession?.sectionId).toBe('section-1');
  });

  it('should see session updates made by another repository instance', async () => {
    // Repository 1 creates a session
    const session: Session = {
      id: 'session-456',
      joinCode: 'DEF456',
      problem: {
        id: 'problem-2',
        title: 'Original problem',
        authorId: 'instructor-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      students: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: 'instructor-1',
      participants: [],
      status: 'active',
      sectionId: 'section-1',
      sectionName: 'Test Section',
    };
    await repository1.createSession(session);

    // Repository 1 updates the session
    await repository1.updateSession('session-456', {
      problem: {
        id: 'problem-2',
        title: 'Updated problem',
        authorId: 'instructor-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Repository 2 should see the updated session
    const retrievedSession = await repository2.getSession('session-456');
    
    expect(retrievedSession).not.toBeNull();
    expect(retrievedSession?.problem?.title).toBe('Updated problem');
  });

  it('should see student additions made by another repository instance', async () => {
    // Repository 1 creates a session
    const session: Session = {
      id: 'session-789',
      joinCode: 'GHI789',
      problem: {
        id: 'problem-3',
        title: 'Test problem',
        authorId: 'instructor-3',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      students: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: 'instructor-1',
      participants: [],
      status: 'active',
      sectionId: 'section-1',
      sectionName: 'Test Section',
    };
    await repository1.createSession(session);

    // Repository 1 adds students to the session
    const updatedStudents = new Map([
      ['student-1', { id: 'student-1', name: 'Alice', code: '', lastUpdate: new Date() }],
      ['student-2', { id: 'student-2', name: 'Bob', code: 'print("hello")', lastUpdate: new Date() }],
    ]);
    await repository1.updateSession('session-789', {
      students: updatedStudents,
      participants: ['student-1', 'student-2'],
    });

    // Repository 2 should see the students
    const retrievedSession = await repository2.getSession('session-789');
    
    expect(retrievedSession).not.toBeNull();
    expect(retrievedSession?.students.size).toBe(2);
    expect(retrievedSession?.students.get('student-1')?.name).toBe('Alice');
    expect(retrievedSession?.students.get('student-2')?.name).toBe('Bob');
    expect(retrievedSession?.students.get('student-2')?.code).toBe('print("hello")');
    expect(retrievedSession?.participants).toEqual(['student-1', 'student-2']);
  });

  it('should see session deletions made by another repository instance', async () => {
    // Repository 1 creates a session
    const session: Session = {
      id: 'session-delete',
      joinCode: 'DEL123',
      problem: {
        id: 'problem-4',
        title: 'To be deleted',
        authorId: 'instructor-4',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      students: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: 'instructor-1',
      participants: [],
      status: 'active',
      sectionId: 'section-1',
      sectionName: 'Test Section',
    };
    await repository1.createSession(session);

    // Verify repository 2 can see it
    let retrievedSession = await repository2.getSession('session-delete');
    expect(retrievedSession).not.toBeNull();

    // Repository 1 deletes the session
    await repository1.deleteSession('session-delete');

    // Repository 2 should no longer see it
    retrievedSession = await repository2.getSession('session-delete');
    expect(retrievedSession).toBeNull();
  });

  it('should see all sessions in listAllSessions across repository instances', async () => {
    // Repository 1 creates multiple sessions
    const session1: Session = {
      id: 'session-list-1',
      joinCode: 'LIST01',
      problem: {
        id: 'problem-5',
        title: 'Problem 1',
        authorId: 'instructor-5',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      students: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: 'instructor-1',
      participants: [],
      status: 'active',
      sectionId: 'section-1',
      sectionName: 'Test Section',
    };
    const session2: Session = {
      id: 'session-list-2',
      joinCode: 'LIST02',
      problem: {
        id: 'problem-6',
        title: 'Problem 2',
        authorId: 'instructor-6',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      students: new Map(),
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: 'instructor-1',
      participants: [],
      status: 'active',
      sectionId: 'section-1',
      sectionName: 'Test Section',
    };

    await repository1.createSession(session1);
    await repository1.createSession(session2);

    // Repository 2 should see both sessions
    const sessions = await repository2.listAllSessions();
    
    expect(sessions).toHaveLength(2);
    const ids = sessions.map(s => s.id).sort();
    expect(ids).toEqual(['session-list-1', 'session-list-2']);
  });
});
