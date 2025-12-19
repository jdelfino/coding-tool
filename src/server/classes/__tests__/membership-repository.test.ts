/**
 * Unit tests for MembershipRepository
 * 
 * Tests user enrollment in sections, membership queries, and join code validation
 */

import { MembershipRepository } from '../membership-repository';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { User } from '../../auth/types';
import { Section, Class } from '../types';

describe('MembershipRepository', () => {
  let tempDir: string;
  let repository: MembershipRepository;
  let mockUserRepository: any;
  let mockSectionRepository: any;
  let mockClassRepository: any;

  // Mock data
  const mockUser1: User = {
    id: 'user-1',
    username: 'student1',
    role: 'student',
    createdAt: new Date(),
  };

  const mockUser2: User = {
    id: 'user-2',
    username: 'student2',
    role: 'student',
    createdAt: new Date(),
  };

  const mockInstructor: User = {
    id: 'instructor-1',
    username: 'instructor',
    role: 'instructor',
    createdAt: new Date(),
  };

  const mockSection1: Section = {
    id: 'section-1',
    classId: 'class-1',
    name: 'Section A',
    instructorIds: ['instructor-1'],
    joinCode: 'ABC-123-XYZ',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSection2: Section = {
    id: 'section-2',
    classId: 'class-1',
    name: 'Section B',
    instructorIds: ['instructor-1'],
    joinCode: 'DEF-456-GHI',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockClass: Class = {
    id: 'class-1',
    name: 'CS 101',
    description: 'Introduction to CS',
    createdBy: 'instructor-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Create temp directory for test data
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'membership-test-'));
    repository = new MembershipRepository(tempDir);
    
    // Mock repositories
    mockUserRepository = {
      getUserById: jest.fn((id: string) => {
        if (id === 'user-1') return Promise.resolve(mockUser1);
        if (id === 'user-2') return Promise.resolve(mockUser2);
        if (id === 'instructor-1') return Promise.resolve(mockInstructor);
        return Promise.resolve(null);
      }),
    };

    mockSectionRepository = {
      getSection: jest.fn((id: string) => {
        if (id === 'section-1') return Promise.resolve(mockSection1);
        if (id === 'section-2') return Promise.resolve(mockSection2);
        return Promise.resolve(null);
      }),
      getSectionByJoinCode: jest.fn((code: string) => {
        if (code === 'ABC-123-XYZ') return Promise.resolve(mockSection1);
        if (code === 'DEF-456-GHI') return Promise.resolve(mockSection2);
        return Promise.resolve(null);
      }),
    };

    mockClassRepository = {
      getClass: jest.fn(() => Promise.resolve(mockClass)),
    };

    repository.setRepositories(mockUserRepository, mockSectionRepository, mockClassRepository);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('addMembership', () => {
    it('should create membership enrollment', async () => {
      const membershipData = {
        userId: 'user-1',
        sectionId: 'section-1',
        role: 'student' as const,
      };

      const created = await repository.addMembership(membershipData);

      expect(created).toBeDefined();
      expect(created.id).toMatch(/^membership-/);
      expect(created.userId).toBe('user-1');
      expect(created.sectionId).toBe('section-1');
      expect(created.role).toBe('student');
      expect(created.joinedAt).toBeInstanceOf(Date);
    });

    it('should create instructor membership', async () => {
      const membershipData = {
        userId: 'instructor-1',
        sectionId: 'section-1',
        role: 'instructor' as const,
      };

      const created = await repository.addMembership(membershipData);

      expect(created.role).toBe('instructor');
      expect(created.userId).toBe('instructor-1');
    });

    it('should throw error on duplicate membership', async () => {
      const membershipData = {
        userId: 'user-1',
        sectionId: 'section-1',
        role: 'student' as const,
      };

      await repository.addMembership(membershipData);

      await expect(
        repository.addMembership(membershipData)
      ).rejects.toThrow('User is already a member of this section');
    });

    it('should allow user to join multiple sections', async () => {
      await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-1',
        role: 'student',
      });

      await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-2',
        role: 'student',
      });

      const sections = await repository.getUserSections('user-1');
      expect(sections).toHaveLength(2);
    });

    it('should persist to disk', async () => {
      await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-1',
        role: 'student',
      });

      // Verify file was created
      const filePath = path.join(tempDir, 'memberships.json');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file content
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(Object.keys(parsed)).toHaveLength(1);
    });
  });

  describe('removeMembership', () => {
    it('should delete enrollment', async () => {
      await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-1',
        role: 'student',
      });

      await repository.removeMembership('user-1', 'section-1');

      const isMember = await repository.isMember('user-1', 'section-1');
      expect(isMember).toBe(false);
    });

    it('should throw error for non-existent membership', async () => {
      await expect(
        repository.removeMembership('user-1', 'section-1')
      ).rejects.toThrow('Membership not found');
    });

    it('should update indexes after removal', async () => {
      await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-1',
        role: 'student',
      });

      await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-2',
        role: 'student',
      });

      await repository.removeMembership('user-1', 'section-1');

      const sections = await repository.getUserSections('user-1');
      expect(sections).toHaveLength(1);
      expect(sections[0].id).toBe('section-2');
    });
  });

  describe('getUserSections', () => {
    beforeEach(async () => {
      // Create test memberships
      await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-1',
        role: 'student',
      });

      await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-2',
        role: 'student',
      });

      await repository.addMembership({
        userId: 'instructor-1',
        sectionId: 'section-1',
        role: 'instructor',
      });
    });

    it('should return SectionWithClass array', async () => {
      const sections = await repository.getUserSections('user-1');

      expect(sections).toHaveLength(2);
      expect(sections[0]).toHaveProperty('id');
      expect(sections[0]).toHaveProperty('name');
      expect(sections[0]).toHaveProperty('class');
      expect(sections[0].class).toHaveProperty('id');
      expect(sections[0].class).toHaveProperty('name');
    });

    it('should filter by role when specified', async () => {
      const studentSections = await repository.getUserSections('user-1', 'student');
      expect(studentSections).toHaveLength(2);

      const instructorSections = await repository.getUserSections('user-1', 'instructor');
      expect(instructorSections).toHaveLength(0);
    });

    it('should return empty array for user with no memberships', async () => {
      const sections = await repository.getUserSections('user-2');
      expect(sections).toEqual([]);
    });

    it('should sort by joined date (most recent first)', async () => {
      // Use fresh user ID to avoid conflicts with other tests
      const testUserId = 'user-sort-test';
      
      // Create memberships with slight delay to ensure different timestamps
      await repository.addMembership({
        userId: testUserId,
        sectionId: 'section-1',
        role: 'student',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await repository.addMembership({
        userId: testUserId,
        sectionId: 'section-2',
        role: 'student',
      });

      const sections = await repository.getUserSections(testUserId);
      
      // Verify the more recent membership is first
      expect(sections).toHaveLength(2);
      // The sorting is based on membership joinedAt, most recent first
      expect(sections[0].id).toBe('section-2');
      expect(sections[1].id).toBe('section-1');
    });

    it('should throw error if repositories not configured', async () => {
      const repoWithoutDeps = new MembershipRepository(tempDir);
      
      await expect(
        repoWithoutDeps.getUserSections('user-1')
      ).rejects.toThrow('Repositories not configured');
    });
  });

  describe('getSectionMembers', () => {
    beforeEach(async () => {
      await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-1',
        role: 'student',
      });

      await repository.addMembership({
        userId: 'user-2',
        sectionId: 'section-1',
        role: 'student',
      });

      await repository.addMembership({
        userId: 'instructor-1',
        sectionId: 'section-1',
        role: 'instructor',
      });
    });

    it('should return User array', async () => {
      const members = await repository.getSectionMembers('section-1');

      expect(members).toHaveLength(3);
      expect(members[0]).toHaveProperty('id');
      expect(members[0]).toHaveProperty('username');
      expect(members[0]).toHaveProperty('role');
    });

    it('should filter by role when specified', async () => {
      const students = await repository.getSectionMembers('section-1', 'student');
      expect(students).toHaveLength(2);
      expect(students.every(u => u.role === 'student')).toBe(true);

      const instructors = await repository.getSectionMembers('section-1', 'instructor');
      expect(instructors).toHaveLength(1);
      expect(instructors[0].id).toBe('instructor-1');
    });

    it('should return empty array for section with no members', async () => {
      const members = await repository.getSectionMembers('section-2');
      expect(members).toEqual([]);
    });

    it('should sort members by username', async () => {
      const members = await repository.getSectionMembers('section-1', 'student');
      
      expect(members[0].username).toBe('student1');
      expect(members[1].username).toBe('student2');
    });

    it('should throw error if user repository not configured', async () => {
      const repoWithoutDeps = new MembershipRepository(tempDir);
      
      await expect(
        repoWithoutDeps.getSectionMembers('section-1')
      ).rejects.toThrow('User repository not configured');
    });
  });

  describe('isMember', () => {
    it('should return true for existing membership', async () => {
      await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-1',
        role: 'student',
      });

      const result = await repository.isMember('user-1', 'section-1');
      expect(result).toBe(true);
    });

    it('should return false for non-existent membership', async () => {
      const result = await repository.isMember('user-1', 'section-1');
      expect(result).toBe(false);
    });

    it('should check membership correctly for instructors', async () => {
      await repository.addMembership({
        userId: 'instructor-1',
        sectionId: 'section-1',
        role: 'instructor',
      });

      const result = await repository.isMember('instructor-1', 'section-1');
      expect(result).toBe(true);
    });
  });

  describe('getMembership', () => {
    it('should return membership for user and section', async () => {
      const created = await repository.addMembership({
        userId: 'user-1',
        sectionId: 'section-1',
        role: 'student',
      });

      const membership = await repository.getMembership('user-1', 'section-1');

      expect(membership).not.toBeNull();
      expect(membership?.id).toBe(created.id);
      expect(membership?.userId).toBe('user-1');
      expect(membership?.sectionId).toBe('section-1');
    });

    it('should return null for non-existent membership', async () => {
      const membership = await repository.getMembership('user-1', 'section-1');
      expect(membership).toBeNull();
    });
  });

  describe('validateJoinCode', () => {
    it('should return section for valid active join code', async () => {
      const section = await repository.validateJoinCode('ABC-123-XYZ');

      expect(section).not.toBeNull();
      expect(section?.id).toBe('section-1');
      expect(section?.joinCode).toBe('ABC-123-XYZ');
    });

    it('should normalize join code (uppercase, trim)', async () => {
      const section1 = await repository.validateJoinCode('abc-123-xyz');
      expect(section1).not.toBeNull();

      const section2 = await repository.validateJoinCode('  ABC-123-XYZ  ');
      expect(section2).not.toBeNull();
    });

    it('should return null for invalid format', async () => {
      const section = await repository.validateJoinCode('INVALID');
      expect(section).toBeNull();
    });

    it('should return null for non-existent join code', async () => {
      const section = await repository.validateJoinCode('XXX-999-YYY');
      expect(section).toBeNull();
    });

    it('should return null for inactive section', async () => {
      const inactiveSection: Section = {
        ...mockSection1,
        active: false,
      };

      mockSectionRepository.getSectionByJoinCode.mockImplementation((code: string) => {
        if (code === 'ABC-123-XYZ') return Promise.resolve(inactiveSection);
        return Promise.resolve(null);
      });

      const section = await repository.validateJoinCode('ABC-123-XYZ');
      expect(section).toBeNull();
    });

    it('should throw error if section repository not configured', async () => {
      const repoWithoutDeps = new MembershipRepository(tempDir);
      
      await expect(
        repoWithoutDeps.validateJoinCode('ABC-123-XYZ')
      ).rejects.toThrow('Section repository not set');
    });
  });

  describe('joinSection', () => {
    it('should enroll student via join code', async () => {
      const membership = await repository.joinSection('user-1', 'ABC-123-XYZ');

      expect(membership).toBeDefined();
      expect(membership.userId).toBe('user-1');
      expect(membership.sectionId).toBe('section-1');
      expect(membership.role).toBe('student');
    });

    it('should normalize join code', async () => {
      const membership = await repository.joinSection('user-1', 'abc-123-xyz');
      expect(membership.sectionId).toBe('section-1');
    });

    it('should be idempotent (return existing membership)', async () => {
      const membership1 = await repository.joinSection('user-1', 'ABC-123-XYZ');
      const membership2 = await repository.joinSection('user-1', 'ABC-123-XYZ');

      expect(membership1.id).toBe(membership2.id);
      
      // Verify only one membership exists
      const sections = await repository.getUserSections('user-1');
      expect(sections).toHaveLength(1);
    });

    it('should throw error for invalid join code', async () => {
      await expect(
        repository.joinSection('user-1', 'INVALID')
      ).rejects.toThrow('Invalid or inactive join code');
    });

    it('should throw error for non-existent join code', async () => {
      await expect(
        repository.joinSection('user-1', 'XXX-999-YYY')
      ).rejects.toThrow('Invalid or inactive join code');
    });

    it('should throw error for inactive section', async () => {
      const inactiveSection: Section = {
        ...mockSection1,
        active: false,
      };

      mockSectionRepository.getSectionByJoinCode.mockImplementation((code: string) => {
        if (code === 'ABC-123-XYZ') return Promise.resolve(inactiveSection);
        return Promise.resolve(null);
      });

      await expect(
        repository.joinSection('user-1', 'ABC-123-XYZ')
      ).rejects.toThrow('Invalid or inactive join code');
    });

    it('should allow student to join multiple sections', async () => {
      await repository.joinSection('user-1', 'ABC-123-XYZ');
      await repository.joinSection('user-1', 'DEF-456-GHI');

      const sections = await repository.getUserSections('user-1');
      expect(sections).toHaveLength(2);
    });
  });
});
