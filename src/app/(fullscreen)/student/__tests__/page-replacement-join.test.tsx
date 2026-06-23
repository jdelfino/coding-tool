/**
 * @jest-environment jsdom
 */

/**
 * Regression tests for the replacement-session join behavior in the student page.
 *
 * Bug (coding-6aa.10): when an instructor replaced a live session, the student's
 * auto-join effect spuriously re-joined the OLD (now-completed) session via the
 * `status === 'completed'` branch. That spurious join set `joined` back to true,
 * which suppressed joining the replacement session and left the instructor's
 * student list empty.
 *
 * The fix: the auto-join effect must NOT (re)join a session that has been
 * replaced (i.e. when `replacementInfo` is set).
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();

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
    get: (key: string) => (key === 'sessionId' ? 'old-session' : null),
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
jest.mock('../components/CodeEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="code-editor">CodeEditor</div>,
}));
jest.mock('../components/EditorContainer', () => ({
  EditorContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { useRealtimeSession } from '@/hooks/useRealtimeSession';

const StudentPage = require('../page').default;
const mockUseRealtimeSession = useRealtimeSession as jest.Mock;

describe('Student Page - Replacement session join', () => {
  const baseSessionState = {
    session: {
      id: 'old-session',
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
    replacementInfo: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    sessionStorage.clear();
  });

  it('does NOT re-join a session that has been replaced', async () => {
    const joinSession = jest.fn().mockResolvedValue({});
    // The current session was ended by a replacement: status is completed AND
    // replacementInfo points at the new session. This is exactly the state that
    // previously triggered a spurious re-join of the old session.
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      joinSession,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
      replacementInfo: { newSessionId: 'new-session' },
    });

    render(<StudentPage />);

    // Give the auto-join effect a chance to (incorrectly) fire.
    await waitFor(() => {
      expect(mockUseRealtimeSession).toHaveBeenCalled();
    });

    expect(joinSession).not.toHaveBeenCalled();
  });

  it('still auto-joins a completed session that was NOT replaced (practice mode)', async () => {
    const joinSession = jest.fn().mockResolvedValue({});
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      joinSession,
      session: {
        ...baseSessionState.session,
        status: 'completed',
        endedAt: '2026-01-09T12:00:00Z',
      },
      replacementInfo: null,
    });

    render(<StudentPage />);

    await waitFor(() => {
      expect(joinSession).toHaveBeenCalledWith('user-1', 'Student');
    });
  });

  it('auto-joins an active session that was NOT replaced', async () => {
    const joinSession = jest.fn().mockResolvedValue({});
    mockUseRealtimeSession.mockReturnValue({
      ...baseSessionState,
      joinSession,
      replacementInfo: null,
    });

    render(<StudentPage />);

    await waitFor(() => {
      expect(joinSession).toHaveBeenCalledWith('user-1', 'Student');
    });
  });
});
