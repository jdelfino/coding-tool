/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import StudentPage from '../page';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionHistory } from '@/hooks/useSessionHistory';

// Mock the hooks
jest.mock('@/hooks/useWebSocket');
jest.mock('@/contexts/AuthContext');
jest.mock('@/hooks/useSessionHistory');

// Mock ProtectedRoute
jest.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

const mockUseWebSocket = useWebSocket as jest.MockedFunction<typeof useWebSocket>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseSessionHistory = useSessionHistory as jest.MockedFunction<typeof useSessionHistory>;

describe('StudentPage - Session Ending', () => {
  let mockSendMessage: jest.Mock;
  let mockSignOut: jest.Mock;
  let mockRefetch: jest.Mock;

  beforeEach(() => {
    mockSendMessage = jest.fn();
    mockSignOut = jest.fn();
    mockRefetch = jest.fn();

    mockUseAuth.mockReturnValue({
      user: { 
        id: 'student1', 
        username: 'TestStudent', 
        role: 'student',
        createdAt: new Date().toISOString() as any,
      },
      sessionId: null,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: mockSignOut,
      refreshUser: jest.fn(),
    });

    mockUseSessionHistory.mockReturnValue({
      sessions: [
        {
          id: 'session1',
          joinCode: 'ABC123',
          status: 'active',
          problemText: 'Test Problem',
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          creatorId: 'instructor1',
          participantCount: 1,
        }
      ],
      isLoading: false,
      error: null,
      refetch: mockRefetch as any,
      reconnectToSession: jest.fn(),
    });

    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: null,
      sendMessage: mockSendMessage,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows notification when SESSION_ENDED message is received', async () => {
    const { rerender } = render(<StudentPage />);

    // Wait for auto-rejoin to complete
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('JOIN_SESSION', expect.any(Object));
    });

    // Simulate successful join
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: {
        type: 'SESSION_JOINED',
        payload: {
          sessionId: 'session1',
          studentId: 'student1',
          problem: { id: 'p1', title: 'Test Problem', description: 'Test', starterCode: '' },
          sessionExecutionSettings: {},
          code: '',
        },
      },
      sendMessage: mockSendMessage,
    });
    rerender(<StudentPage />);

    // Verify we're in session view
    await waitFor(() => {
      expect(screen.getByText('Live Coding Session')).toBeInTheDocument();
    });

    // Simulate session ended
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: {
        type: 'SESSION_ENDED',
        payload: { sessionId: 'session1' },
      },
      sendMessage: mockSendMessage,
    });
    rerender(<StudentPage />);

    // Verify notification appears
    await waitFor(() => {
      expect(screen.getByText('Session Ended')).toBeInTheDocument();
    });
    expect(screen.getByText(/The instructor has ended this session/)).toBeInTheDocument();
    expect(screen.getByText(/You can still view your code and output/)).toBeInTheDocument();
  });

  it('keeps student in session view after session ends', async () => {
    const { rerender } = render(<StudentPage />);

    // Auto-rejoin
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('JOIN_SESSION', expect.any(Object));
    });

    // Successful join
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: {
        type: 'SESSION_JOINED',
        payload: {
          sessionId: 'session1',
          studentId: 'student1',
          problem: { id: 'p1', title: 'Test Problem', description: 'Test', starterCode: 'print("hello")' },
          sessionExecutionSettings: {},
          code: 'print("hello")',
        },
      },
      sendMessage: mockSendMessage,
    });
    rerender(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByText('Live Coding Session')).toBeInTheDocument();
    });

    // Simulate session ended
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: {
        type: 'SESSION_ENDED',
        payload: { sessionId: 'session1' },
      },
      sendMessage: mockSendMessage,
    });
    rerender(<StudentPage />);

    // Verify we're still in session view (not kicked out to dashboard)
    await waitFor(() => {
      expect(screen.getByText('Session Ended')).toBeInTheDocument();
    });
    expect(screen.getByText('Live Coding Session')).toBeInTheDocument();
    expect(screen.getByText('Leave Session')).toBeInTheDocument();
  });

  it('does not show notification for different session', async () => {
    const { rerender } = render(<StudentPage />);

    // Auto-rejoin
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('JOIN_SESSION', expect.any(Object));
    });

    // Successful join to session1
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: {
        type: 'SESSION_JOINED',
        payload: {
          sessionId: 'session1',
          studentId: 'student1',
          problem: { id: 'p1', title: 'Test Problem', description: 'Test', starterCode: '' },
          sessionExecutionSettings: {},
          code: '',
        },
      },
      sendMessage: mockSendMessage,
    });
    rerender(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByText('Live Coding Session')).toBeInTheDocument();
    });

    // Simulate a different session ending
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      connectionError: null,
      lastMessage: {
        type: 'SESSION_ENDED',
        payload: { sessionId: 'session2' }, // Different session
      },
      sendMessage: mockSendMessage,
    });
    rerender(<StudentPage />);

    // Verify notification does NOT appear
    await waitFor(() => {
      expect(screen.queryByText('Session Ended')).not.toBeInTheDocument();
    });
  });
});
