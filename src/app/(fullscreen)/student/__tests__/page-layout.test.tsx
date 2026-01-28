/**
 * @jest-environment jsdom
 */

/**
 * Tests for student page viewport layout
 *
 * The student session page should fill the viewport like an app/codespace,
 * not scroll like a webpage. Overflow must be contained, and the header
 * must be compact to maximize editor space.
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

describe('Student Page - Viewport Layout', () => {
  const activeSessionState = {
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
  });

  it('should have overflow-hidden on main to prevent page-level scrolling', async () => {
    mockUseRealtimeSession.mockReturnValue(activeSessionState);

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    const main = screen.getByTestId('code-editor').closest('main');
    expect(main).toHaveClass('overflow-hidden');
  });

  it('should use compact text size for the header title', async () => {
    mockUseRealtimeSession.mockReturnValue(activeSessionState);

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByText('Live Coding Session')).toBeInTheDocument();
    });

    const heading = screen.getByText('Live Coding Session');
    expect(heading).toHaveClass('text-lg');
  });

  it('should use compact spacing on the header row', async () => {
    mockUseRealtimeSession.mockReturnValue(activeSessionState);

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByText('Live Coding Session')).toBeInTheDocument();
    });

    const heading = screen.getByText('Live Coding Session');
    const headerRow = heading.closest('div.flex');
    // Parent header row should have mb-2 not mb-4
    expect(headerRow?.parentElement).toHaveClass('mb-2');
  });

  it('should use compact padding on main element', async () => {
    mockUseRealtimeSession.mockReturnValue(activeSessionState);

    render(<StudentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    const main = screen.getByTestId('code-editor').closest('main');
    expect(main).toHaveClass('p-2');
    expect(main).toHaveClass('px-4');
  });
});
