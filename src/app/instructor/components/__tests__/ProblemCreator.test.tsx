/**
 * Tests for ProblemCreator component
 * 
 * Tests both create and edit modes with all fields:
 * - Loading existing problem data
 * - Editing all fields (title, description, starterCode, solutionCode, isPublic)
 * - Form submission and validation
 * - Error handling
 * - Cancel functionality
 * 
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProblemCreator from '../ProblemCreator';

// Mock fetch globally
global.fetch = jest.fn();

describe('ProblemCreator Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Create Mode', () => {
    it('should render form in create mode when no problemId provided', () => {
      render(<ProblemCreator />);
      
      expect(screen.getByText('Create New Problem')).toBeInTheDocument();
      expect(screen.getByLabelText(/Title/)).toHaveValue('');
      expect(screen.getByLabelText(/Description/)).toHaveValue('');
      expect(screen.getByLabelText(/Starter Code/)).toHaveValue('');
      expect(screen.getByLabelText(/Solution Code/)).toHaveValue('');
      expect(screen.getByText('Create Problem')).toBeInTheDocument();
    });

    it('should validate required title field', async () => {
      render(<ProblemCreator />);
      
      const submitButton = screen.getByText('Create Problem');
      
      // Button should be disabled when title is empty
      expect(submitButton).toBeDisabled();
      
      // The component prevents submission when title is empty through disabled button
      // This is the actual validation mechanism in the implementation
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should create new problem with all fields', async () => {
      const onProblemCreated = jest.fn();
      const mockProblem = {
        id: 'problem-123',
        title: 'Test Problem',
        description: 'Test description',
        starterCode: 'def solution():\n    pass',
        solutionCode: 'def solution():\n    return 42',
        isPublic: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ problem: mockProblem }),
      });

      render(<ProblemCreator onProblemCreated={onProblemCreated} />);
      
      // Fill in form
      fireEvent.change(screen.getByLabelText(/Title/), {
        target: { value: 'Test Problem' },
      });
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'Test description' },
      });
      fireEvent.change(screen.getByLabelText(/Starter Code/), {
        target: { value: 'def solution():\n    pass' },
      });
      fireEvent.change(screen.getByLabelText(/Solution Code/), {
        target: { value: 'def solution():\n    return 42' },
      });
      fireEvent.click(screen.getByText(/Make this problem public/));

      // Submit
      fireEvent.click(screen.getByText('Create Problem'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/problems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Test Problem',
            description: 'Test description',
            starterCode: 'def solution():\n    pass',
            solutionCode: 'def solution():\n    return 42',
            testCases: [],
            isPublic: true,
            classId: undefined,
          }),
        });
      });

      await waitFor(() => {
        expect(onProblemCreated).toHaveBeenCalledWith('problem-123');
      });
    });

    it('should display error when create fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Creation failed' }),
      });

      render(<ProblemCreator />);
      
      fireEvent.change(screen.getByLabelText(/Title/), {
        target: { value: 'Test Problem' },
      });
      fireEvent.click(screen.getByText('Create Problem'));

      await waitFor(() => {
        expect(screen.getByText('Creation failed')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    const mockExistingProblem = {
      id: 'problem-456',
      title: 'Existing Problem',
      description: 'Original description',
      starterCode: 'def original():\n    pass',
      solutionCode: 'def original():\n    return 1',
      isPublic: false,
      authorId: 'user-1',
    };

    it('should load existing problem data in edit mode', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ problem: mockExistingProblem }),
      });

      render(<ProblemCreator problemId="problem-456" />);

      // Should show loading state
      expect(screen.getByText('Loading problem...')).toBeInTheDocument();

      // Should fetch problem data
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/problems/problem-456');
      });

      // Should populate form
      await waitFor(() => {
        expect(screen.getByText('Edit Problem')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Title/)).toHaveValue('Existing Problem');
      expect(screen.getByLabelText(/Description/)).toHaveValue('Original description');
      expect(screen.getByLabelText(/Starter Code/)).toHaveValue('def original():\n    pass');
      expect(screen.getByLabelText(/Solution Code/)).toHaveValue('def original():\n    return 1');
      expect(screen.getByText('Update Problem')).toBeInTheDocument();
    });

    it('should display error when loading problem fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      });

      render(<ProblemCreator problemId="problem-456" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load problem')).toBeInTheDocument();
      });
    });

    it('should update existing problem with modified fields', async () => {
      const onProblemCreated = jest.fn();

      // Mock GET request to load problem
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ problem: mockExistingProblem }),
      });

      render(<ProblemCreator problemId="problem-456" onProblemCreated={onProblemCreated} />);

      // Wait for load
      await waitFor(() => {
        expect(screen.getByLabelText(/Title/)).toHaveValue('Existing Problem');
      });

      // Mock PATCH request
      const updatedProblem = { ...mockExistingProblem, title: 'Updated Problem' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ problem: updatedProblem }),
      });

      // Modify title
      fireEvent.change(screen.getByLabelText(/Title/), {
        target: { value: 'Updated Problem' },
      });

      // Submit
      fireEvent.click(screen.getByText('Update Problem'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/problems/problem-456', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"title":"Updated Problem"'),
        });
      });

      await waitFor(() => {
        expect(onProblemCreated).toHaveBeenCalledWith('problem-456');
      });
    });

    it('should handle update failure', async () => {
      // Mock GET request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ problem: mockExistingProblem }),
      });

      render(<ProblemCreator problemId="problem-456" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/)).toHaveValue('Existing Problem');
      });

      // Mock failed PATCH
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Update failed' }),
      });

      fireEvent.click(screen.getByText('Update Problem'));

      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onCancel when cancel button clicked', () => {
      const onCancel = jest.fn();
      render(<ProblemCreator onCancel={onCancel} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('should not show cancel button when onCancel not provided', () => {
      render(<ProblemCreator />);
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('should disable cancel button while submitting', async () => {
      const onCancel = jest.fn();
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<ProblemCreator onCancel={onCancel} />);

      fireEvent.change(screen.getByLabelText(/Title/), {
        target: { value: 'Test' },
      });
      fireEvent.click(screen.getByText('Create Problem'));

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        expect(cancelButton).toBeDisabled();
      });
    });
  });

  describe('Form States', () => {
    it('should disable submit button when title is empty', () => {
      render(<ProblemCreator />);
      const submitButton = screen.getByText('Create Problem');
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when title is provided', () => {
      render(<ProblemCreator />);
      
      fireEvent.change(screen.getByLabelText(/Title/), {
        target: { value: 'Test' },
      });

      const submitButton = screen.getByText('Create Problem');
      expect(submitButton).not.toBeDisabled();
    });

    it('should show loading state during submission', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<ProblemCreator />);
      
      fireEvent.change(screen.getByLabelText(/Title/), {
        target: { value: 'Test' },
      });
      fireEvent.click(screen.getByText('Create Problem'));

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });
    });
  });

  describe('Visibility Settings', () => {
    it('should default to private (not public)', () => {
      render(<ProblemCreator />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('should toggle public visibility', () => {
      render(<ProblemCreator />);
      const checkbox = screen.getByRole('checkbox');
      
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('should preserve isPublic value from loaded problem', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          problem: { ...mockExistingProblem, isPublic: true },
        }),
      });

      render(<ProblemCreator problemId="problem-456" />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
      });
    });
  });
});

const mockExistingProblem = {
  id: 'problem-456',
  title: 'Existing Problem',
  description: 'Original description',
  starterCode: 'def original():\n    pass',
  solutionCode: 'def original():\n    return 1',
  isPublic: false,
  authorId: 'user-1',
};
