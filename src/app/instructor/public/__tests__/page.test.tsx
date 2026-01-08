/**
 * Unit tests for the public instructor view component
 * Tests behavior of the public display page including:
 * - Loading state from API
 * - Realtime updates via Supabase
 * - State management
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(() => ({
    get: jest.fn((key: string) => (key === 'sessionId' ? 'test-session-id' : null))
  })),
}));

// Mock Supabase client
const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockImplementation((callback) => {
    if (callback) callback('SUBSCRIBED');
    return mockChannel;
  }),
};

const mockSupabase = {
  channel: jest.fn().mockReturnValue(mockChannel),
  removeChannel: jest.fn(),
};

jest.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: jest.fn(() => mockSupabase),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock CodeEditor component
jest.mock('@/app/student/components/CodeEditor', () => {
  return function MockCodeEditor({ code, title }: any) {
    return (
      <div data-testid="code-editor">
        <div data-testid="code-title">{title}</div>
        <div data-testid="code-content">{code}</div>
      </div>
    );
  };
});

describe('PublicInstructorView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChannel.on.mockReturnThis();
    mockChannel.subscribe.mockImplementation((callback) => {
      if (callback) callback('SUBSCRIBED');
      return mockChannel;
    });
    mockSupabase.channel.mockReturnValue(mockChannel);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

  test('subscribes to Supabase Realtime for updates', async () => {
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

    // Verify Supabase channel was created for session updates
    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith('public-view-test-session-id');
    });

    // Verify subscription to postgres_changes
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: 'id=eq.test-session-id',
      }),
      expect.any(Function)
    );

    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  test('re-fetches state when realtime update received', async () => {
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

    // Capture the realtime callback using a container object (TypeScript handles this better)
    const callbackRef: { current: ((payload: any) => void) | null } = { current: null };
    mockChannel.on.mockImplementation((event: string, config: any, callback: (payload: any) => void) => {
      if (event === 'postgres_changes') {
        callbackRef.current = callback;
      }
      return mockChannel;
    });

    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

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

    // Simulate realtime update
    if (callbackRef.current) {
      callbackRef.current({ new: { id: 'test-session-id' } });
    }

    // Wait for re-fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Verify updated content is displayed
    await waitFor(() => {
      expect(screen.getByTestId('code-content')).toHaveTextContent('print("Updated code")');
    });
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
  });

  test('shows no session message when sessionId is missing', async () => {
    const PublicInstructorView = require('../page').default;
    render(<PublicInstructorView />);

    await waitFor(() => {
      expect(screen.getByText('No Session')).toBeInTheDocument();
    });
  });
});
