/**
 * Unit tests for SupabaseMembershipRepository
 *
 * Tests the membership repository implementation against the Supabase backend.
 * Uses Jest mocks configured per-test for clean isolation.
 */

import { SupabaseMembershipRepository } from '../membership-repository';
import { SectionMembership, SectionWithClass } from '../../../classes/types';
import { User } from '../../../auth/types';

// Mock crypto.randomUUID
const mockUUID = 'test-uuid-1234';
jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID as `${string}-${string}-${string}-${string}-${string}`);

// Mock the Supabase client module
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockLimit = jest.fn();

jest.mock('../../../supabase/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('SupabaseMembershipRepository', () => {
  let repository: SupabaseMembershipRepository;

  const mockMembership: SectionMembership = {
    id: 'membership-123',
    userId: 'user-456',
    sectionId: 'section-789',
    role: 'student',
    joinedAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockMembershipRow = {
    id: mockMembership.id,
    user_id: mockMembership.userId,
    section_id: mockMembership.sectionId,
    role: mockMembership.role,
    joined_at: mockMembership.joinedAt.toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock chain with proper chaining support
    mockFrom.mockImplementation((table: string) => {
      const eqChain = {
        eq: jest.fn().mockReturnThis(),
        single: mockSingle,
      };

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(eqChain),
          single: mockSingle,
          limit: mockLimit,
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(eqChain),
        }),
      };
    });

    repository = new SupabaseMembershipRepository();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid connection', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await repository.initialize();

      expect(mockFrom).toHaveBeenCalledWith('section_memberships');
    });

    it('should throw error if connection fails', async () => {
      mockLimit.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
      });

      await expect(repository.initialize()).rejects.toThrow('Failed to initialize MembershipRepository');
    });

    it('should only initialize once', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await repository.initialize();
      await repository.initialize();

      expect(mockFrom).toHaveBeenCalledTimes(1);
    });
  });

  describe('addMembership', () => {
    const membershipInput = {
      userId: 'user-456',
      sectionId: 'section-789',
      role: 'student' as const,
    };

    it('should add a membership successfully', async () => {
      mockSingle.mockResolvedValue({
        data: mockMembershipRow,
        error: null
      });

      const result = await repository.addMembership(membershipInput);

      expect(result.id).toBe(mockMembership.id);
      expect(result.userId).toBe(mockMembership.userId);
      expect(result.sectionId).toBe(mockMembership.sectionId);
      expect(result.role).toBe('student');
      expect(mockFrom).toHaveBeenCalledWith('section_memberships');
    });

    it('should handle duplicate membership error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key value' }
      });

      await expect(repository.addMembership(membershipInput))
        .rejects.toThrow('already enrolled in section');
    });

    it('should handle database errors during creation', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection lost' }
      });

      await expect(repository.addMembership(membershipInput))
        .rejects.toThrow('Failed to add membership');
    });

    it('should create instructor membership', async () => {
      const instructorInput = {
        ...membershipInput,
        role: 'instructor' as const,
      };

      mockSingle.mockResolvedValue({
        data: {
          ...mockMembershipRow,
          role: 'instructor',
        },
        error: null
      });

      const result = await repository.addMembership(instructorInput);

      expect(result.role).toBe('instructor');
    });
  });

  describe('removeMembership', () => {
    it('should remove a membership successfully', async () => {
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await repository.removeMembership('user-456', 'section-789');

      expect(mockFrom).toHaveBeenCalledWith('section_memberships');
    });

    it('should throw error on delete failure', async () => {
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            }),
          }),
        }),
      });

      await expect(repository.removeMembership('user-456', 'section-789'))
        .rejects.toThrow('Failed to remove membership');
    });
  });

  describe('getUserSections', () => {
    const mockSectionWithClass: SectionWithClass = {
      id: 'section-789',
      namespaceId: 'stanford',
      classId: 'class-123',
      name: 'Section A',
      semester: 'Fall 2025',
      instructorIds: ['instructor-1'],
      joinCode: 'ABC-123-XYZ',
      active: true,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
      class: {
        id: 'class-123',
        name: 'CS 101',
        description: 'Intro to Programming',
      },
    };

    it('should get all sections for a user', async () => {
      // Mock the complex nested query response
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                sections: {
                  id: mockSectionWithClass.id,
                  namespace_id: mockSectionWithClass.namespaceId,
                  class_id: mockSectionWithClass.classId,
                  name: mockSectionWithClass.name,
                  semester: mockSectionWithClass.semester,
                  instructor_ids: mockSectionWithClass.instructorIds,
                  join_code: mockSectionWithClass.joinCode,
                  active: mockSectionWithClass.active,
                  created_at: mockSectionWithClass.createdAt.toISOString(),
                  updated_at: mockSectionWithClass.updatedAt.toISOString(),
                  classes: {
                    id: mockSectionWithClass.class.id,
                    name: mockSectionWithClass.class.name,
                    description: mockSectionWithClass.class.description,
                  },
                },
              },
            ],
            error: null,
          }),
        }),
      });

      const result = await repository.getUserSections('user-456');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockSectionWithClass.id);
      expect(result[0].class.name).toBe('CS 101');
    });

    it('should filter sections by role', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      await repository.getUserSections('user-456', undefined, 'student');

      expect(mockFrom).toHaveBeenCalledWith('section_memberships');
    });

    it('should filter sections by namespace', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      await repository.getUserSections('user-456', 'stanford');

      expect(mockFrom).toHaveBeenCalledWith('section_memberships');
    });

    it('should return empty array if user has no sections', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await repository.getUserSections('user-456');

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });

      await expect(repository.getUserSections('user-456'))
        .rejects.toThrow('Failed to get user sections');
    });
  });

  describe('getSectionMembers', () => {
    const mockUser: User = {
      id: 'user-456',
      email: "test@example.com",
      namespaceId: 'stanford',
      role: 'student',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    };

    it('should get all members of a section', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                user_profiles: {
                  id: mockUser.id,
                  email: mockUser.email,
                  namespace_id: mockUser.namespaceId,
                  role: mockUser.role,
                  created_at: mockUser.createdAt.toISOString(),
                },
              },
            ],
            error: null,
          }),
        }),
      });

      const result = await repository.getSectionMembers('section-789');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockUser.id);
      expect(result[0].email).toBe(mockUser.email);
    });

    it('should filter members by role', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      await repository.getSectionMembers('section-789', 'instructor');

      expect(mockFrom).toHaveBeenCalledWith('section_memberships');
    });

    it('should return empty array if section has no members', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await repository.getSectionMembers('section-789');

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });

      await expect(repository.getSectionMembers('section-789'))
        .rejects.toThrow('Failed to get section members');
    });
  });

  describe('isMember', () => {
    it('should return true if user is a member', async () => {
      mockSingle.mockResolvedValue({
        data: { id: 'membership-123' },
        error: null,
      });

      const result = await repository.isMember('user-456', 'section-789');

      expect(result).toBe(true);
    });

    it('should return false if user is not a member', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const result = await repository.isMember('user-456', 'section-789');

      expect(result).toBe(false);
    });

    it('should throw error on query failure', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(repository.isMember('user-456', 'section-789'))
        .rejects.toThrow('Failed to check membership');
    });
  });

  describe('getMembership', () => {
    it('should get a specific membership', async () => {
      mockSingle.mockResolvedValue({
        data: mockMembershipRow,
        error: null,
      });

      const result = await repository.getMembership('user-456', 'section-789');

      expect(result).toBeDefined();
      expect(result!.id).toBe(mockMembership.id);
      expect(result!.userId).toBe(mockMembership.userId);
      expect(result!.sectionId).toBe(mockMembership.sectionId);
    });

    it('should return null if membership not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const result = await repository.getMembership('user-456', 'section-789');

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(repository.getMembership('user-456', 'section-789'))
        .rejects.toThrow('Failed to get membership');
    });
  });

  describe('health', () => {
    it('should return true if database is accessible', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      const result = await repository.health();

      expect(result).toBe(true);
    });

    it('should return false if database query fails', async () => {
      mockLimit.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
      });

      const result = await repository.health();

      expect(result).toBe(false);
    });

    it('should return false if exception is thrown', async () => {
      mockLimit.mockRejectedValue(new Error('Network error'));

      const result = await repository.health();

      expect(result).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await repository.shutdown();

      expect(repository).toBeDefined();
    });

    it('should allow reinitialization after shutdown', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await repository.initialize();
      await repository.shutdown();
      await repository.initialize();

      expect(mockFrom).toHaveBeenCalledTimes(2);
    });
  });
});
