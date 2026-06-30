/**
 * Tests for ProblemCard Duplicate button behavior.
 *
 * Contract: ProblemCard accepts an optional onDuplicate prop and renders a
 * 'Duplicate' button in both list and grid views. Clicking it calls
 * onDuplicate(problem.id). When the prop is omitted the button is absent.
 *
 * Why it matters: if the button is missing, wired to the wrong callback,
 * or passes the wrong id, the modal will never open or will operate on
 * the wrong problem.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProblemCard from '../ProblemCard';

const mockProblem = {
  id: 'problem-123',
  title: 'Loops',
  description: 'A problem about loops',
  createdAt: '2025-01-01T00:00:00.000Z',
  authorId: 'user-1',
  tags: [],
  classId: 'class-A',
};

const baseProps = {
  problem: mockProblem,
  viewMode: 'list' as const,
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onCreateSession: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProblemCard – Duplicate button (list view)', () => {
  it('renders a Duplicate button when onDuplicate is provided', () => {
    const onDuplicate = jest.fn();
    render(<ProblemCard {...baseProps} onDuplicate={onDuplicate} />);
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument();
  });

  it('calls onDuplicate with the problem id when clicked', () => {
    const onDuplicate = jest.fn();
    render(<ProblemCard {...baseProps} onDuplicate={onDuplicate} />);
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledWith('problem-123');
  });

  it('does not render a Duplicate button when onDuplicate is omitted', () => {
    render(<ProblemCard {...baseProps} />);
    expect(screen.queryByRole('button', { name: /duplicate/i })).not.toBeInTheDocument();
  });
});

describe('ProblemCard – Duplicate button (grid view)', () => {
  const gridProps = { ...baseProps, viewMode: 'grid' as const };

  it('renders a Duplicate button in grid view when onDuplicate is provided', () => {
    const onDuplicate = jest.fn();
    render(<ProblemCard {...gridProps} onDuplicate={onDuplicate} />);
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument();
  });

  it('calls onDuplicate with the problem id in grid view', () => {
    const onDuplicate = jest.fn();
    render(<ProblemCard {...gridProps} onDuplicate={onDuplicate} />);
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    expect(onDuplicate).toHaveBeenCalledWith('problem-123');
  });

  it('does not render a Duplicate button in grid view when onDuplicate is omitted', () => {
    render(<ProblemCard {...gridProps} />);
    expect(screen.queryByRole('button', { name: /duplicate/i })).not.toBeInTheDocument();
  });
});
