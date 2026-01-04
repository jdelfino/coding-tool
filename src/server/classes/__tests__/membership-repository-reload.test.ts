/**
 * Integration tests for MembershipRepository cross-process data reloading
 *
 * These tests verify that changes made by one repository instance
 * are visible to another instance (simulating cross-process behavior)
 */

import { MembershipRepository } from '../local';
import { SectionRepository } from '../local';
import { ClassRepository } from '../local';
import { LocalUserRepository } from '../../persistence/local';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('MembershipRepository - Cross-Process Data Reloading', () => {
  let testDir: string;
  let repository1: MembershipRepository;
  let repository2: MembershipRepository;
  let userRepo: LocalUserRepository;
  let sectionRepo: SectionRepository;
  let classRepo: ClassRepository;
  let testUserId: string;
  let testSectionId: string;

  beforeEach(async () => {
    // Create a temporary directory for test data
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'membership-repo-test-'));

    // Create shared repositories
    userRepo = new LocalUserRepository({ type: 'local', baseDir: testDir });
    sectionRepo = new SectionRepository(testDir);
    classRepo = new ClassRepository(testDir);

    await userRepo.initialize();

    // Create two membership repository instances
    repository1 = new MembershipRepository(testDir);
    repository2 = new MembershipRepository(testDir);

    // Set up dependencies
    repository1.setRepositories(userRepo, sectionRepo, classRepo);
    repository2.setRepositories(userRepo, sectionRepo, classRepo);
    sectionRepo.setMembershipRepository(repository1);
    classRepo.setSectionRepository(sectionRepo);

    // Create test data
    const user = await userRepo.saveUser({
      id: 'user-123',
      username: 'testuser',
      role: 'student',
      namespaceId: 'default',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });
    testUserId = 'user-123';

    const testClass = await classRepo.createClass({
      namespaceId: 'default',
      name: 'Test Class',
      description: 'Test',
      createdBy: 'instructor-1',
    });

    const section = await sectionRepo.createSection({
      namespaceId: 'default',
      classId: testClass.id,
      name: 'Test Section',
      semester: 'Fall 2025',
      instructorIds: ['instructor-1'],
      active: true,
    });
    testSectionId = section.id;
  });

  afterEach(async () => {
    await userRepo.shutdown();
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should see memberships created by another repository instance', async () => {
    // Repository 1 creates a membership
    const membership = await repository1.addMembership({
      userId: testUserId,
      sectionId: testSectionId,
      role: 'student',
    });

    // Repository 2 should see the membership
    const retrievedMembership = await repository2.getMembership(testUserId, testSectionId);

    expect(retrievedMembership).not.toBeNull();
    expect(retrievedMembership?.id).toBe(membership.id);
    expect(retrievedMembership?.userId).toBe(testUserId);
    expect(retrievedMembership?.sectionId).toBe(testSectionId);
  });

  it('should see membership deletions across repository instances', async () => {
    // Repository 1 creates a membership
    await repository1.addMembership({
      userId: testUserId,
      sectionId: testSectionId,
      role: 'student',
    });

    // Verify repository 2 can see it
    let membership = await repository2.getMembership(testUserId, testSectionId);
    expect(membership).not.toBeNull();

    // Repository 1 removes the membership
    await repository1.removeMembership(testUserId, testSectionId);

    // Repository 2 should no longer see the membership
    membership = await repository2.getMembership(testUserId, testSectionId);
    expect(membership).toBeNull();
  });

  it('should see user sections across repository instances', async () => {
    // Repository 1 creates a membership
    await repository1.addMembership({
      userId: testUserId,
      sectionId: testSectionId,
      role: 'student',
    });

    // Repository 2 should see the user's sections
    const sections = await repository2.getUserSections(testUserId);

    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe(testSectionId);
    expect(sections[0].name).toBe('Test Section');
  });

  it('should see section members across repository instances', async () => {
    // Repository 1 creates a membership
    await repository1.addMembership({
      userId: testUserId,
      sectionId: testSectionId,
      role: 'student',
    });

    // Repository 2 should see the section's members
    const members = await repository2.getSectionMembers(testSectionId);

    expect(members).toHaveLength(1);
    expect(members[0].id).toBe(testUserId);
    expect(members[0].username).toBe('testuser');
  });

  it('should handle multiple memberships across repository instances', async () => {
    // Create additional users and sections
    await userRepo.saveUser({
      id: 'user-456',
      username: 'testuser2',
      role: 'student',
      namespaceId: 'default',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    const section2 = await sectionRepo.createSection({
      namespaceId: 'default',
      classId: (await classRepo.listClasses())[0].id,
      name: 'Test Section 2',
      semester: 'Fall 2025',
      instructorIds: ['instructor-1'],
      active: true,
    });

    // Repository 1 creates multiple memberships
    await repository1.addMembership({
      userId: testUserId,
      sectionId: testSectionId,
      role: 'student',
    });

    await repository1.addMembership({
      userId: 'user-456',
      sectionId: testSectionId,
      role: 'student',
    });

    await repository1.addMembership({
      userId: testUserId,
      sectionId: section2.id,
      role: 'student',
    });

    // Repository 2 should see all memberships
    const userSections = await repository2.getUserSections(testUserId);
    const sectionMembers = await repository2.getSectionMembers(testSectionId);

    expect(userSections).toHaveLength(2);
    expect(sectionMembers).toHaveLength(2);
  });
});
