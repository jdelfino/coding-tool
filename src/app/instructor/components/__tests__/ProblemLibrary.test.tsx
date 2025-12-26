/**
 * Tests for ProblemLibrary component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProblemLibrary from '../ProblemLibrary';
import { useAuth } from '@/contexts/AuthContext';

// Mock the AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
}));

// Mock the child components
jest.mock('../ProblemSearch', () => {
  return function MockProblemSearch(props: any) {
    return <div data-testid="problem-search">ProblemSearch</div>;
  };
});

jest.mock('../ProblemCard', () => {
  return function MockProblemCard(props: any) {
    return (
      <div data-testid={`problem-card-${props.problem.id}`}>
        {props.problem.title}
      </div>
    );
  };
});

describe('ProblemLibrary', () => {
  const mockUser = {
    id: 'user-123',
    username: 'instructor',
    role: 'instructor' as const,
    displayName: 'Test Instructor',
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  const mockProblems = [
    {
      id: 'problem-1',
      title: 'Problem 1',
      description: 'Description 1',
      testCases: [],
      isPublic: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      authorId: 'user-123',
    },
    {
      id: 'problem-2',
      title: 'Problem 2',
      description: 'Description 2',
      testCases: [],
      isPublic: false,
      createdAt: '2025-01-02T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      authorId: 'user-123',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ problems: mockProblems }),
      })
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    render(<ProblemLibrary />);
    // Check for loading spinner (animation class)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('fetches and displays problems', async () => {
    render(<ProblemLibrary />);

    await waitFor(() => {
      expect(screen.getByText('Problem Library')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/problems?')
    );
  });

  it('displays problem count', async () => {
    render(<ProblemLibrary />);

    await waitFor(() => {
      expect(screen.getByText(/2 problems/)).toBeInTheDocument();
    });
  });

  it('displays singular for single problem', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ problems: [mockProblems[0]] }),
      })
    ) as jest.Mock;

    render(<ProblemLibrary />);

    await waitFor(() => {
      expect(screen.getByText(/1 problem$/)).toBeInTheDocument();
    });
  });

  it('renders create new button when onCreateNew is provided', async () => {
    const onCreateNew = jest.fn();
    render(<ProblemLibrary onCreateNew={onCreateNew} />);

    await waitFor(() => {
      expect(screen.getByText('Create New Problem')).toBeInTheDocument();
    });
  });

  it('calls onCreateNew when create button is clicked', async () => {
    const onCreateNew = jest.fn();
    render(<ProblemLibrary onCreateNew={onCreateNew} />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Create New Problem'));
    });

    expect(onCreateNew).toHaveBeenCalled();
  });

  it('displays error message when fetch fails', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to load' }),
      })
    ) as jest.Mock;

    render(<ProblemLibrary />);

    await waitFor(() => {
      expect(screen.getByText('Error loading problems')).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to load' }),
      })
    ) as jest.Mock;

    render(<ProblemLibrary />);

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });
  });

  it('retries loading when retry button is clicked', async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed to load' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ problems: mockProblems }),
      });
    }) as jest.Mock;

    render(<ProblemLibrary />);

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Try again'));

    await waitFor(() => {
      expect(screen.getByText('Problem Library')).toBeInTheDocument();
    });

    expect(callCount).toBe(2);
  });

  it('displays empty state when no problems', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ problems: [] }),
      })
    ) as jest.Mock;

    render(<ProblemLibrary onCreateNew={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No problems yet')).toBeInTheDocument();
    });
  });

  it('displays ProblemSearch component', async () => {
    render(<ProblemLibrary />);

    await waitFor(() => {
      expect(screen.getByTestId('problem-search')).toBeInTheDocument();
    });
  });

  it('renders ProblemCard for each problem', async () => {
    render(<ProblemLibrary />);

    await waitFor(() => {
      expect(screen.getByTestId('problem-card-problem-1')).toBeInTheDocument();
      expect(screen.getByTestId('problem-card-problem-2')).toBeInTheDocument();
    });
  });

  it('does not fetch problems when user is not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    render(<ProblemLibrary />);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('includes authorId in API request', async () => {
    render(<ProblemLibrary />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('authorId=user-123')
      );
    });
  });

  it('includes sort parameters in API request', async () => {
    render(<ProblemLibrary />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/sortBy=created.*sortOrder=desc/)
      );
    });
  });
});
