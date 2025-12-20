/**
 * Integration tests for LocalStorage repositories cross-process data reloading
 * 
 * These tests verify that changes made by one repository instance
 * are visible to another instance (simulating cross-process behavior)
 * 
 * Tests: LocalProblemRepository, LocalRevisionRepository, LocalUserRepository
 */

import {
  LocalProblemRepository,
  LocalRevisionRepository,
  LocalUserRepository,
} from '../local-storage';
import { ProblemSpec, CodeRevision } from '../types';
import { User } from '../../auth/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('LocalProblemRepository - Cross-Process Data Reloading', () => {
  let testDir: string;
  let repository1: LocalProblemRepository;
  let repository2: LocalProblemRepository;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'problem-repo-test-'));
    
    const config = { type: 'local' as const, baseDir: testDir };
    repository1 = new LocalProblemRepository(config);
    repository2 = new LocalProblemRepository(config);
    
    await repository1.initialize();
    await repository2.initialize();
  });

  afterEach(async () => {
    await repository1.shutdown();
    await repository2.shutdown();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should see problems created by another repository instance', async () => {
    const problem: ProblemSpec = {
      id: 'problem-123',
      title: 'Test Problem',
      description: 'A test problem for cross-process testing',
      starterCode: 'print("Hello")',
      testCases: [],
    };

    await repository1.saveProblem(problem);

    const retrievedProblem = await repository2.getProblem('problem-123');
    
    expect(retrievedProblem).not.toBeNull();
    expect(retrievedProblem?.id).toBe('problem-123');
    expect(retrievedProblem?.title).toBe('Test Problem');
    expect(retrievedProblem?.description).toBe('A test problem for cross-process testing');
  });

  it('should see problem updates made by another repository instance', async () => {
    const problem: ProblemSpec = {
      id: 'problem-456',
      title: 'Original Title',
      description: 'Original description',
      starterCode: 'print("Hello")',
      testCases: [],
    };

    await repository1.saveProblem(problem);
    await repository1.updateProblem('problem-456', {
      title: 'Updated Title',
      description: 'Updated description',
    });

    const retrievedProblem = await repository2.getProblem('problem-456');
    
    expect(retrievedProblem).not.toBeNull();
    expect(retrievedProblem?.title).toBe('Updated Title');
    expect(retrievedProblem?.description).toBe('Updated description');
  });

  it('should not see deleted problems across repository instances', async () => {
    const problem: ProblemSpec = {
      id: 'problem-delete',
      title: 'To Be Deleted',
      description: 'This problem will be deleted',
      starterCode: '',
      testCases: [],
    };

    await repository1.saveProblem(problem);

    let retrievedProblem = await repository2.getProblem('problem-delete');
    expect(retrievedProblem).not.toBeNull();

    await repository1.deleteProblem('problem-delete');

    retrievedProblem = await repository2.getProblem('problem-delete');
    expect(retrievedProblem).toBeNull();
  });
});

describe('LocalRevisionRepository - Cross-Process Data Reloading', () => {
  let testDir: string;
  let repository1: LocalRevisionRepository;
  let repository2: LocalRevisionRepository;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revision-repo-test-'));
    
    const config = { type: 'local' as const, baseDir: testDir };
    repository1 = new LocalRevisionRepository(config);
    repository2 = new LocalRevisionRepository(config);
    
    await repository1.initialize();
    await repository2.initialize();
  });

  afterEach(async () => {
    await repository1.shutdown();
    await repository2.shutdown();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should see revisions created by another repository instance', async () => {
    const revision: CodeRevision = {
      id: 'rev-123',
      sessionId: 'session-1',
      studentId: 'student-1',
      code: 'print("Hello World")',
      timestamp: new Date(),
    };

    await repository1.saveRevision(revision);

    const revisions = await repository2.getRevisions('session-1', 'student-1');
    
    expect(revisions).toHaveLength(1);
    expect(revisions[0].id).toBe('rev-123');
    expect(revisions[0].code).toBe('print("Hello World")');
  });

  it('should see latest revision across repository instances', async () => {
    const revision1: CodeRevision = {
      id: 'rev-1',
      sessionId: 'session-2',
      studentId: 'student-2',
      code: 'print("First")',
      timestamp: new Date(),
    };

    const revision2: CodeRevision = {
      id: 'rev-2',
      sessionId: 'session-2',
      studentId: 'student-2',
      code: 'print("Second")',
      timestamp: new Date(Date.now() + 1000),
    };

    await repository1.saveRevision(revision1);
    await repository1.saveRevision(revision2);

    const latestRevision = await repository2.getLatestRevision('session-2', 'student-2');
    
    expect(latestRevision).not.toBeNull();
    expect(latestRevision?.id).toBe('rev-2');
    expect(latestRevision?.code).toBe('print("Second")');
  });

  it('should see revision by ID across repository instances', async () => {
    const revision: CodeRevision = {
      id: 'rev-unique',
      sessionId: 'session-3',
      studentId: 'student-3',
      code: 'print("Unique revision")',
      timestamp: new Date(),
    };

    await repository1.saveRevision(revision);

    const retrievedRevision = await repository2.getRevision('rev-unique');
    
    expect(retrievedRevision).not.toBeNull();
    expect(retrievedRevision?.id).toBe('rev-unique');
    expect(retrievedRevision?.code).toBe('print("Unique revision")');
  });

  it('should handle deletion across repository instances', async () => {
    const revision: CodeRevision = {
      id: 'rev-delete',
      sessionId: 'session-4',
      studentId: 'student-4',
      code: 'print("To be deleted")',
      timestamp: new Date(),
    };

    await repository1.saveRevision(revision);

    let revisions = await repository2.getRevisions('session-4', 'student-4');
    expect(revisions).toHaveLength(1);

    await repository1.deleteRevisions('session-4', 'student-4');

    revisions = await repository2.getRevisions('session-4', 'student-4');
    expect(revisions).toHaveLength(0);
  });
});

describe('LocalUserRepository - Cross-Process Data Reloading', () => {
  let testDir: string;
  let repository1: LocalUserRepository;
  let repository2: LocalUserRepository;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'user-repo-test-'));
    
    const config = { type: 'local' as const, baseDir: testDir };
    repository1 = new LocalUserRepository(config);
    repository2 = new LocalUserRepository(config);
    
    await repository1.initialize();
    await repository2.initialize();
  });

  afterEach(async () => {
    await repository1.shutdown();
    await repository2.shutdown();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should see users created by another repository instance', async () => {
    const user: User = {
      id: 'user-123',
      username: 'testuser',
      role: 'student',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    await repository1.saveUser(user);

    const retrievedUser = await repository2.getUser('user-123');
    
    expect(retrievedUser).not.toBeNull();
    expect(retrievedUser?.id).toBe('user-123');
    expect(retrievedUser?.username).toBe('testuser');
    expect(retrievedUser?.role).toBe('student');
  });

  it('should see users by username across repository instances', async () => {
    const user: User = {
      id: 'user-456',
      username: 'anotheruser',
      role: 'instructor',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    await repository1.saveUser(user);

    const retrievedUser = await repository2.getUserByUsername('anotheruser');
    
    expect(retrievedUser).not.toBeNull();
    expect(retrievedUser?.id).toBe('user-456');
    expect(retrievedUser?.username).toBe('anotheruser');
  });

  it('should see user updates made by another repository instance', async () => {
    const user: User = {
      id: 'user-789',
      username: 'updateuser',
      role: 'student',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    await repository1.saveUser(user);
    await repository1.updateUser('user-789', {
      role: 'instructor',
      lastLoginAt: new Date(),
    });

    const retrievedUser = await repository2.getUser('user-789');
    
    expect(retrievedUser).not.toBeNull();
    expect(retrievedUser?.role).toBe('instructor');
  });

  it('should see all users in listUsers across repository instances', async () => {
    await repository1.saveUser({
      id: 'user-1',
      username: 'student1',
      role: 'student',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    await repository1.saveUser({
      id: 'user-2',
      username: 'instructor1',
      role: 'instructor',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    await repository1.saveUser({
      id: 'user-3',
      username: 'student2',
      role: 'student',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    const allUsers = await repository2.listUsers();
    const students = await repository2.listUsers('student');
    const instructors = await repository2.listUsers('instructor');
    
    expect(allUsers).toHaveLength(3);
    expect(students).toHaveLength(2);
    expect(instructors).toHaveLength(1);
  });

  it('should not see deleted users across repository instances', async () => {
    const user: User = {
      id: 'user-delete',
      username: 'deleteuser',
      role: 'student',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    await repository1.saveUser(user);

    let retrievedUser = await repository2.getUser('user-delete');
    expect(retrievedUser).not.toBeNull();

    await repository1.deleteUser('user-delete');

    retrievedUser = await repository2.getUser('user-delete');
    expect(retrievedUser).toBeNull();
  });
});
