/**
 * @jest-environment jsdom
 */

/**
 * Tests for session ended behavior in student page.
 *
 * Covers:
 * - Session ended detection (active -> completed transition)
 * - Practice mode with banner (not overlay)
 * - Navigation via handleLeaveSession
 * - Graceful handling of navigating to a completed session
 * - Practice mode: code editing, running, and saving in completed sessions
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();

// Mock the hooks and components used by the student page
jest.mock('@/hooks/useRealtimeSession');
jest.mock('@/hooks/useSessionHistory', () => ({
  useSessionHistory: () => ({ refetch: jest.fn() }),
}));
jest.mock('@/hooks/useDebugger', () => ({
  useDebugger: () => ({}),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', username: 'TestStudent' },
    signOut: jest.fn(),
  }),
}));
jest.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/contexts/HeaderSlotContext', () => ({
  useHeaderSlot: () => ({ setHeaderSlot: jest.fn() }),
}));
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => key === 'sessionId' ? 'session-123' : null,
  }),
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));
// Mock CodeEditor to avoid Monaco complexity - capture props for testing
const mockCodeEditorProps = jest.fn();
jest.mock('../components/CodeEditor', () => ({
  __esModule: true,
  default: (props: any) => {
    mockCodeEditorProps(props);
    return <div data-testid="code-editor">CodeEditor</div>;
  },
}));
// Mock EditorContainer
jest.mock('../components/EditorContainer', () => ({
  EditorContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { useRealtimeSession } from '@/hooks/useRealtimeSession';

// Import after mocks
const StudentPage = require('../page').default;

const mockUseRealtimeSession = useRealtimeSession as jest.Mock;

describe('Student Page - Session Ended Detection', () => {
  const baseSessionState = {
    session: {
      id: 'session-123',
      problem: { title: 'Test', description: 'Test problem' },
      status: 'active',
    },
    students: [],
    loading: false,
    error: null,
    isConnected: true,
    connectionStatus: 'connected',
    connectionError: null,
    isBroadcastConnected: true,
    updateCode: jest.fn(),
    executeCode: jest.fn(),
    featureStudent: jest.fn(),
    joinSession: jest.fn().mockResolvedValue({}),
    featuredStudent: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCodeEditorProps.mockClear();
    mockPush.mockClear();
    sessionStorage.clear();
  });

  it('should not show SessionEndedNotification when session is active', async () => {
    mockUseRealtimeSession.mockReturnValue(baseSessionState);

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('session-ended-notification')).not.toBeInTheDocument();
    });
  });

  it('should show SessionEndedNotification as a banner when session status is completed', async () => {
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('session-ended-notification')).toBeInTheDocument();
    });

    // Verify it is a banner (not an overlay)
    const notification = screen.getByTestId('session-ended-notification');
    expect(notification.className).not.toContain('absolute');
    expect(notification.className).not.toContain('inset-0');
  });

  it('should show notification when session transitions from active to completed', async () => {
    // Start with active session
    mockUseRealtimeSession.mockReturnValue(baseSessionState);

    const { rerender } = render(<StudentPage />);

    // Verify no notification initially
    expect(screen.queryByTestId('session-ended-notification')).not.toBeInTheDocument();

    // Simulate session ending (status changes to completed via Realtime)
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    rerender(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('session-ended-notification')).toBeInTheDocument();
    });
  });

  it('should allow editing code when session is completed (practice mode)', async () => {
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      expect(mockCodeEditorProps).toHaveBeenCalled();
      const lastCall = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];
      expect(lastCall.readOnly).toBe(false);
    });
  });

  it('should show run button when session is completed (practice mode)', async () => {
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      expect(mockCodeEditorProps).toHaveBeenCalled();
      const lastCall = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];
      expect(lastCall.showRunButton).toBe(true);
    });
  });

  it('should provide onRun handler when session is completed (practice mode)', async () => {
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      expect(mockCodeEditorProps).toHaveBeenCalled();
      const lastCall = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];
      expect(lastCall.onRun).toBeDefined();
    });
  });

  it('should provide onLoadStarterCode handler when session is completed (practice mode)', async () => {
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      expect(mockCodeEditorProps).toHaveBeenCalled();
      const lastCall = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];
      expect(lastCall.onLoadStarterCode).toBeDefined();
    });
  });

  it('should not show countdown or auto-redirect', async () => {
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('session-ended-notification')).toBeInTheDocument();
    });

    // No countdown should be present
    expect(screen.queryByTestId('countdown-message')).not.toBeInTheDocument();
    expect(screen.queryByText(/Returning to sections/)).not.toBeInTheDocument();
  });

  it('should navigate to /sections when Back to Sections is clicked', async () => {
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('go-to-dashboard-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('go-to-dashboard-button'));

    expect(mockPush).toHaveBeenCalledWith('/sections');
  });

  it('should handle navigating to a completed session without errors', async () => {
    // Simulate navigating directly to a completed session
    // The join API would reject this, but the page should handle it gracefully
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      // Should show the editor in read-only mode
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
      // Should show the session ended banner
      expect(screen.getByTestId('session-ended-notification')).toBeInTheDocument();
    });

    // Should NOT have called joinSession (session is already completed)
    expect(baseSessionState.joinSession).not.toHaveBeenCalled();
  });

  it('should not get stuck loading when viewing a completed session without broadcast connection', async () => {
    // Regression: students viewing past sessions got infinite "Connecting..." because
    // the page blocked on broadcast connection, which never connects for completed sessions
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      isConnected: false,
      isBroadcastConnected: false,
      connectionStatus: 'disconnected',
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      // Should render the editor, NOT the loading screen
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    // Should NOT show "Connecting..." or "Loading session..."
    expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading session...')).not.toBeInTheDocument();
  });

  it('should show code editor alongside banner (not hidden behind overlay)', async () => {
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      // Both the banner and the editor should be visible
      expect(screen.getByTestId('session-ended-notification')).toBeInTheDocument();
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });
  });

  it('should save code via debounced update when session is completed (practice mode)', async () => {
    jest.useFakeTimers();
    const mockUpdateCode = jest.fn();

    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      updateCode: mockUpdateCode,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
    });

    render(<StudentPage />);

    await waitFor(() => {
      expect(mockCodeEditorProps).toHaveBeenCalled();
    });

    // Get the onChange handler and simulate code change
    const lastCall = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];
    const onChange = lastCall.onChange;

    // Trigger code change
    act(() => {
      onChange('print("hello world")');
    });

    // Wait for debounce
    jest.advanceTimersByTime(500);

    // Should have called updateCode (code saving should work in practice mode)
    await waitFor(() => {
      expect(mockUpdateCode).toHaveBeenCalled();
    });

    jest.useRealTimers();
  });

  describe('Practice mode execution', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call practice endpoint when running code in completed session', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, output: 'Hello, World!' }),
      });

      mockUseRealtimeSession.mockReturnValue({
        ...baseSessionState,
        session: {
          ...baseSessionState.session,
          status: 'completed',
          endedAt: '2026-01-09T12:00:00Z',
        },
      });

      render(<StudentPage />);

      await waitFor(() => {
        expect(mockCodeEditorProps).toHaveBeenCalled();
      });

      // Get the onChange handler and set code first
      let propsBeforeCodeChange = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];
      act(() => {
        propsBeforeCodeChange.onChange('print("Hello, World!")');
      });

      // Wait for the component to re-render with the new code
      await waitFor(() => {
        const latestProps = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];
        expect(latestProps.code).toBe('print("Hello, World!")');
      });

      // Get the onRun handler from the updated props
      const latestProps = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];

      // Call onRun
      await act(async () => {
        await latestProps.onRun({ stdin: '' });
      });

      // Should have called the practice endpoint, NOT realtimeExecuteCode
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sessions/session-123/practice',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(baseSessionState.executeCode).not.toHaveBeenCalled();
    });

    it('should handle practice endpoint error gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Practice mode execution failed' }),
      });

      mockUseRealtimeSession.mockReturnValue({
        ...baseSessionState,
        session: {
          ...baseSessionState.session,
          status: 'completed',
          endedAt: '2026-01-09T12:00:00Z',
        },
      });

      render(<StudentPage />);

      await waitFor(() => {
        expect(mockCodeEditorProps).toHaveBeenCalled();
      });

      // Get the onChange handler and set code first
      let propsBeforeCodeChange = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];
      act(() => {
        propsBeforeCodeChange.onChange('print("test")');
      });

      // Wait for the component to re-render with the new code
      await waitFor(() => {
        const latestProps = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];
        expect(latestProps.code).toBe('print("test")');
      });

      // Get the onRun handler from the updated props
      const latestProps = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];

      // Call onRun - should handle error without crashing
      await act(async () => {
        await latestProps.onRun({ stdin: '' });
      });

      // Should have called fetch (the error handling happens after)
      expect(global.fetch).toHaveBeenCalled();

      // Should show an error alert (the ErrorAlert component renders role="alert")
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('should not call practice endpoint when code is empty', async () => {
      mockUseRealtimeSession.mockReturnValue({
        ...baseSessionState,
        session: {
          ...baseSessionState.session,
          status: 'completed',
          endedAt: '2026-01-09T12:00:00Z',
        },
      });

      render(<StudentPage />);

      await waitFor(() => {
        expect(mockCodeEditorProps).toHaveBeenCalled();
      });

      const lastCall = mockCodeEditorProps.mock.calls[mockCodeEditorProps.mock.calls.length - 1][0];

      // Don't set any code - leave it empty

      // Call onRun with empty code
      await act(async () => {
        await lastCall.onRun({ stdin: '' });
      });

      // Should NOT have called fetch - validation happens before API call
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
