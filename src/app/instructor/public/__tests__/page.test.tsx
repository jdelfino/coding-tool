/**
 * Unit tests for the public instructor view component
 * Tests behavior of the public display page including:
 * - Loading state from API
 * - Realtime updates via useRealtime hook
 * - Conditional polling (only when disconnected)
 * - State management
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(() => ({
    get: jest.fn((key: string) => (key === 'sessionId' ? 'test-session-id' : null))
  })),
}));

// Mock useRealtime hook
const mockUseRealtime = jest.fn();
jest.mock('@/hooks/useRealtime', () => ({
  useRealtime: (options: any) => mockUseRealtime(options),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock useApiDebugger hook
const mockDebuggerHook = {
  trace: null,
  currentStep: 0,
  isLoading: false,
  error: null,
  requestTrace: jest.fn(),
  setTrace: jest.fn(),
  setError: jest.fn(),
  stepForward: jest.fn(),
  stepBackward: jest.fn(),
  jumpToStep: jest.fn(),
  jumpToFirst: jest.fn(),
  jumpToLast: jest.fn(),
  reset: jest.fn(),
  getCurrentStep: jest.fn(),
  getCurrentLocals: jest.fn(),
  getCurrentGlobals: jest.fn(),
  getCurrentCallStack: jest.fn(),
  getPreviousStep: jest.fn(),
  totalSteps: 0,
  hasTrace: false,
  canStepForward: false,
  canStepBackward: false,
};
jest.mock('@/hooks/useApiDebugger', () => ({
  useApiDebugger: () => mockDebuggerHook,
}));

// Track props passed to CodeEditor
let lastCodeEditorProps: any = null;

// Mock CodeEditor component
jest.mock('@/app/student/components/CodeEditor', () => {
  return function MockCodeEditor(props: any) {
    lastCodeEditorProps = props;
    return (
      <div data-testid="code-editor">
        <div data-testid="code-title">{props.title}</div>
        <div data-testid="code-content">{props.code}</div>
        {props.debugger && <div data-testid="debugger-present">Debugger</div>}
      </div>
    );
  };
});

// Default mock return values for useRealtime
const createMockRealtimeReturn = (overrides = {}) => ({
  isConnected: true,
  connectionStatus: 'connected' as const,
  connectionError: null,
  lastMessage: null,
  onlineUsers: {},
  reconnectAttempt: 0,
  maxReconnectAttempts: 5,
  connectionStartTime: null,
  isReconnecting: false,
  reconnect: jest.fn(),
  ...overrides,
});

describe('PublicInstructorView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Default to connected state
    mockUseRealtime.mockReturnValue(createMockRealtimeReturn());
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('shows loading state initially', async () => {
    // Set up fetch to never resolve (to test loading state)
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('fetches and displays session state from API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessionId: 'test-session-id',
        joinCode: 'ABC-123',
        problem: {
          title: 'Test Problem',
          description: 'A test problem description',
        },
        featuredStudentId: 'student-1',
        featuredCode: 'print("Hello, World!")',
        hasFeaturedSubmission: true,
      }),
    });

    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/test-session-id/public-state');
    });

    // Verify content is displayed
    await waitFor(() => {
      expect(screen.getByText('ABC-123')).toBeInTheDocument();
    });

    // Verify problem description is displayed
    await waitFor(() => {
      expect(screen.getByText('A test problem description')).toBeInTheDocument();
    });

    // Verify featured code is shown
    await waitFor(() => {
      expect(screen.getByTestId('code-content')).toHaveTextContent('print("Hello, World!")');
    });
  });

  test('passes debugger prop to CodeEditor when featured submission exists', async () => {
    lastCodeEditorProps = null;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessionId: 'test-session-id',
        joinCode: 'ABC-123',
        problem: {
          title: 'Test Problem',
          description: 'A test problem description',
        },
        featuredStudentId: 'student-1',
        featuredCode: 'print("test")',
        hasFeaturedSubmission: true,
      }),
    });

    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

    // Wait for code editor to render
    await waitFor(() => {
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    // Verify debugger prop is passed
    expect(lastCodeEditorProps).toBeTruthy();
    expect(lastCodeEditorProps.debugger).toBeTruthy();
    expect(lastCodeEditorProps.debugger.requestTrace).toBeDefined();

    // Verify the visual indicator is present
    expect(screen.getByTestId('debugger-present')).toBeInTheDocument();
  });

  test('shows no submission message when no featured submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessionId: 'test-session-id',
        joinCode: 'ABC-123',
        problem: null,
        featuredStudentId: null,
        featuredCode: null,
        hasFeaturedSubmission: false,
      }),
    });

    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

    await waitFor(() => {
      expect(screen.getByText('No submission selected for display')).toBeInTheDocument();
    });
  });

  test('shows error state when API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Session not found' }),
    });

    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Session not found')).toBeInTheDocument();
    });
  });

  test('uses useRealtime hook with correct session ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessionId: 'test-session-id',
        joinCode: 'ABC-123',
        problem: null,
        featuredStudentId: null,
        featuredCode: null,
        hasFeaturedSubmission: false,
      }),
    });

    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Verify useRealtime was called with correct session ID and tables
    expect(mockUseRealtime).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'test-session-id',
        tables: ['sessions'],
      })
    );
  });

  test('re-fetches state when realtime lastMessage changes', async () => {
    // First fetch returns initial state
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessionId: 'test-session-id',
        joinCode: 'ABC-123',
        problem: null,
        featuredStudentId: null,
        featuredCode: null,
        hasFeaturedSubmission: false,
      }),
    });

    const PublicInstructorView = require('../page').default;
    const { rerender } = render(<PublicInstructorView />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Second fetch returns updated state
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessionId: 'test-session-id',
        joinCode: 'ABC-123',
        problem: {
          title: 'New Problem',
          description: 'Updated problem',
        },
        featuredStudentId: 'student-2',
        featuredCode: 'print("Updated code")',
        hasFeaturedSubmission: true,
      }),
    });

    // Simulate realtime update by changing lastMessage
    mockUseRealtime.mockReturnValue(createMockRealtimeReturn({
      lastMessage: {
        type: 'UPDATE',
        table: 'sessions',
        payload: { id: 'test-session-id' },
      },
    }));

    // Re-render to trigger the effect
    rerender(<PublicInstructorView />);

    // Wait for re-fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Verify updated content is displayed
    await waitFor(() => {
      expect(screen.getByTestId('code-content')).toHaveTextContent('print("Updated code")');
    });
  });

  test('does NOT poll when realtime is connected', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'test-session-id',
        joinCode: 'ABC-123',
        problem: null,
        featuredStudentId: null,
        featuredCode: null,
        hasFeaturedSubmission: false,
      }),
    });

    // Realtime is connected
    mockUseRealtime.mockReturnValue(createMockRealtimeReturn({ isConnected: true }));

    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Advance timers by 5 seconds (would be 2+ poll cycles if polling was active)
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Should still only have 1 fetch (initial) - no polling
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('polls every 2 seconds when realtime is disconnected', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'test-session-id',
        joinCode: 'ABC-123',
        problem: null,
        featuredStudentId: null,
        featuredCode: null,
        hasFeaturedSubmission: false,
      }),
    });

    // Realtime is disconnected
    mockUseRealtime.mockReturnValue(createMockRealtimeReturn({
      isConnected: false,
      connectionStatus: 'disconnected',
    }));

    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Advance timers by 2 seconds - should trigger first poll
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Advance another 2 seconds - should trigger second poll
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  test('stops polling when realtime reconnects', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'test-session-id',
        joinCode: 'ABC-123',
        problem: null,
        featuredStudentId: null,
        featuredCode: null,
        hasFeaturedSubmission: false,
      }),
    });

    // Start disconnected
    mockUseRealtime.mockReturnValue(createMockRealtimeReturn({
      isConnected: false,
      connectionStatus: 'disconnected',
    }));

    const PublicInstructorView = require('../page').default;
    const { rerender } = render(<PublicInstructorView />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Advance 2 seconds - poll should happen
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Now reconnect
    mockUseRealtime.mockReturnValue(createMockRealtimeReturn({
      isConnected: true,
      connectionStatus: 'connected',
    }));

    rerender(<PublicInstructorView />);

    // Advance another 4 seconds - no additional polls should happen
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    // Should still be at 2 fetches (initial + 1 poll before reconnect)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

});

// Separate describe block with different navigation mock for no-sessionId case
describe('PublicInstructorView without sessionId', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Override the mock to return null for sessionId
    const { useSearchParams } = require('next/navigation');
    (useSearchParams as jest.Mock).mockReturnValue({
      get: jest.fn(() => null)
    });

    // Still need to mock useRealtime
    mockUseRealtime.mockReturnValue(createMockRealtimeReturn());
  });

  test('shows no session message when sessionId is missing', async () => {
    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

    await waitFor(() => {
      expect(screen.getByText('No Session')).toBeInTheDocument();
    });
  });
});
