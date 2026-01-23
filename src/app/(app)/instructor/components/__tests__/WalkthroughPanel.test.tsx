/**
 * Tests for WalkthroughPanel component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WalkthroughPanel from '../WalkthroughPanel';
import { WalkthroughScript } from '@/server/types/analysis';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('WalkthroughPanel', () => {
  const mockScript: WalkthroughScript = {
    sessionId: 'session-1',
    entries: [
      {
        position: 1,
        studentLabel: 'Student A',
        studentId: 'student-1',
        discussionPoints: ['Point 1'],
        pedagogicalNote: 'Note 1',
        category: 'common-error',
      },
      {
        position: 2,
        studentLabel: 'Student B',
        studentId: 'student-2',
        discussionPoints: ['Point 2'],
        pedagogicalNote: 'Note 2',
        category: 'interesting-approach',
      },
    ],
    summary: {
      totalSubmissions: 5,
      filteredOut: 2,
      analyzedSubmissions: 3,
      commonPatterns: ['Pattern 1', 'Pattern 2'],
    },
    generatedAt: new Date(),
  };

  const defaultProps = {
    sessionId: 'session-1',
    onFeatureStudent: jest.fn().mockResolvedValue(undefined),
    studentCount: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Idle State', () => {
    it('renders analyze button with student count', () => {
      render(<WalkthroughPanel {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Analyze 5 Submission/ })).toBeInTheDocument();
    });

    it('renders singular text for one student', () => {
      render(<WalkthroughPanel {...defaultProps} studentCount={1} />);
      expect(screen.getByRole('button', { name: /Analyze 1 Submission$/ })).toBeInTheDocument();
    });

    it('disables button when no students', () => {
      render(<WalkthroughPanel {...defaultProps} studentCount={0} />);
      const button = screen.getByRole('button', { name: /Analyze 0 Submission/ });
      expect(button).toBeDisabled();
    });

    it('shows message when no students', () => {
      render(<WalkthroughPanel {...defaultProps} studentCount={0} />);
      expect(screen.getByText(/No students have submitted/)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when analyzing', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText(/Analyzing student code/)).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('shows error message on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Something went wrong' }),
      });

      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText('Analysis Failed')).toBeInTheDocument();
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });
    });

    it('shows try again button on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Error' }),
      });

      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });
  });

  describe('Ready State', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, script: mockScript }),
      });
    });

    it('displays summary information', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText(/3 of 5 analyzed/)).toBeInTheDocument();
      });
    });

    it('displays filtered count', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText(/2 filtered/)).toBeInTheDocument();
      });
    });

    it('displays common patterns', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText('Pattern 1')).toBeInTheDocument();
        expect(screen.getByText('Pattern 2')).toBeInTheDocument();
      });
    });

    it('displays walkthrough entries', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText('Student A')).toBeInTheDocument();
        expect(screen.getByText('Student B')).toBeInTheDocument();
      });
    });

    it('shows navigation controls', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText('Prev')).toBeInTheDocument();
        expect(screen.getByText('Next')).toBeInTheDocument();
        expect(screen.getByText('1 of 2')).toBeInTheDocument();
      });
    });

    it('features first student on load', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(defaultProps.onFeatureStudent).toHaveBeenCalledWith('student-1');
      });
    });

    it('navigates to next entry', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText('1 of 2')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('2 of 2')).toBeInTheDocument();
        expect(defaultProps.onFeatureStudent).toHaveBeenCalledWith('student-2');
      });
    });

    it('navigates to previous entry', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText('1 of 2')).toBeInTheDocument();
      });

      // Go to second entry
      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        expect(screen.getByText('2 of 2')).toBeInTheDocument();
      });

      // Go back to first
      fireEvent.click(screen.getByText('Prev'));

      await waitFor(() => {
        expect(screen.getByText('1 of 2')).toBeInTheDocument();
      });
    });

    it('disables prev button on first entry', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        const prevButton = screen.getByText('Prev');
        expect(prevButton).toBeDisabled();
      });
    });

    it('disables next button on last entry', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText('1 of 2')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));

      await waitFor(() => {
        const nextButton = screen.getByText('Next');
        expect(nextButton).toBeDisabled();
      });
    });

    it('shows re-analyze button', async () => {
      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText('Re-analyze')).toBeInTheDocument();
      });
    });
  });

  describe('Empty Results', () => {
    it('shows empty state when no entries', async () => {
      const emptyScript = {
        ...mockScript,
        entries: [],
        summary: { ...mockScript.summary, analyzedSubmissions: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, script: emptyScript }),
      });

      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText(/No submissions worth discussing/)).toBeInTheDocument();
      });
    });
  });

  describe('Warning Message', () => {
    it('displays warning when present', async () => {
      const scriptWithWarning = {
        ...mockScript,
        summary: {
          ...mockScript.summary,
          warning: '60% of submissions were empty',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, script: scriptWithWarning }),
      });

      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText(/60% of submissions were empty/)).toBeInTheDocument();
      });
    });
  });

  describe('Entry Click', () => {
    it('features student when entry is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, script: mockScript }),
      });

      render(<WalkthroughPanel {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze \d+ Submission/ }));

      await waitFor(() => {
        expect(screen.getByText('Student B')).toBeInTheDocument();
      });

      // Clear previous calls from initial load
      defaultProps.onFeatureStudent.mockClear();

      // Click on second entry
      fireEvent.click(screen.getByText('Student B'));

      await waitFor(() => {
        expect(defaultProps.onFeatureStudent).toHaveBeenCalledWith('student-2');
      });
    });
  });
});
