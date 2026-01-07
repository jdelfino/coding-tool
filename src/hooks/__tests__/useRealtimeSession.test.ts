/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeSession } from '../useRealtimeSession';

// Mock useRealtime hook
const mockUseRealtime: any = {
  isConnected: true,
  connectionStatus: 'connected' as const,
  connectionError: null,
  lastMessage: null,
  onlineUsers: {},
};

jest.mock('../useRealtime', () => ({
  useRealtime: jest.fn(() => mockUseRealtime),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useRealtimeSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Don't use fake timers globally - only enable for tests that need them (debounce tests)
    // jest.useFakeTimers() interferes with async Promise resolution in waitFor()

    // Reset mock useRealtime
    Object.assign(mockUseRealtime, {
      isConnected: true,
      connectionStatus: 'connected' as const,
      connectionError: null,
      lastMessage: null,
      onlineUsers: {},
    });
  });

  describe('Initial state loading', () => {
    it('should load initial session state on mount', async () => {
      const mockState = {
        session: {
          id: 'session-1',
          namespaceId: 'namespace-1',
          problem: { title: 'Test Problem', description: 'Test' },
        },
        students: [
          { id: 'student-1', name: 'Alice', code: '', lastUpdate: new Date().toISOString() },
        ],
        featuredStudent: { studentId: 'student-1', code: '' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockState,
      });

      const { result } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
          userId: 'user-1',
        })
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/session-1/state',
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(result.current.session).toEqual(mockState.session);
      expect(result.current.students).toHaveLength(1);
      expect(result.current.students[0].id).toBe('student-1');
      expect(result.current.featuredStudent).toEqual(mockState.featuredStudent);
    });

    it('should handle loading errors', async () => {
      // Include status code so fetchWithRetry doesn't retry
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Session not found' }),
      });

      const { result } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'nonexistent',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Session not found');
    });

    it('should only load state once', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          session: {},
          students: [],
          featuredStudent: {},
        }),
      });

      const { rerender } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Rerender should not trigger another fetch
      rerender();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Realtime message handling', () => {
    beforeEach(async () => {
      // Setup initial state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: { id: 'session-1' },
          students: [],
          featuredStudent: {},
        }),
      });
    });

    it('should handle session_students INSERT messages', async () => {
      const { result, rerender } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate Realtime message and rerender to trigger effect
      mockUseRealtime.lastMessage = {
        type: 'INSERT' as const,
        table: 'session_students',
        payload: {
          student_id: 'student-1',
          student_name: 'Alice',
          code: 'print("hello")',
          last_update: new Date().toISOString(),
        },
      };
      rerender();

      expect(result.current.students).toHaveLength(1);
      expect(result.current.students[0].id).toBe('student-1');
      expect(result.current.students[0].name).toBe('Alice');
      expect(result.current.students[0].code).toBe('print("hello")');
    });

    it('should handle session_students UPDATE messages', async () => {
      const { result, rerender } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Insert student first
      mockUseRealtime.lastMessage = {
        type: 'INSERT' as const,
        table: 'session_students',
        payload: {
          student_id: 'student-1',
          student_name: 'Alice',
          code: '',
          last_update: new Date().toISOString(),
        },
      };
      rerender();

      expect(result.current.students).toHaveLength(1);

      // Update student code
      mockUseRealtime.lastMessage = {
        type: 'UPDATE' as const,
        table: 'session_students',
        payload: {
          student_id: 'student-1',
          student_name: 'Alice',
          code: 'print("updated")',
          last_update: new Date().toISOString(),
        },
      };
      rerender();

      expect(result.current.students[0].code).toBe('print("updated")');
    });

    it('should handle session_students DELETE messages', async () => {
      const { result, rerender } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Insert student
      mockUseRealtime.lastMessage = {
        type: 'INSERT' as const,
        table: 'session_students',
        payload: {
          student_id: 'student-1',
          student_name: 'Alice',
          code: '',
          last_update: new Date().toISOString(),
        },
      };
      rerender();

      expect(result.current.students).toHaveLength(1);

      // Delete student
      mockUseRealtime.lastMessage = {
        type: 'DELETE' as const,
        table: 'session_students',
        payload: {
          student_id: 'student-1',
        },
      };
      rerender();

      expect(result.current.students).toHaveLength(0);
    });

    it('should handle sessions UPDATE messages (featured student)', async () => {
      const { result, rerender } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockUseRealtime.lastMessage = {
        type: 'UPDATE' as const,
        table: 'sessions',
        payload: {
          featured_student_id: 'student-1',
          featured_code: 'print("featured")',
        },
      };
      rerender();

      expect(result.current.featuredStudent.studentId).toBe('student-1');
      expect(result.current.featuredStudent.code).toBe('print("featured")');
    });
  });

  describe('updateCode action', () => {
    // These tests need fake timers for debounce testing
    beforeEach(() => {
      jest.useFakeTimers();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce code updates', async () => {
      // First setup initial state fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: { id: 'session-1' },
          students: [],
          featuredStudent: {},
        }),
      });

      const { result } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      // Flush the initial state load
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(result.current.loading).toBe(false);

      // Reset fetch mock call count
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      // Call updateCode multiple times rapidly
      act(() => {
        result.current.updateCode('student-1', 'a');
        result.current.updateCode('student-1', 'ab');
        result.current.updateCode('student-1', 'abc');
      });

      // Advance timers to trigger debounce and flush promises
      await act(async () => {
        jest.advanceTimersByTime(300);
        await jest.runAllTimersAsync();
      });

      // Should only make one API call due to debouncing
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/session-1/code',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            studentId: 'student-1',
            code: 'abc',
          }),
        })
      );
    });

    it('should update local state optimistically', async () => {
      // Setup initial state with a student
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: { id: 'session-1' },
          students: [
            {
              id: 'student-1',
              name: 'Alice',
              code: '',
              lastUpdate: new Date().toISOString(),
            },
          ],
          featuredStudent: {},
        }),
      });

      const { result } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      // Flush the initial state load
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(result.current.loading).toBe(false);

      // Setup response for code update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      // Update code and advance timers
      act(() => {
        result.current.updateCode('student-1', 'print("new code")');
      });

      await act(async () => {
        jest.advanceTimersByTime(300);
        await jest.runAllTimersAsync();
      });

      const student = result.current.students.find(s => s.id === 'student-1');
      expect(student?.code).toBe('print("new code")');
    });
  });

  describe('executeCode action', () => {
    it('should execute code and return result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {},
          students: [],
          featuredStudent: {},
        }),
      });

      const { result } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mockResult = {
        success: true,
        output: 'Hello, World!',
        error: '',
        executionTime: 123,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      let execResult;
      await act(async () => {
        execResult = await result.current.executeCode('student-1', 'print("Hello, World!")');
      });

      expect(execResult).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/session-1/execute',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            studentId: 'student-1',
            code: 'print("Hello, World!")',
          }),
        })
      );
    });

    it('should throw error on execute failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {},
          students: [],
          featuredStudent: {},
        }),
      });

      const { result } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Include status code so fetchWithRetry doesn't retry
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Execution failed' }),
      });

      await act(async () => {
        await expect(
          result.current.executeCode('student-1', 'invalid code')
        ).rejects.toThrow('Execution failed');
      });
    });
  });

  describe('featureStudent action', () => {
    it('should feature a student', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {},
          students: [
            {
              id: 'student-1',
              name: 'Alice',
              code: 'print("hello")',
              lastUpdate: new Date().toISOString(),
            },
          ],
          featuredStudent: {},
        }),
      });

      const { result } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await act(async () => {
        await result.current.featureStudent('student-1');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/session-1/feature',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            studentId: 'student-1',
          }),
        })
      );

      // Should optimistically update featured student
      expect(result.current.featuredStudent.studentId).toBe('student-1');
    });
  });

  describe('joinSession action', () => {
    it('should join a session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {},
          students: [],
          featuredStudent: {},
        }),
      });

      const { result } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, student: { id: 'student-1', name: 'Alice' } }),
      });

      let joinResult;
      await act(async () => {
        joinResult = await result.current.joinSession('student-1', 'Alice');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/session-1/join',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            studentId: 'student-1',
            name: 'Alice',
          }),
        })
      );

      expect(joinResult).toEqual({ success: true, student: { id: 'student-1', name: 'Alice' } });
    });
  });

  describe('Error handling with retry', () => {
    // This test needs fake timers for retry backoff delays
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry failed requests', async () => {
      // First call: network error, then success
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            session: {},
            students: [],
            featuredStudent: {},
          }),
        });

      renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
        })
      );

      // Advance timers to allow retries (1000ms + 2000ms backoff delays)
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1000); // First retry delay
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000); // Second retry delay
      });

      // Should have retried and eventually succeeded
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Connection status', () => {
    it('should expose connection status from useRealtime', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          session: {},
          students: [],
          featuredStudent: {},
        }),
      });

      const { result } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
          userId: 'user-1',
        })
      );

      // Connection status comes from useRealtime mock, available immediately
      expect(result.current.isConnected).toBe(true);
      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.connectionError).toBe(null);

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should expose online users from presence', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          session: {},
          students: [],
          featuredStudent: {},
        }),
      });

      mockUseRealtime.onlineUsers = {
        'user-1': [{ user_id: 'user-1' }],
        'user-2': [{ user_id: 'user-2' }],
      };

      const { result } = renderHook(() =>
        useRealtimeSession({
          sessionId: 'session-1',
          userId: 'user-1',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.onlineUsers).toEqual(mockUseRealtime.onlineUsers);
    });
  });
});
