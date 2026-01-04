/**
 * Tests for student execution settings in WebSocket messages
 * 
 * Regression tests for bugs where student execution settings (randomSeed,
 * attachedFiles) were not included in WebSocket messages to instructors.
 * 
 * These tests verify that:
 * 1. STUDENT_LIST_UPDATE includes randomSeed and attachedFiles
 * 2. STUDENT_CODE response includes execution settings
 * 3. Student settings are properly retrieved via getStudentData
 */

import { SessionManager } from '../session-manager';
import { FakeStorageBackend } from './test-utils/fake-storage';
import { Problem } from '../types/problem';

// Helper to create test Problem objects
function createTestProblem(overrides?: Partial<Problem>): Problem {
  return {
    id: 'test-problem-1',
    namespaceId: 'default',
    title: 'Test Problem',
    description: 'Write a function to solve this problem',
    authorId: 'test-instructor',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

describe('WebSocket Student Settings Messages', () => {
  let sessionManager: SessionManager;
  let storage: FakeStorageBackend;

  beforeEach(() => {
    storage = new FakeStorageBackend();
    sessionManager = new SessionManager(storage);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Student data retrieval', () => {
    it('should include randomSeed and attachedFiles in getStudentData', async () => {
      // Create session and add student
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');

      // Set student's execution settings
      const randomSeed = 42;
      const attachedFiles = [
        { name: 'data.txt', content: 'test data' },
        { name: 'config.json', content: '{"key": "value"}' }
      ];
      await sessionManager.updateStudentSettings(session.id, 'student-1', { randomSeed, attachedFiles });

      // Update student code
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("hello")');

      // Get student data (this is what handleRequestStudentCode uses)
      const studentData = await sessionManager.getStudentData(session.id, 'student-1');

      // Verify all fields are present
      expect(studentData).toBeDefined();
      expect(studentData?.code).toBe('print("hello")');
      expect(studentData?.executionSettings?.randomSeed).toBe(42);
      expect(studentData?.executionSettings?.attachedFiles).toEqual(attachedFiles);
    });

    it('should handle student with no execution settings', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("hello")');

      const studentData = await sessionManager.getStudentData(session.id, 'student-1');

      expect(studentData).toBeDefined();
      expect(studentData?.code).toBe('print("hello")');
      expect(studentData?.executionSettings?.randomSeed).toBeUndefined();
      expect(studentData?.executionSettings?.attachedFiles).toBeUndefined();
    });

    it('should return undefined for non-existent student', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');

      const studentData = await sessionManager.getStudentData(session.id, 'non-existent');

      expect(studentData).toBeUndefined();
    });

    it('should return undefined for non-existent session', async () => {
      const studentData = await sessionManager.getStudentData('non-existent-session', 'student-1');

      expect(studentData).toBeUndefined();
    });

    it('should return session defaults when student has not modified execution settings', async () => {
      // Bug: When student joins but doesn't modify execution settings,
      // instructor viewing their code should see session defaults, not undefined

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Set session-level execution settings
      const sessionSeed = 999;
      const sessionFiles = [
        { name: 'session_data.txt', content: 'session default data' }
      ];
      await sessionManager.updateSessionProblem(
        session.id,
        createTestProblem({ description: 'Problem with defaults' }),
        { stdin: 'example input', randomSeed: sessionSeed, attachedFiles: sessionFiles }
      );

      // Student joins and writes code but doesn't modify execution settings
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("using defaults")');

      // Instructor views student code - should see session defaults
      const studentData = await sessionManager.getStudentData(session.id, 'student-1');

      expect(studentData).toBeDefined();
      expect(studentData?.code).toBe('print("using defaults")');
      expect(studentData?.executionSettings?.randomSeed).toBe(sessionSeed); // Should get session default
      expect(studentData?.executionSettings?.attachedFiles).toEqual(sessionFiles); // Should get session default
    });

    it('should return student overrides when student has modified execution settings', async () => {
      // Student can override session defaults with their own values

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Set session-level defaults
      await sessionManager.updateSessionProblem(
        session.id,
        createTestProblem({ description: 'Problem' }),
        { stdin: 'example', randomSeed: 100, attachedFiles: [{ name: 'session.txt', content: 'session file' }] }
      );

      // Student joins
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      
      // Student sets their own execution settings (overrides)
      const studentSeed = 42;
      const studentFiles = [{ name: 'student.txt', content: 'student file' }];
      await sessionManager.updateStudentSettings(session.id, 'student-1', { randomSeed: studentSeed, attachedFiles: studentFiles });
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("overridden")');

      // Instructor views student code - should see student's overrides
      const studentData = await sessionManager.getStudentData(session.id, 'student-1');

      expect(studentData).toBeDefined();
      expect(studentData?.executionSettings?.randomSeed).toBe(studentSeed); // Student override, not session default
      expect(studentData?.executionSettings?.attachedFiles).toEqual(studentFiles); // Student override, not session default
    });

    it('should handle mix of session defaults and student overrides', async () => {
      // Student can override just seed or just files, not necessarily both

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Set session defaults for both seed and files
      await sessionManager.updateSessionProblem(
        session.id,
        createTestProblem({ description: 'Problem' }),
        { stdin: 'example', randomSeed: 200, attachedFiles: [{ name: 'default.txt', content: 'default' }] }
      );

      // Student joins and only overrides seed, not files
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentSettings(
        session.id, 
        'student-1', 
        { randomSeed: 777 } // override seed only
      );
      await sessionManager.updateStudentCode(session.id, 'student-1', 'code');

      const studentData = await sessionManager.getStudentData(session.id, 'student-1');

      expect(studentData?.executionSettings?.randomSeed).toBe(777); // Student override
      expect(studentData?.executionSettings?.attachedFiles).toEqual([{ name: 'default.txt', content: 'default' }]); // Session default
    });



    it('should treat empty attachedFiles array as explicit override (no files)', async () => {
      // If student sets attachedFiles = [], it should mean "no files" (not fallback)
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      // Set session defaults
      const sessionFiles = [{ name: 'session.txt', content: 'session file' }];
      await sessionManager.updateSessionProblem(
        session.id,
        createTestProblem({ description: 'Problem' }),
        { stdin: 'input', randomSeed: 100, attachedFiles: sessionFiles }
      );
      // Student joins
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      // Student explicitly sets empty array (removes all files)
      await sessionManager.updateStudentSettings(
        session.id,
        'student-1',
        { attachedFiles: [] } // Empty array - student removed all files
      );
      await sessionManager.updateStudentCode(session.id, 'student-1', 'code');
      const studentData = await sessionManager.getStudentData(session.id, 'student-1');
      // Should be empty array, not session default
      expect(studentData?.executionSettings?.attachedFiles).toEqual([]);
    });

    it('should handle empty session defaults correctly', async () => {
      // When session has no execution settings and student hasn't set any

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Don't set session execution settings (undefined/empty)
      
      // Student joins without setting execution settings
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'code');

      const studentData = await sessionManager.getStudentData(session.id, 'student-1');

      expect(studentData).toBeDefined();
      expect(studentData?.code).toBe('code');
      expect(studentData?.executionSettings?.randomSeed).toBeUndefined(); // Both session and student are undefined
      expect(studentData?.executionSettings?.attachedFiles).toBeUndefined(); // Both session and student are undefined
    });

    it('should return session defaults in STUDENT_CODE scenario (instructor viewing student)', async () => {
      // Regression: When instructor clicks "View Code" on a student who hasn't
      // modified their execution settings, the instructor should see session defaults

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Instructor sets session defaults
      const sessionSeed = 777;
      const sessionFiles = [
        { name: 'default_data.txt', content: 'default content' }
      ];
      await sessionManager.updateSessionProblem(
        session.id,
        createTestProblem({ description: 'Problem text' }),
        { stdin: 'example: 5', randomSeed: sessionSeed, attachedFiles: sessionFiles }
      );

      // Student joins and writes code but doesn't modify execution settings
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'student_code');

      // Instructor requests student code (simulating REQUEST_STUDENT_CODE)
      const studentData = await sessionManager.getStudentData(session.id, 'student-1');

      // This data gets sent in STUDENT_CODE message
      expect(studentData?.code).toBe('student_code');
      expect(studentData?.executionSettings?.randomSeed).toBe(sessionSeed); // Should see session default
      expect(studentData?.executionSettings?.attachedFiles).toEqual(sessionFiles); // Should see session default
    });
  });

  describe('Student list with execution settings', () => {
    it('should include randomSeed and attachedFiles for students in list', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Add multiple students with different settings
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');
      await sessionManager.updateStudentSettings(session.id, 'student-1', { 
        randomSeed: 42,
        attachedFiles: [{ name: 'data1.txt', content: 'content1' }]
      });

      await sessionManager.addStudent(session.id, 'student-2', 'Bob');
      await sessionManager.updateStudentSettings(session.id, 'student-2', {
        randomSeed: 99,
        attachedFiles: [{ name: 'data2.txt', content: 'content2' }]
      });

      await sessionManager.addStudent(session.id, 'student-3', 'Charlie');
      // student-3 has no custom settings

      // Get all students (this simulates what broadcastStudentList uses)
      const students = await sessionManager.getStudents(session.id);

      expect(students).toHaveLength(3);

      // Verify student 1 has settings
      const student1 = students.find(s => s.id === 'student-1');
      expect(student1?.executionSettings?.randomSeed).toBe(42);
      expect(student1?.executionSettings?.attachedFiles).toEqual([{ name: 'data1.txt', content: 'content1' }]);

      // Verify student 2 has different settings
      const student2 = students.find(s => s.id === 'student-2');
      expect(student2?.executionSettings?.randomSeed).toBe(99);
      expect(student2?.executionSettings?.attachedFiles).toEqual([{ name: 'data2.txt', content: 'content2' }]);

      // Verify student 3 has no settings
      const student3 = students.find(s => s.id === 'student-3');
      expect(student3?.executionSettings?.randomSeed).toBeUndefined();
      expect(student3?.executionSettings?.attachedFiles).toBeUndefined();
    });

    it('should include session defaults in student list when students have not modified settings', async () => {
      // Regression: STUDENT_LIST_UPDATE message should show session defaults
      // for students who haven't modified their execution settings

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Set session defaults
      const sessionSeed = 555;
      const sessionFiles = [
        { name: 'session_default.txt', content: 'default for all' }
      ];
      await sessionManager.updateSessionProblem(
        session.id,
        createTestProblem({ description: 'Problem' }),
        { stdin: 'input', randomSeed: sessionSeed, attachedFiles: sessionFiles }
      );

      // Add student who doesn't modify settings
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'code');

      // Get students (raw data - no session defaults applied yet)
      const students = await sessionManager.getStudents(session.id);
      
      // Student object itself doesn't have the settings
      expect(students[0].executionSettings?.randomSeed).toBeUndefined();
      expect(students[0].executionSettings?.attachedFiles).toBeUndefined();

      // But broadcastStudentList should apply session defaults
      // (This is what the websocket handler does - it needs to get the session
      // and apply the defaults when building the student list)
      const sessionData = await sessionManager.getSession(session.id);
      const studentListWithDefaults = students.map(s => ({
        id: s.id,
        name: s.name,
        hasCode: s.code.length > 0,
        randomSeed: s.executionSettings?.randomSeed !== undefined ? s.executionSettings?.randomSeed : sessionData!.problem.executionSettings?.randomSeed,
        attachedFiles: s.executionSettings?.attachedFiles !== undefined ? s.executionSettings?.attachedFiles : sessionData!.problem.executionSettings?.attachedFiles,
      }));

      // Verify the list includes session defaults
      expect(studentListWithDefaults[0].randomSeed).toBe(sessionSeed);
      expect(studentListWithDefaults[0].attachedFiles).toEqual(sessionFiles);
    });

    it('should handle empty student list', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');

      const students = await sessionManager.getStudents(session.id);

      expect(students).toEqual([]);
    });

    it('should update student settings independently', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');

      // Set initial settings
      await sessionManager.updateStudentSettings(session.id, 'student-1', {
        randomSeed: 10,
        attachedFiles: [{ name: 'file1.txt', content: 'content1' }]
      });

      let students = await sessionManager.getStudents(session.id);
      expect(students[0].executionSettings?.randomSeed).toBe(10);

      // Update only seed
      await sessionManager.updateStudentSettings(session.id, 'student-1', { randomSeed: 20 });

      students = await sessionManager.getStudents(session.id);
      expect(students[0].executionSettings?.randomSeed).toBe(20);
      expect(students[0].executionSettings?.attachedFiles).toEqual([{ name: 'file1.txt', content: 'content1' }]);

      // Update only files
      await sessionManager.updateStudentSettings(session.id, 'student-1', {
        attachedFiles: [{ name: 'file2.txt', content: 'content2' }]
      });

      students = await sessionManager.getStudents(session.id);
      expect(students[0].executionSettings?.randomSeed).toBe(20);
      expect(students[0].executionSettings?.attachedFiles).toEqual([{ name: 'file2.txt', content: 'content2' }]);
    });
  });

  describe('Featured submission with execution settings', () => {
    it('should include randomSeed and attachedFiles in featured submission', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');

      // Set student's execution settings
      await sessionManager.updateStudentSettings(session.id, 'student-1', {
        randomSeed: 42,
        attachedFiles: [{ name: 'data.txt', content: 'test data' }]
      });
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("featured")');

      // Select as featured
      await sessionManager.setFeaturedSubmission(session.id, 'student-1');

      // Get featured submission (used by public view)
      const featured = await sessionManager.getFeaturedSubmission(session.id);

      expect(featured.studentId).toBe('student-1');
      expect(featured.code).toBe('print("featured")');
      expect(featured.executionSettings?.randomSeed).toBe(42);
      expect(featured.executionSettings?.attachedFiles).toEqual([{ name: 'data.txt', content: 'test data' }]);
    });

    it('should handle featured submission with no execution settings', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("featured")');
      await sessionManager.setFeaturedSubmission(session.id, 'student-1');

      const featured = await sessionManager.getFeaturedSubmission(session.id);

      expect(featured.studentId).toBe('student-1');
      expect(featured.code).toBe('print("featured")');
      expect(featured.executionSettings?.randomSeed).toBeUndefined();
      expect(featured.executionSettings?.attachedFiles).toBeUndefined();
    });

    it('should return empty object when no featured submission', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');

      const featured = await sessionManager.getFeaturedSubmission(session.id);

      expect(featured).toEqual({});
    });

    it('should return empty object for non-existent session', async () => {
      const featured = await sessionManager.getFeaturedSubmission('non-existent');

      expect(featured).toEqual({});
    });
  });

  describe('Regression: Bug fix verification', () => {
    it('REGRESSION: getStudentData must return code, randomSeed, and attachedFiles', async () => {
      // This test verifies the fix for the bug where handleRequestStudentCode
      // only used getStudentCode (returning just code) instead of getStudentData
      // (returning full student state with execution settings)

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("test")');
      await sessionManager.updateStudentSettings(session.id, 'student-1', {
        randomSeed: 123,
        attachedFiles: [{ name: 'input.txt', content: 'test input' }]
      });

      // This is what the fixed handleRequestStudentCode now uses
      const data = await sessionManager.getStudentData(session.id, 'student-1');

      // All three fields must be present
      expect(data).toBeDefined();
      expect(data?.code).toBe('print("test")');
      expect(data?.executionSettings?.randomSeed).toBe(123);
      expect(data?.executionSettings?.attachedFiles).toHaveLength(1);
      expect(data?.executionSettings?.attachedFiles?.[0].name).toBe('input.txt');
    });

    it('REGRESSION: Student list must include execution settings fields', async () => {
      // This test verifies the fix for the bug where broadcastStudentList
      // only included id, name, hasCode but not randomSeed and attachedFiles

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentSettings(session.id, 'student-1', {
        randomSeed: 456,
        attachedFiles: [{ name: 'config.yaml', content: 'key: value' }]
      });

      const students = await sessionManager.getStudents(session.id);
      const student = students[0];

      // The bug was these fields were missing in the student list
      expect(student.id).toBeDefined();
      expect(student.name).toBeDefined();
      expect(student.executionSettings?.randomSeed).toBe(456);
      expect(student.executionSettings?.attachedFiles).toBeDefined();
      expect(student.executionSettings?.attachedFiles).toHaveLength(1);
    });

    it('REGRESSION: Featured submission must include student execution settings', async () => {
      // This test verifies the fix where getFeaturedSubmission now returns
      // the featured student's randomSeed and attachedFiles

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      
      const files = [{ name: 'test.txt', content: 'public test' }];
      await sessionManager.updateStudentSettings(session.id, 'student-1', {
        randomSeed: 789,
        attachedFiles: files
      });
      await sessionManager.updateStudentCode(session.id, 'student-1', 'public code');
      await sessionManager.setFeaturedSubmission(session.id, 'student-1');

      const featured = await sessionManager.getFeaturedSubmission(session.id);

      // The bug was these fields were missing for public view
      expect(featured.executionSettings?.randomSeed).toBe(789);
      expect(featured.executionSettings?.attachedFiles).toEqual(files);
    });
  });

  describe('SESSION_CREATED message', () => {
    it('should include execution settings when creating session', async () => {
      // Bug: When instructor rejoins a session, execution settings were lost
      // because SESSION_CREATED didn't include problemText, exampleInput, 
      // randomSeed, or attachedFiles

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Set problem with execution settings
      const problemText = 'Calculate fibonacci';
      const exampleInput = 'n=10';
      const randomSeed = 42;
      const attachedFiles = [
        { name: 'input.txt', content: 'test data' }
      ];
      
      await sessionManager.updateSessionProblem(
        session.id, 
        createTestProblem({ description: problemText }), 
        { stdin: exampleInput, randomSeed, attachedFiles }
      );

      // Get the updated session (simulating what handleCreateSession does)
      const updatedSession = await sessionManager.getSession(session.id);

      // Verify session includes all execution settings in problem
      expect(updatedSession).toBeDefined();
      expect(updatedSession!.problem.description).toBe(problemText);
      expect(updatedSession!.problem.executionSettings?.stdin).toBe(exampleInput);
      expect(updatedSession!.problem.executionSettings?.randomSeed).toBe(randomSeed);
      expect(updatedSession!.problem.executionSettings?.attachedFiles).toEqual(attachedFiles);
    });

    it('should preserve execution settings across session lifecycle', async () => {
      // Bug scenario: Instructor creates session with problem, disconnects, 
      // and rejoins. Settings should still be there.

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Set up problem with all settings
      await sessionManager.updateSessionProblem(
        session.id,
        createTestProblem({ description: 'Write a function' }),
        { stdin: 'input: [1, 2, 3]', randomSeed: 999, attachedFiles: [{ name: 'data.csv', content: 'col1,col2\n1,2' }] }
      );

      // Simulate reconnection: get session again
      const reconnectedSession = await sessionManager.getSession(session.id);

      // All settings should be preserved in problem
      expect(reconnectedSession!.problem.description).toBe('Write a function');
      expect(reconnectedSession!.problem.executionSettings?.stdin).toBe('input: [1, 2, 3]');
      expect(reconnectedSession!.problem.executionSettings?.randomSeed).toBe(999);
      expect(reconnectedSession!.problem.executionSettings?.attachedFiles).toHaveLength(1);
      expect(reconnectedSession!.problem.executionSettings?.attachedFiles![0].name).toBe('data.csv');
    });

    it('should handle empty execution settings in SESSION_CREATED', async () => {
      // Session should work even when created without any problem set

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Verify session has an empty problem
      expect(session.problem).toBeDefined();
      expect(session.problem.title).toBe('Untitled Session');
      expect(session.problem.executionSettings).toBeUndefined();
    });
  });

  describe('SESSION_JOINED message (instructor rejoins existing session)', () => {
    it('should include all execution settings when instructor rejoins session', async () => {
      // Bug: When instructor rejoins existing session via JOIN_EXISTING_SESSION,
      // the SESSION_JOINED response was missing randomSeed and attachedFiles

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Set up complete problem with all execution settings
      const problemText = 'Solve the problem';
      const exampleInput = 'n=5';
      const randomSeed = 12345;
      const attachedFiles = [
        { name: 'test.txt', content: 'test content' },
        { name: 'data.json', content: '{"key": "value"}' }
      ];
      
      await sessionManager.updateSessionProblem(
        session.id,
        createTestProblem({ description: problemText }),
        { stdin: exampleInput, randomSeed, attachedFiles }
      );

      // Simulate instructor rejoining: get session again
      const rejoined = await sessionManager.getSession(session.id);

      // Verify SESSION_JOINED would have all fields available
      expect(rejoined).toBeDefined();
      expect(rejoined!.problem.description).toBe(problemText);
      expect(rejoined!.problem.executionSettings?.stdin).toBe(exampleInput);
      expect(rejoined!.problem.executionSettings?.randomSeed).toBe(randomSeed);
      expect(rejoined!.problem.executionSettings?.attachedFiles).toEqual(attachedFiles);
    });

    it('should handle instructor rejoining session with partial settings', async () => {
      // Test rejoin when only some execution settings are set

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Only set problem text and random seed, leave others undefined
      await sessionManager.updateSessionProblem(
        session.id,
        createTestProblem({ description: 'Problem statement' }),
        { randomSeed: 777 } // only randomSeed set
      );

      const rejoined = await sessionManager.getSession(session.id);

      expect(rejoined!.problem.description).toBe('Problem statement');
      expect(rejoined!.problem.executionSettings?.stdin).toBeUndefined();
      expect(rejoined!.problem.executionSettings?.randomSeed).toBe(777);
      expect(rejoined!.problem.executionSettings?.attachedFiles).toBeUndefined();
    });

    it('should preserve execution settings after multiple instructors join', async () => {
      // Test that settings persist across multiple instructor connections

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      const files = [{ name: 'shared.txt', content: 'shared data' }];
      await sessionManager.updateSessionProblem(
        session.id,
        createTestProblem({ description: 'Collaborative problem' }),
        { stdin: 'input: test', randomSeed: 42, attachedFiles: files }
      );

      // First instructor gets session
      const firstView = await sessionManager.getSession(session.id);
      expect(firstView!.problem.executionSettings?.randomSeed).toBe(42);

      // Second instructor joins (simulated by another getSession)
      const secondView = await sessionManager.getSession(session.id);
      
      // Both should see the same settings
      expect(secondView!.problem.description).toBe(firstView!.problem.description);
      expect(secondView!.problem.executionSettings?.randomSeed).toBe(firstView!.problem.executionSettings?.randomSeed);
      expect(secondView!.problem.executionSettings?.attachedFiles).toEqual(firstView!.problem.executionSettings?.attachedFiles);
    });

    it('should handle empty session when instructor rejoins before problem is set', async () => {
      // Instructor creates session but hasn't set problem yet, then reconnects

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Don't call updateProblem - simulate instructor disconnecting before setting problem
      
      // Instructor rejoins
      const rejoined = await sessionManager.getSession(session.id);

      // Should handle empty state gracefully (session has empty problem)
      expect(rejoined!.problem).toBeDefined();
      expect(rejoined!.problem.title).toBe('Untitled Session');
      expect(rejoined!.problem.executionSettings).toBeUndefined();
    });
  });
});
