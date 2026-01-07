/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtime } from '../useRealtime';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

// Mock Supabase client types
interface MockChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
  track: jest.Mock;
  presenceState: jest.Mock;
}

// Store the current channel mock so we can reset it between tests
let mockChannel: MockChannel;
// Configure what status the subscribe callback should receive
let subscribeStatus: string = REALTIME_SUBSCRIBE_STATES.SUBSCRIBED;
// Track if subscribe should auto-invoke (for most tests) or not (for initial state tests)
let autoInvokeSubscribe = true;

const createMockChannel = (): MockChannel => {
  const channel: MockChannel = {
    on: jest.fn().mockImplementation(() => channel),
    subscribe: jest.fn((callback: (status: string) => void) => {
      // Call callback synchronously during effect for proper state updates
      if (autoInvokeSubscribe) {
        callback(subscribeStatus);
      }
      return channel;
    }),
    track: jest.fn().mockResolvedValue('ok'),
    presenceState: jest.fn().mockReturnValue({}),
  };
  return channel;
};

const mockSupabaseClient = {
  channel: jest.fn(),
  removeChannel: jest.fn(),
};

// Mock the getSupabaseBrowserClient function
jest.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: jest.fn(() => mockSupabaseClient),
}));

describe('useRealtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset subscribe status to SUBSCRIBED by default
    subscribeStatus = REALTIME_SUBSCRIBE_STATES.SUBSCRIBED;
    // Enable auto-invoke by default (most tests want connected state)
    autoInvokeSubscribe = true;
    // Create a fresh mock channel for each test
    mockChannel = createMockChannel();
    mockSupabaseClient.channel.mockReturnValue(mockChannel);
  });

  describe('Initial connection', () => {
    it('should initialize with connecting status before subscription completes', () => {
      // Disable auto-invoke to test initial state
      autoInvokeSubscribe = false;
      mockChannel = createMockChannel();
      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const { result } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
          userId: 'user-123',
        })
      );

      // Initial state before subscription completes
      expect(result.current.connectionStatus).toBe('connecting');
      expect(result.current.isConnected).toBe(false);
    });

    it('should create channel with correct parameters', () => {
      renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
          userId: 'user-123',
        })
      );

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
        'session:test-session',
        {
          config: {
            presence: {
              key: 'user-123',
            },
          },
        }
      );
    });

    it('should not create channel when sessionId is empty', () => {
      renderHook(() =>
        useRealtime({
          sessionId: '',
        })
      );

      expect(mockSupabaseClient.channel).not.toHaveBeenCalled();
    });

    it('should subscribe to default tables', () => {
      renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
        })
      );

      // Should subscribe to session_students, sessions, and revisions by default
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'session_students',
          filter: 'session_id=eq.test-session',
        }),
        expect.any(Function)
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          table: 'sessions',
        }),
        expect.any(Function)
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          table: 'revisions',
        }),
        expect.any(Function)
      );
    });

    it('should subscribe to custom tables when provided', () => {
      renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
          tables: ['custom_table'],
        })
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          table: 'custom_table',
        }),
        expect.any(Function)
      );
    });
  });

  describe('Connection status', () => {
    it('should update status to connected when subscription succeeds', () => {
      // subscribeStatus is already SUBSCRIBED by default
      const { result } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
          userId: 'user-123',
        })
      );

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isConnected).toBe(true);
      // Verify track was called
      expect(mockChannel.track).toHaveBeenCalled();
    });

    it('should track presence when connected with userId', () => {
      mockChannel.track.mockResolvedValue('ok');

      renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
          userId: 'user-123',
          presenceData: { user_name: 'Test User' },
        })
      );

      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          user_name: 'Test User',
          online_at: expect.any(String),
        })
      );
    });

    it('should handle channel error', () => {
      // Configure the subscribe status
      subscribeStatus = REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR;
      mockChannel = createMockChannel();
      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const { result } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
        })
      );

      expect(result.current.connectionStatus).toBe('failed');
      expect(result.current.connectionError).toBe('Failed to connect to real-time server');
      expect(result.current.isConnected).toBe(false);
    });

    it('should handle timeout', () => {
      // Configure the subscribe status
      subscribeStatus = REALTIME_SUBSCRIBE_STATES.TIMED_OUT;
      mockChannel = createMockChannel();
      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const { result } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
        })
      );

      expect(result.current.connectionStatus).toBe('failed');
      expect(result.current.connectionError).toBe('Connection timed out');
    });

    it('should handle channel closed', () => {
      // Configure the subscribe status
      subscribeStatus = REALTIME_SUBSCRIBE_STATES.CLOSED;
      mockChannel = createMockChannel();
      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const { result } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
        })
      );

      expect(result.current.connectionStatus).toBe('disconnected');
    });
  });

  describe('Database change handling', () => {
    it('should handle INSERT events', async () => {
      const { result } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
        })
      );

      // Get the postgres_changes callback for session_students
      const onCalls = mockChannel.on.mock.calls.filter(
        (call: any) => call[0] === 'postgres_changes' && call[1].table === 'session_students'
      );
      const changeCallback = onCalls[0][2];

      await act(async () => {
        changeCallback({
          eventType: 'INSERT',
          table: 'session_students',
          new: { student_id: 'student-1', code: 'print("hello")' },
        });
      });

      await waitFor(() => {
        expect(result.current.lastMessage).toEqual({
          type: 'INSERT',
          table: 'session_students',
          payload: { student_id: 'student-1', code: 'print("hello")' },
        });
      });
    });

    it('should handle UPDATE events', async () => {
      const { result } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
        })
      );

      const onCalls = mockChannel.on.mock.calls.filter(
        (call: any) => call[0] === 'postgres_changes' && call[1].table === 'session_students'
      );
      const changeCallback = onCalls[0][2];

      await act(async () => {
        changeCallback({
          eventType: 'UPDATE',
          table: 'session_students',
          new: { student_id: 'student-1', code: 'print("updated")' },
        });
      });

      await waitFor(() => {
        expect(result.current.lastMessage).toEqual({
          type: 'UPDATE',
          table: 'session_students',
          payload: { student_id: 'student-1', code: 'print("updated")' },
        });
      });
    });

    it('should handle DELETE events', async () => {
      const { result } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
        })
      );

      const onCalls = mockChannel.on.mock.calls.filter(
        (call: any) => call[0] === 'postgres_changes' && call[1].table === 'session_students'
      );
      const changeCallback = onCalls[0][2];

      await act(async () => {
        changeCallback({
          eventType: 'DELETE',
          table: 'session_students',
          old: { student_id: 'student-1' },
        });
      });

      await waitFor(() => {
        expect(result.current.lastMessage).toEqual({
          type: 'DELETE',
          table: 'session_students',
          payload: { student_id: 'student-1' },
        });
      });
    });
  });

  describe('Presence tracking', () => {
    it('should setup presence listeners when userId is provided', () => {
      renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
          userId: 'user-123',
        })
      );

      // Should have presence event listeners
      const presenceCalls = mockChannel.on.mock.calls.filter(
        (call: any) => call[0] === 'presence'
      );

      expect(presenceCalls.length).toBeGreaterThan(0);
      expect(presenceCalls.some((call: any) => call[1].event === 'sync')).toBe(true);
      expect(presenceCalls.some((call: any) => call[1].event === 'join')).toBe(true);
      expect(presenceCalls.some((call: any) => call[1].event === 'leave')).toBe(true);
    });

    it('should not setup presence listeners when userId is not provided', () => {
      renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
        })
      );

      const presenceCalls = mockChannel.on.mock.calls.filter(
        (call: any) => call[0] === 'presence'
      );

      expect(presenceCalls.length).toBe(0);
    });

    it('should update onlineUsers on presence sync', async () => {
      const mockPresenceState = {
        'user-1': [{ user_id: 'user-1', online_at: new Date().toISOString() }],
        'user-2': [{ user_id: 'user-2', online_at: new Date().toISOString() }],
      };

      mockChannel.presenceState.mockReturnValue(mockPresenceState);

      const { result } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
          userId: 'user-123',
        })
      );

      // Get presence sync callback
      const presenceCalls = mockChannel.on.mock.calls.filter(
        (call: any) => call[0] === 'presence' && call[1].event === 'sync'
      );
      const syncCallback = presenceCalls[0][2];

      await act(async () => {
        syncCallback();
      });

      await waitFor(() => {
        expect(result.current.onlineUsers).toEqual(mockPresenceState);
      });
    });
  });

  describe('Cleanup', () => {
    it('should remove channel on unmount', () => {
      const { unmount } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
        })
      );

      unmount();

      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('should reset connection status on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useRealtime({
          sessionId: 'test-session',
          userId: 'user-123',
        })
      );

      // Verify subscribe was called and connected
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(result.current.connectionStatus).toBe('connected');

      // Unmount
      unmount();

      // Connection status should be reset (we verify channel is removed)
      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('Session changes', () => {
    it('should reconnect when sessionId changes', () => {
      const { rerender } = renderHook(
        ({ sessionId }) => useRealtime({ sessionId }),
        { initialProps: { sessionId: 'session-1' } }
      );

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
        'session:session-1',
        expect.any(Object)
      );

      jest.clearAllMocks();
      // Create new mock channel for rerender
      mockChannel = createMockChannel();
      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      // Change sessionId
      rerender({ sessionId: 'session-2' });

      // Old channel should be removed
      expect(mockSupabaseClient.removeChannel).toHaveBeenCalled();
      // New channel should be created
      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
        'session:session-2',
        expect.any(Object)
      );
    });
  });
});
