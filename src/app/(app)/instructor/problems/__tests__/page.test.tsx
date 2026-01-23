/**
 * Tests for Instructor Problems Page
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProblemsPageWrapper from '../page';

// Mock the child components
jest.mock('../../components/ProblemLibrary', () => {
  return function MockProblemLibrary({ onCreateNew, onEdit }: { onCreateNew?: () => void; onEdit?: (id: string) => void }) {
    return (
      <div data-testid="problem-library">
        <button onClick={onCreateNew} data-testid="create-new-btn">Create New</button>
        <button onClick={() => onEdit?.('problem-1')} data-testid="edit-btn">Edit</button>
      </div>
    );
  };
});

jest.mock('../../components/ProblemCreator', () => {
  return function MockProblemCreator({ problemId, onCancel, onProblemCreated }: {
    problemId?: string | null;
    onCancel?: () => void;
    onProblemCreated?: (id: string) => void;
  }) {
    return (
      <div data-testid="problem-creator">
        <span data-testid="editing-problem-id">{problemId || 'new'}</span>
        <button onClick={onCancel} data-testid="cancel-btn">Cancel</button>
        <button onClick={() => onProblemCreated?.('created-id')} data-testid="save-btn">Save</button>
      </div>
    );
  };
});

jest.mock('@/components/NamespaceHeader', () => {
  return function MockNamespaceHeader() {
    return <div data-testid="namespace-header">Namespace Header</div>;
  };
});

describe('ProblemsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the problem library by default', () => {
    render(<ProblemsPageWrapper />);

    expect(screen.getByTestId('problem-library')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-creator')).not.toBeInTheDocument();
  });

  it('renders namespace header', () => {
    render(<ProblemsPageWrapper />);

    expect(screen.getByTestId('namespace-header')).toBeInTheDocument();
  });

  it('shows problem creator when creating a new problem', () => {
    render(<ProblemsPageWrapper />);

    fireEvent.click(screen.getByTestId('create-new-btn'));

    expect(screen.getByTestId('problem-creator')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-library')).not.toBeInTheDocument();
    expect(screen.getByTestId('editing-problem-id')).toHaveTextContent('new');
  });

  it('shows problem creator with problem ID when editing', () => {
    render(<ProblemsPageWrapper />);

    fireEvent.click(screen.getByTestId('edit-btn'));

    expect(screen.getByTestId('problem-creator')).toBeInTheDocument();
    expect(screen.getByTestId('editing-problem-id')).toHaveTextContent('problem-1');
  });

  it('returns to library when canceling from creator', () => {
    render(<ProblemsPageWrapper />);

    // Open creator
    fireEvent.click(screen.getByTestId('create-new-btn'));
    expect(screen.getByTestId('problem-creator')).toBeInTheDocument();

    // Cancel
    fireEvent.click(screen.getByTestId('cancel-btn'));

    expect(screen.getByTestId('problem-library')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-creator')).not.toBeInTheDocument();
  });

  it('returns to library after saving a problem', () => {
    render(<ProblemsPageWrapper />);

    // Open creator
    fireEvent.click(screen.getByTestId('create-new-btn'));
    expect(screen.getByTestId('problem-creator')).toBeInTheDocument();

    // Save
    fireEvent.click(screen.getByTestId('save-btn'));

    expect(screen.getByTestId('problem-library')).toBeInTheDocument();
    expect(screen.queryByTestId('problem-creator')).not.toBeInTheDocument();
  });
});
