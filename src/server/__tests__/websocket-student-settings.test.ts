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
      await sessionManager.updateStudentSettings(session.id, 'student-1', randomSeed, attachedFiles);

      // Update student code
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("hello")');

      // Get student data (this is what handleRequestStudentCode uses)
      const studentData = await sessionManager.getStudentData(session.id, 'student-1');

      // Verify all fields are present
      expect(studentData).toBeDefined();
      expect(studentData?.code).toBe('print("hello")');
      expect(studentData?.randomSeed).toBe(42);
      expect(studentData?.attachedFiles).toEqual(attachedFiles);
    });

    it('should handle student with no execution settings', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("hello")');

      const studentData = await sessionManager.getStudentData(session.id, 'student-1');

      expect(studentData).toBeDefined();
      expect(studentData?.code).toBe('print("hello")');
      expect(studentData?.randomSeed).toBeUndefined();
      expect(studentData?.attachedFiles).toBeUndefined();
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
  });

  describe('Student list with execution settings', () => {
    it('should include randomSeed and attachedFiles for students in list', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Add multiple students with different settings
      await sessionManager.addStudent(session.id, 'student-1', 'Alice');
      await sessionManager.updateStudentSettings(session.id, 'student-1', 42, [
        { name: 'data1.txt', content: 'content1' }
      ]);

      await sessionManager.addStudent(session.id, 'student-2', 'Bob');
      await sessionManager.updateStudentSettings(session.id, 'student-2', 99, [
        { name: 'data2.txt', content: 'content2' }
      ]);

      await sessionManager.addStudent(session.id, 'student-3', 'Charlie');
      // student-3 has no custom settings

      // Get all students (this simulates what broadcastStudentList uses)
      const students = await sessionManager.getStudents(session.id);

      expect(students).toHaveLength(3);

      // Verify student 1 has settings
      const student1 = students.find(s => s.id === 'student-1');
      expect(student1?.randomSeed).toBe(42);
      expect(student1?.attachedFiles).toEqual([{ name: 'data1.txt', content: 'content1' }]);

      // Verify student 2 has different settings
      const student2 = students.find(s => s.id === 'student-2');
      expect(student2?.randomSeed).toBe(99);
      expect(student2?.attachedFiles).toEqual([{ name: 'data2.txt', content: 'content2' }]);

      // Verify student 3 has no settings
      const student3 = students.find(s => s.id === 'student-3');
      expect(student3?.randomSeed).toBeUndefined();
      expect(student3?.attachedFiles).toBeUndefined();
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
      await sessionManager.updateStudentSettings(session.id, 'student-1', 10, [
        { name: 'file1.txt', content: 'content1' }
      ]);

      let students = await sessionManager.getStudents(session.id);
      expect(students[0].randomSeed).toBe(10);

      // Update only seed
      await sessionManager.updateStudentSettings(session.id, 'student-1', 20, undefined);

      students = await sessionManager.getStudents(session.id);
      expect(students[0].randomSeed).toBe(20);
      expect(students[0].attachedFiles).toEqual([{ name: 'file1.txt', content: 'content1' }]);

      // Update only files
      await sessionManager.updateStudentSettings(session.id, 'student-1', undefined, [
        { name: 'file2.txt', content: 'content2' }
      ]);

      students = await sessionManager.getStudents(session.id);
      expect(students[0].randomSeed).toBe(20);
      expect(students[0].attachedFiles).toEqual([{ name: 'file2.txt', content: 'content2' }]);
    });
  });

  describe('Featured submission with execution settings', () => {
    it('should include randomSeed and attachedFiles in featured submission', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');

      // Set student's execution settings
      await sessionManager.updateStudentSettings(session.id, 'student-1', 42, [
        { name: 'data.txt', content: 'test data' }
      ]);
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("featured")');

      // Select as featured
      await sessionManager.setFeaturedSubmission(session.id, 'student-1');

      // Get featured submission (used by public view)
      const featured = await sessionManager.getFeaturedSubmission(session.id);

      expect(featured.studentId).toBe('student-1');
      expect(featured.code).toBe('print("featured")');
      expect(featured.randomSeed).toBe(42);
      expect(featured.attachedFiles).toEqual([{ name: 'data.txt', content: 'test data' }]);
    });

    it('should handle featured submission with no execution settings', async () => {
      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentCode(session.id, 'student-1', 'print("featured")');
      await sessionManager.setFeaturedSubmission(session.id, 'student-1');

      const featured = await sessionManager.getFeaturedSubmission(session.id);

      expect(featured.studentId).toBe('student-1');
      expect(featured.code).toBe('print("featured")');
      expect(featured.randomSeed).toBeUndefined();
      expect(featured.attachedFiles).toBeUndefined();
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
      await sessionManager.updateStudentSettings(session.id, 'student-1', 123, [
        { name: 'input.txt', content: 'test input' }
      ]);

      // This is what the fixed handleRequestStudentCode now uses
      const data = await sessionManager.getStudentData(session.id, 'student-1');

      // All three fields must be present
      expect(data).toBeDefined();
      expect(data?.code).toBe('print("test")');
      expect(data?.randomSeed).toBe(123);
      expect(data?.attachedFiles).toHaveLength(1);
      expect(data?.attachedFiles?.[0].name).toBe('input.txt');
    });

    it('REGRESSION: Student list must include execution settings fields', async () => {
      // This test verifies the fix for the bug where broadcastStudentList
      // only included id, name, hasCode but not randomSeed and attachedFiles

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      await sessionManager.updateStudentSettings(session.id, 'student-1', 456, [
        { name: 'config.yaml', content: 'key: value' }
      ]);

      const students = await sessionManager.getStudents(session.id);
      const student = students[0];

      // The bug was these fields were missing in the student list
      expect(student.id).toBeDefined();
      expect(student.name).toBeDefined();
      expect(student.randomSeed).toBe(456);
      expect(student.attachedFiles).toBeDefined();
      expect(student.attachedFiles).toHaveLength(1);
    });

    it('REGRESSION: Featured submission must include student execution settings', async () => {
      // This test verifies the fix where getFeaturedSubmission now returns
      // the featured student's randomSeed and attachedFiles

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      await sessionManager.addStudent(session.id, 'student-1', 'Student One');
      
      const files = [{ name: 'test.txt', content: 'public test' }];
      await sessionManager.updateStudentSettings(session.id, 'student-1', 789, files);
      await sessionManager.updateStudentCode(session.id, 'student-1', 'public code');
      await sessionManager.setFeaturedSubmission(session.id, 'student-1');

      const featured = await sessionManager.getFeaturedSubmission(session.id);

      // The bug was these fields were missing for public view
      expect(featured.randomSeed).toBe(789);
      expect(featured.attachedFiles).toEqual(files);
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
      
      await sessionManager.updateProblem(
        session.id, 
        problemText, 
        exampleInput, 
        randomSeed, 
        attachedFiles
      );

      // Get the updated session (simulating what handleCreateSession does)
      const updatedSession = await sessionManager.getSession(session.id);

      // Verify session includes all execution settings
      expect(updatedSession).toBeDefined();
      expect(updatedSession!.problemText).toBe(problemText);
      expect(updatedSession!.exampleInput).toBe(exampleInput);
      expect(updatedSession!.randomSeed).toBe(randomSeed);
      expect(updatedSession!.attachedFiles).toEqual(attachedFiles);
    });

    it('should preserve execution settings across session lifecycle', async () => {
      // Bug scenario: Instructor creates session with problem, disconnects, 
      // and rejoins. Settings should still be there.

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Set up problem with all settings
      await sessionManager.updateProblem(
        session.id,
        'Write a function',
        'input: [1, 2, 3]',
        999,
        [{ name: 'data.csv', content: 'col1,col2\n1,2' }]
      );

      // Simulate reconnection: get session again
      const reconnectedSession = await sessionManager.getSession(session.id);

      // All settings should be preserved
      expect(reconnectedSession!.problemText).toBe('Write a function');
      expect(reconnectedSession!.exampleInput).toBe('input: [1, 2, 3]');
      expect(reconnectedSession!.randomSeed).toBe(999);
      expect(reconnectedSession!.attachedFiles).toHaveLength(1);
      expect(reconnectedSession!.attachedFiles![0].name).toBe('data.csv');
    });

    it('should handle empty execution settings in SESSION_CREATED', async () => {
      // Session should work even when created without any problem set

      const session = await sessionManager.createSession('instructor-1', 'section-1', 'Test Section');
      
      // Verify defaults
      expect(session.problemText).toBe('');
      expect(session.exampleInput).toBeUndefined();
      expect(session.randomSeed).toBeUndefined();
      expect(session.attachedFiles).toBeUndefined();
    });
  });
});
