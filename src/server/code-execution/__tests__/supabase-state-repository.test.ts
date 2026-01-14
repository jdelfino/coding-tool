/**
 * Unit tests for SupabaseBackendStateRepository
 *
 * Tests the backend state repository implementation using Supabase's session_sandboxes table.
 * Uses Jest mocks for Supabase client isolation.
 */

import { SupabaseBackendStateRepository } from '../supabase-state-repository';

// Mock the Supabase client module
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockUpsert = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

jest.mock('../../supabase/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('SupabaseBackendStateRepository', () => {
  let repository: SupabaseBackendStateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new SupabaseBackendStateRepository();
  });

  describe('assignBackend', () => {
    it('should upsert a row to assign backend to session', async () => {
      mockFrom.mockReturnValue({
        upsert: mockUpsert.mockResolvedValue({ data: null, error: null }),
      });

      await repository.assignBackend('session-123', 'vercel-sandbox');

      expect(mockFrom).toHaveBeenCalledWith('session_sandboxes');
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          session_id: 'session-123',
          sandbox_id: 'pending-vercel-sandbox',
        },
        { onConflict: 'session_id' }
      );
    });

    it('should throw error on upsert failure', async () => {
      mockFrom.mockReturnValue({
        upsert: mockUpsert.mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(
        repository.assignBackend('session-123', 'vercel-sandbox')
      ).rejects.toThrow('Failed to assign backend: Database error');
    });
  });

  describe('getAssignedBackend', () => {
    it('should return vercel-sandbox if row exists', async () => {
      const mockSingleResult = jest.fn().mockResolvedValue({
        data: { session_id: 'session-123' },
        error: null,
      });
      const mockEqResult = jest.fn().mockReturnValue({ single: mockSingleResult });
      const mockSelectResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        select: mockSelectResult,
      });

      const result = await repository.getAssignedBackend('session-123');

      expect(mockFrom).toHaveBeenCalledWith('session_sandboxes');
      expect(mockSelectResult).toHaveBeenCalledWith('session_id');
      expect(mockEqResult).toHaveBeenCalledWith('session_id', 'session-123');
      expect(result).toBe('vercel-sandbox');
    });

    it('should return null if row does not exist', async () => {
      const mockSingleResult = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      const mockEqResult = jest.fn().mockReturnValue({ single: mockSingleResult });
      const mockSelectResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        select: mockSelectResult,
      });

      const result = await repository.getAssignedBackend('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      const mockSingleResult = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Connection failed' },
      });
      const mockEqResult = jest.fn().mockReturnValue({ single: mockSingleResult });
      const mockSelectResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        select: mockSelectResult,
      });

      await expect(repository.getAssignedBackend('session-123')).rejects.toThrow(
        'Failed to get assigned backend: Connection failed'
      );
    });
  });

  describe('saveState', () => {
    it('should upsert sandbox_id from state', async () => {
      mockFrom.mockReturnValue({
        upsert: mockUpsert.mockResolvedValue({ data: null, error: null }),
      });

      await repository.saveState('session-123', { sandboxId: 'sandbox-abc-123' });

      expect(mockFrom).toHaveBeenCalledWith('session_sandboxes');
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          session_id: 'session-123',
          sandbox_id: 'sandbox-abc-123',
        },
        { onConflict: 'session_id' }
      );
    });

    it('should throw error if sandboxId is missing', async () => {
      await expect(
        repository.saveState('session-123', { foo: 'bar' })
      ).rejects.toThrow('saveState requires state.sandboxId');
    });

    it('should throw error on upsert failure', async () => {
      mockFrom.mockReturnValue({
        upsert: mockUpsert.mockResolvedValue({
          data: null,
          error: { message: 'Insert failed' },
        }),
      });

      await expect(
        repository.saveState('session-123', { sandboxId: 'sandbox-abc' })
      ).rejects.toThrow('Failed to save state: Insert failed');
    });
  });

  describe('getState', () => {
    it('should return state with sandboxId if row exists', async () => {
      const mockSingleResult = jest.fn().mockResolvedValue({
        data: { sandbox_id: 'sandbox-xyz-789' },
        error: null,
      });
      const mockEqResult = jest.fn().mockReturnValue({ single: mockSingleResult });
      const mockSelectResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        select: mockSelectResult,
      });

      const result = await repository.getState('session-123');

      expect(mockFrom).toHaveBeenCalledWith('session_sandboxes');
      expect(mockSelectResult).toHaveBeenCalledWith('sandbox_id');
      expect(mockEqResult).toHaveBeenCalledWith('session_id', 'session-123');
      expect(result).toEqual({ sandboxId: 'sandbox-xyz-789' });
    });

    it('should return null if row does not exist', async () => {
      const mockSingleResult = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      const mockEqResult = jest.fn().mockReturnValue({ single: mockSingleResult });
      const mockSelectResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        select: mockSelectResult,
      });

      const result = await repository.getState('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      const mockSingleResult = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Database error' },
      });
      const mockEqResult = jest.fn().mockReturnValue({ single: mockSingleResult });
      const mockSelectResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        select: mockSelectResult,
      });

      await expect(repository.getState('session-123')).rejects.toThrow(
        'Failed to get state: Database error'
      );
    });
  });

  describe('deleteState', () => {
    it('should delete the row for the session', async () => {
      const mockEqResult = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockDeleteResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        delete: mockDeleteResult,
      });

      await repository.deleteState('session-123');

      expect(mockFrom).toHaveBeenCalledWith('session_sandboxes');
      expect(mockDeleteResult).toHaveBeenCalled();
      expect(mockEqResult).toHaveBeenCalledWith('session_id', 'session-123');
    });

    it('should throw error on delete failure', async () => {
      const mockEqResult = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });
      const mockDeleteResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        delete: mockDeleteResult,
      });

      await expect(repository.deleteState('session-123')).rejects.toThrow(
        'Failed to delete state: Delete failed'
      );
    });

    it('should succeed even if row does not exist', async () => {
      // Supabase delete does not error on missing rows
      const mockEqResult = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockDeleteResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        delete: mockDeleteResult,
      });

      await expect(repository.deleteState('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('hasState', () => {
    it('should return true if row exists', async () => {
      const mockSingleResult = jest.fn().mockResolvedValue({
        data: { session_id: 'session-123' },
        error: null,
      });
      const mockEqResult = jest.fn().mockReturnValue({ single: mockSingleResult });
      const mockSelectResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        select: mockSelectResult,
      });

      const result = await repository.hasState('session-123');

      expect(mockFrom).toHaveBeenCalledWith('session_sandboxes');
      expect(mockSelectResult).toHaveBeenCalledWith('session_id');
      expect(mockEqResult).toHaveBeenCalledWith('session_id', 'session-123');
      expect(result).toBe(true);
    });

    it('should return false if row does not exist', async () => {
      const mockSingleResult = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      const mockEqResult = jest.fn().mockReturnValue({ single: mockSingleResult });
      const mockSelectResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        select: mockSelectResult,
      });

      const result = await repository.hasState('nonexistent');

      expect(result).toBe(false);
    });

    it('should throw error on query failure', async () => {
      const mockSingleResult = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Connection error' },
      });
      const mockEqResult = jest.fn().mockReturnValue({ single: mockSingleResult });
      const mockSelectResult = jest.fn().mockReturnValue({ eq: mockEqResult });

      mockFrom.mockReturnValue({
        select: mockSelectResult,
      });

      await expect(repository.hasState('session-123')).rejects.toThrow(
        'Failed to check state: Connection error'
      );
    });
  });
});
