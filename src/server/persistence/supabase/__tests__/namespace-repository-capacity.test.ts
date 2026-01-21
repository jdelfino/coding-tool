/**
 * Unit tests for SupabaseNamespaceRepository capacity methods
 *
 * Tests getCapacityUsage() and updateCapacityLimits() functionality.
 */

import { SupabaseNamespaceRepository } from '../namespace-repository';

// Helper to create chainable mock
const createChainMock = () => {
  const chain: Record<string, jest.Mock> = {};

  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn();
  chain.limit = jest.fn();

  return chain;
};

const mockFrom = jest.fn();

jest.mock('../../../supabase/client', () => ({
  getSupabaseClientWithAuth: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('SupabaseNamespaceRepository - Capacity Methods', () => {
  let repository: SupabaseNamespaceRepository;

  const mockNamespaceRow = {
    id: 'test-namespace',
    display_name: 'Test Namespace',
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: 'admin-123',
    updated_at: '2026-01-01T00:00:00.000Z',
    max_instructors: 10,
    max_students: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation(() => createChainMock());
    repository = new SupabaseNamespaceRepository('test-token');
  });

  describe('getCapacityUsage', () => {
    it('returns capacity usage for namespace with users', async () => {
      // Mock chain for getNamespace call
      const namespaceChain = createChainMock();
      namespaceChain.single.mockResolvedValue({
        data: mockNamespaceRow,
        error: null,
      });

      // Mock chain for instructor count
      const instructorChain = createChainMock();
      instructorChain.eq.mockReturnValue({
        ...instructorChain,
        eq: jest.fn().mockResolvedValue({ count: 3, error: null }),
      });

      // Mock chain for student count
      const studentChain = createChainMock();
      studentChain.eq.mockReturnValue({
        ...studentChain,
        eq: jest.fn().mockResolvedValue({ count: 25, error: null }),
      });

      mockFrom
        .mockReturnValueOnce(namespaceChain) // getNamespace
        .mockReturnValueOnce(instructorChain) // instructor count
        .mockReturnValueOnce(studentChain); // student count

      const result = await repository.getCapacityUsage('test-namespace');

      expect(result).toEqual({
        instructorCount: 3,
        studentCount: 25,
        maxInstructors: 10,
        maxStudents: 100,
      });
    });

    it('returns zeros for empty namespace', async () => {
      const namespaceChain = createChainMock();
      namespaceChain.single.mockResolvedValue({
        data: {
          ...mockNamespaceRow,
          max_instructors: null,
          max_students: null,
        },
        error: null,
      });

      const countChain = createChainMock();
      countChain.eq.mockReturnValue({
        ...countChain,
        eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
      });

      mockFrom
        .mockReturnValueOnce(namespaceChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(countChain);

      const result = await repository.getCapacityUsage('test-namespace');

      expect(result).toEqual({
        instructorCount: 0,
        studentCount: 0,
        maxInstructors: null,
        maxStudents: null,
      });
    });

    it('returns null for non-existent namespace', async () => {
      const namespaceChain = createChainMock();
      namespaceChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockFrom.mockReturnValue(namespaceChain);

      const result = await repository.getCapacityUsage('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null limits when not set', async () => {
      const namespaceChain = createChainMock();
      namespaceChain.single.mockResolvedValue({
        data: {
          ...mockNamespaceRow,
          max_instructors: null,
          max_students: null,
        },
        error: null,
      });

      const countChain = createChainMock();
      countChain.eq.mockReturnValue({
        ...countChain,
        eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
      });

      mockFrom
        .mockReturnValueOnce(namespaceChain)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(countChain);

      const result = await repository.getCapacityUsage('test-namespace');

      expect(result).not.toBeNull();
      expect(result!.maxInstructors).toBeNull();
      expect(result!.maxStudents).toBeNull();
    });

    it('throws error when instructor count fails', async () => {
      const namespaceChain = createChainMock();
      namespaceChain.single.mockResolvedValue({
        data: mockNamespaceRow,
        error: null,
      });

      const instructorChain = createChainMock();
      instructorChain.eq.mockReturnValue({
        ...instructorChain,
        eq: jest.fn().mockResolvedValue({
          count: null,
          error: { message: 'Count failed' },
        }),
      });

      mockFrom
        .mockReturnValueOnce(namespaceChain)
        .mockReturnValueOnce(instructorChain);

      await expect(repository.getCapacityUsage('test-namespace')).rejects.toThrow(
        'Failed to count instructors'
      );
    });

    it('throws error when student count fails', async () => {
      const namespaceChain = createChainMock();
      namespaceChain.single.mockResolvedValue({
        data: mockNamespaceRow,
        error: null,
      });

      const instructorChain = createChainMock();
      instructorChain.eq.mockReturnValue({
        ...instructorChain,
        eq: jest.fn().mockResolvedValue({ count: 3, error: null }),
      });

      const studentChain = createChainMock();
      studentChain.eq.mockReturnValue({
        ...studentChain,
        eq: jest.fn().mockResolvedValue({
          count: null,
          error: { message: 'Count failed' },
        }),
      });

      mockFrom
        .mockReturnValueOnce(namespaceChain)
        .mockReturnValueOnce(instructorChain)
        .mockReturnValueOnce(studentChain);

      await expect(repository.getCapacityUsage('test-namespace')).rejects.toThrow(
        'Failed to count students'
      );
    });
  });

  describe('updateCapacityLimits', () => {
    it('sets new limits', async () => {
      const updateChain = createChainMock();
      updateChain.eq.mockResolvedValue({ error: null });

      mockFrom.mockReturnValue(updateChain);

      await repository.updateCapacityLimits('test-namespace', {
        maxInstructors: 20,
        maxStudents: 200,
      });

      expect(mockFrom).toHaveBeenCalledWith('namespaces');
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          max_instructors: 20,
          max_students: 200,
        })
      );
    });

    it('can clear limits (set to null)', async () => {
      const updateChain = createChainMock();
      updateChain.eq.mockResolvedValue({ error: null });

      mockFrom.mockReturnValue(updateChain);

      await repository.updateCapacityLimits('test-namespace', {
        maxInstructors: null,
        maxStudents: null,
      });

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          max_instructors: null,
          max_students: null,
        })
      );
    });

    it('can update only maxInstructors', async () => {
      const updateChain = createChainMock();
      updateChain.eq.mockResolvedValue({ error: null });

      mockFrom.mockReturnValue(updateChain);

      await repository.updateCapacityLimits('test-namespace', {
        maxInstructors: 15,
      });

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          max_instructors: 15,
        })
      );
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.not.objectContaining({
          max_students: expect.anything(),
        })
      );
    });

    it('can update only maxStudents', async () => {
      const updateChain = createChainMock();
      updateChain.eq.mockResolvedValue({ error: null });

      mockFrom.mockReturnValue(updateChain);

      await repository.updateCapacityLimits('test-namespace', {
        maxStudents: 150,
      });

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          max_students: 150,
        })
      );
    });

    it('throws error on database failure', async () => {
      const updateChain = createChainMock();
      updateChain.eq.mockResolvedValue({
        error: { message: 'Update failed' },
      });

      mockFrom.mockReturnValue(updateChain);

      await expect(
        repository.updateCapacityLimits('test-namespace', {
          maxInstructors: 20,
        })
      ).rejects.toThrow('Failed to update capacity limits');
    });
  });
});
