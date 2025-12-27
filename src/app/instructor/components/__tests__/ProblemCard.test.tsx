/**
 * Tests for ProblemCard component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProblemCard from '../ProblemCard';

describe('ProblemCard', () => {
  const mockProblem = {
    id: 'problem-123',
    title: 'Test Problem',
    description: 'This is a test problem description',
    testCases: [{ id: '1' }, { id: '2' }],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    authorId: 'user-123',
  };

  const defaultProps = {
    problem: mockProblem,
    viewMode: 'list' as const,
    onView: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onCreateSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.confirm
    global.confirm = jest.fn(() => true);
  });

  describe('List View', () => {
    it('renders problem title', () => {
      render(<ProblemCard {...defaultProps} />);
      expect(screen.getByText('Test Problem')).toBeInTheDocument();
    });

    it('renders problem description', () => {
      render(<ProblemCard {...defaultProps} />);
      expect(screen.getByText(/This is a test problem description/)).toBeInTheDocument();
    });

    it('displays test case count', () => {
      render(<ProblemCard {...defaultProps} />);
      expect(screen.getByText(/2 tests/)).toBeInTheDocument();
    });

    it('displays singular test for single test case', () => {
      const problem = { ...mockProblem, testCases: [{ id: '1' }] };
      render(<ProblemCard {...defaultProps} problem={problem} />);
      expect(screen.getByText(/1 test$/)).toBeInTheDocument();
    });

    it('displays created date', () => {
      render(<ProblemCard {...defaultProps} />);
      expect(screen.getByText(/Created Jan 1, 2025/)).toBeInTheDocument();
    });

    it('displays updated date if different from created', () => {
      render(<ProblemCard {...defaultProps} />);
      expect(screen.getByText(/Updated Jan 2, 2025/)).toBeInTheDocument();
    });

    it('does not display updated date if same as created', () => {
      const problem = { ...mockProblem, updatedAt: mockProblem.createdAt };
      render(<ProblemCard {...defaultProps} problem={problem} />);
      expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
    });

    it('calls onView when View button is clicked', () => {
      render(<ProblemCard {...defaultProps} />);
      fireEvent.click(screen.getByText('View'));
      expect(defaultProps.onView).toHaveBeenCalledWith('problem-123');
    });

    it('calls onEdit when Edit button is clicked', () => {
      render(<ProblemCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Edit'));
      expect(defaultProps.onEdit).toHaveBeenCalledWith('problem-123');
    });

    it('calls onCreateSession when Create Session button is clicked', () => {
      render(<ProblemCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Create Session'));
      expect(defaultProps.onCreateSession).toHaveBeenCalledWith('problem-123');
    });

    it('calls onDelete when Delete button is clicked and confirmed', async () => {
      render(<ProblemCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Delete'));
      
      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalled();
        expect(defaultProps.onDelete).toHaveBeenCalledWith('problem-123', 'Test Problem');
      });
    });

    it('does not call onDelete when delete is cancelled', async () => {
      global.confirm = jest.fn(() => false);
      render(<ProblemCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Delete'));
      
      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalled();
        expect(defaultProps.onDelete).not.toHaveBeenCalled();
      });
    });

    it('shows deleting state while delete is in progress', async () => {
      const slowDelete = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<ProblemCard {...defaultProps} onDelete={slowDelete} />);
      
      fireEvent.click(screen.getByText('Delete'));
      
      await waitFor(() => {
        expect(screen.getByText('...')).toBeInTheDocument();
      });
    });
  });

  describe('Grid View', () => {
    const gridProps = { ...defaultProps, viewMode: 'grid' as const };

    it('renders problem title in grid view', () => {
      render(<ProblemCard {...gridProps} />);
      expect(screen.getByText('Test Problem')).toBeInTheDocument();
    });

    it('renders all action buttons in grid view', () => {
      render(<ProblemCard {...gridProps} />);
      expect(screen.getByText('View')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Create Session')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('handles actions in grid view', () => {
      render(<ProblemCard {...gridProps} />);
      
      fireEvent.click(screen.getByText('View'));
      expect(defaultProps.onView).toHaveBeenCalledWith('problem-123');
      
      fireEvent.click(screen.getByText('Edit'));
      expect(defaultProps.onEdit).toHaveBeenCalledWith('problem-123');
    });
  });

  describe('Edge Cases', () => {
    it('handles problem without description', () => {
      const problem = { ...mockProblem, description: undefined };
      render(<ProblemCard {...defaultProps} problem={problem} />);
      expect(screen.getByText('Test Problem')).toBeInTheDocument();
      expect(screen.queryByText(/This is a test/)).not.toBeInTheDocument();
    });

    it('handles problem with empty description', () => {
      const problem = { ...mockProblem, description: '   ' };
      render(<ProblemCard {...defaultProps} problem={problem} />);
      expect(screen.queryByText(/^\s+$/)).not.toBeInTheDocument();
    });

    it('handles problem without test cases', () => {
      const problem = { ...mockProblem, testCases: undefined };
      render(<ProblemCard {...defaultProps} problem={problem} />);
      expect(screen.getByText(/0 tests/)).toBeInTheDocument();
    });

    it('handles problem with empty test cases array', () => {
      const problem = { ...mockProblem, testCases: [] };
      render(<ProblemCard {...defaultProps} problem={problem} />);
      expect(screen.getByText(/0 tests/)).toBeInTheDocument();
    });
  });
});
