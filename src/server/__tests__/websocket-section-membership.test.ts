/**
 * Tests for section membership verification in session join flow
 */

import { SessionManager, sessionManagerHolder } from '../session-manager';
import { FakeStorageBackend } from './test-utils/fake-storage';
import { FakeClassRepository, FakeSectionRepository, FakeMembershipRepository } from './test-utils/fake-classes';
import { Problem } from '../types/problem';

// Mock the classes module
const classRepo = new FakeClassRepository();
const sectionRepo = new FakeSectionRepository();
const membershipRepo = new FakeMembershipRepository();

jest.mock('../classes', () => ({
  getClassRepository: jest.fn(() => Promise.resolve(classRepo)),
  getSectionRepository: jest.fn(() => Promise.resolve(sectionRepo)),
  getMembershipRepository: jest.fn(() => Promise.resolve(membershipRepo)),
}));

const mockProblem: Problem = {
  id: 'problem-1',
  namespaceId: 'default',
  title: 'Test Problem',
  description: 'A test problem',
  starterCode: 'print("Hello, world!")',
  executionSettings: {},
  authorId: 'instructor-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Section Membership Verification', () => {
  let sessionManager: SessionManager;
  let storage: FakeStorageBackend;
  let instructorId: string;
  let studentId: string;
  let unenrolledStudentId: string;
  let classId: string;
  let sectionId: string;

  beforeEach(async () => {
    // Set up storage
    storage = new FakeStorageBackend();
    sessionManager = new SessionManager(storage);
    sessionManagerHolder.instance = sessionManager;

    // Create test users
    instructorId = 'instructor-1';
    studentId = 'student-1';
    unenrolledStudentId = 'student-2';

    // Create class and section
    const classData = await classRepo.createClass({
      namespaceId: 'default',
      name: 'Test Class',
      description: 'Test class for section membership',
      createdBy: instructorId,
    });
    classId = classData.id;

    const section = await sectionRepo.createSection({
      namespaceId: 'default',
      classId,
      name: 'Section A',
      active: true,
      instructorIds: [instructorId],
    });
    sectionId = section.id;

    // Enroll only the first student in the section
    await membershipRepo.addMembership({
      userId: studentId,
      sectionId,
      role: 'student',
    });
  });

  afterEach(() => {
    // Clean up
    classRepo.clear();
    sectionRepo.clear();
    membershipRepo.clear();
  });

  test('session created with section has sectionId', async () => {
    const session = await sessionManager.createSession(instructorId, sectionId, 'Section A', mockProblem);

    expect(session.sectionId).toBe(sectionId);
    expect(session.sectionName).toBe('Section A');
  });

  test('section membership is checked via membership repository', async () => {
    // Verify enrolled student has membership
    const enrolledMembership = await membershipRepo.getMembership(studentId, sectionId);
    expect(enrolledMembership).toBeDefined();
    expect(enrolledMembership?.role).toBe('student');

    // Verify unenrolled student does not have membership
    const unenrolledMembership = await membershipRepo.getMembership(unenrolledStudentId, sectionId);
    expect(unenrolledMembership).toBeNull();
  });

  test('instructor is in section instructorIds', async () => {
    const section = await sectionRepo.getSection(sectionId);
    expect(section?.instructorIds).toContain(instructorId);
  });

  test('session is associated with correct section', async () => {
    const session = await sessionManager.createSession(instructorId, sectionId, 'Section A', mockProblem);

    const retrievedSession = await sessionManager.getSession(session.id);
    expect(retrievedSession).toBeDefined();
    expect(retrievedSession?.id).toBe(session.id);
    expect(retrievedSession?.sectionId).toBe(sectionId);
  });
});
