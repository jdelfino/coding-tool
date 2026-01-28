/**
 * @jest-environment jsdom
 */

/**
 * Tests for session ended detection in student page
 *
 * Bug: sessionEnded state was defined but never set to true when
 * instructor closed the session (status changed to 'completed').
 *
 * Fix: Added useEffect to detect session.status === 'completed' and
 * set sessionEnded to true, which triggers SessionEndedNotification.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

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
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => key === 'sessionId' ? 'session-123' : null,
  }),
  useRouter: () => ({
    push: jest.fn(),
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
  });

  it('should not show SessionEndedNotification when session is active', async () => {
    mockUseRealtimeSession.mockReturnValue(baseSessionState);

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.queryByText('Session Ended')).not.toBeInTheDocument();
    });
  });

  it('should show SessionEndedNotification when session status is completed', async () => {
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
      expect(screen.getByText('Session Ended')).toBeInTheDocument();
    });
  });

  it('should show notification when session transitions from active to completed', async () => {
    // Start with active session
    mockUseRealtimeSession.mockReturnValue(baseSessionState);

    const { rerender } = render(<StudentPage />);

    // Verify no notification initially
    expect(screen.queryByText('Session Ended')).not.toBeInTheDocument();

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
      expect(screen.getByText('Session Ended')).toBeInTheDocument();
    });
  });

  it('should make editor read-only when session is completed', async () => {
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
      expect(lastCall.readOnly).toBe(true);
    });
  });

  it('should hide run button when session is completed', async () => {
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
      expect(lastCall.showRunButton).toBe(false);
    });
  });

  it('should not allow running code when session is completed', async () => {
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
      expect(lastCall.onRun).toBeUndefined();
    });
  });

  it('should display code saved message when session ends', async () => {
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
      expect(screen.getByText('Your code has been saved automatically.')).toBeInTheDocument();
    });
  });

  it('should display message about not being able to run code', async () => {
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
      expect(screen.getByText('You can no longer run code, but you can copy your work below.')).toBeInTheDocument();
    });
  });

  it('should display countdown message with auto-redirect when session ends', async () => {
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
      expect(screen.getByTestId('countdown-message')).toBeInTheDocument();
      expect(screen.getByText('Returning to sections in 30 seconds...')).toBeInTheDocument();
    });
  });

  it('should render session-ended notification as an overlay', async () => {
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
      const notification = screen.getByTestId('session-ended-notification');
      expect(notification).toBeInTheDocument();
      // Check it has overlay styling (z-50 class)
      expect(notification.className).toContain('z-50');
    });
  });
});
