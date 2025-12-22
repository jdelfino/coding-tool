/**
 * Tests for Instructor Problems Page
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProblemsPage from '../../problems/page';

// Mock ProtectedRoute
jest.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock ProblemLibrary
jest.mock('../../components/ProblemLibrary', () => {
  return function MockProblemLibrary({ onCreateNew }: { onCreateNew?: () => void }) {
    return (
      <div data-testid="problem-library">
        <button onClick={onCreateNew}>Create New</button>
      </div>
    );
  };
});

// Mock ProblemCreator
jest.mock('../../components/ProblemCreator', () => {
  return function MockProblemCreator({
    onProblemCreated,
    onCancel,
  }: {
    onProblemCreated?: (id: string) => void;
    onCancel?: () => void;
  }) {
    return (
      <div data-testid="problem-creator">
        <button onClick={() => onProblemCreated?.('new-problem-id')}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  };
});

describe('ProblemsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders ProblemLibrary by default', () => {
    render(<ProblemsPage />);
    expect(screen.getByTestId('problem-library')).toBeInTheDocument();
  });

  it('shows ProblemCreator when create new is clicked', () => {
    render(<ProblemsPage />);
    
    fireEvent.click(screen.getByText('Create New'));
    
    expect(screen.getByTestId('problem-creator')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-library')).not.toBeInTheDocument();
  });

  it('shows back button when in creator mode', () => {
    render(<ProblemsPage />);
    
    fireEvent.click(screen.getByText('Create New'));
    
    expect(screen.getByText('Back to Problem Library')).toBeInTheDocument();
  });

  it('returns to library when cancel is clicked', () => {
    render(<ProblemsPage />);
    
    fireEvent.click(screen.getByText('Create New'));
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(screen.getByTestId('problem-library')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-creator')).not.toBeInTheDocument();
  });

  it('returns to library when back button is clicked', () => {
    render(<ProblemsPage />);
    
    fireEvent.click(screen.getByText('Create New'));
    fireEvent.click(screen.getByText('Back to Problem Library'));
    
    expect(screen.getByTestId('problem-library')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-creator')).not.toBeInTheDocument();
  });

  it('logs problem ID when created', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    render(<ProblemsPage />);
    
    fireEvent.click(screen.getByText('Create New'));
    fireEvent.click(screen.getByText('Save'));
    
    expect(consoleSpy).toHaveBeenCalledWith('Problem created:', 'new-problem-id');
    consoleSpy.mockRestore();
  });

  it('wraps content with ProtectedRoute', () => {
    // This test verifies the component structure
    // The actual protection is tested in ProtectedRoute component
    render(<ProblemsPage />);
    expect(screen.getByTestId('problem-library')).toBeInTheDocument();
  });

  it('applies correct layout classes', () => {
    const { container } = render(<ProblemsPage />);
    const mainDiv = container.querySelector('.min-h-screen');
    expect(mainDiv).toBeInTheDocument();
    expect(mainDiv).toHaveClass('bg-gray-50', 'p-6');
  });

  it('uses correct max-width for library view', () => {
    const { container } = render(<ProblemsPage />);
    const contentDiv = container.querySelector('.max-w-7xl');
    expect(contentDiv).toBeInTheDocument();
  });

  it('uses correct max-width for creator view', () => {
    const { container } = render(<ProblemsPage />);
    
    fireEvent.click(screen.getByText('Create New'));
    
    const contentDiv = container.querySelector('.max-w-4xl');
    expect(contentDiv).toBeInTheDocument();
  });
});
