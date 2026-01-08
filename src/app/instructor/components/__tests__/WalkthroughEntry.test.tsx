/**
 * Tests for WalkthroughEntry component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WalkthroughEntry from '../WalkthroughEntry';
import { WalkthroughEntry as WalkthroughEntryType } from '@/server/types/analysis';

describe('WalkthroughEntry', () => {
  const mockEntry: WalkthroughEntryType = {
    position: 1,
    studentLabel: 'Student A',
    studentId: 'student-1',
    discussionPoints: ['Point one here', 'Point two here'],
    pedagogicalNote: 'This is why we discuss this',
    category: 'common-error',
  };

  const defaultProps = {
    entry: mockEntry,
    isActive: false,
    onClick: jest.fn(),
    onShow: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders position number', () => {
    render(<WalkthroughEntry {...defaultProps} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders student label', () => {
    render(<WalkthroughEntry {...defaultProps} />);
    expect(screen.getByText('Student A')).toBeInTheDocument();
  });

  it('renders discussion points', () => {
    render(<WalkthroughEntry {...defaultProps} />);
    expect(screen.getByText('Point one here')).toBeInTheDocument();
    expect(screen.getByText('Point two here')).toBeInTheDocument();
  });

  it('renders pedagogical note', () => {
    render(<WalkthroughEntry {...defaultProps} />);
    expect(screen.getByText('This is why we discuss this')).toBeInTheDocument();
  });

  it('renders category badge for common-error', () => {
    render(<WalkthroughEntry {...defaultProps} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders category badge for edge-case', () => {
    const entry = { ...mockEntry, category: 'edge-case' as const };
    render(<WalkthroughEntry {...defaultProps} entry={entry} />);
    expect(screen.getByText('Edge Case')).toBeInTheDocument();
  });

  it('renders category badge for interesting-approach', () => {
    const entry = { ...mockEntry, category: 'interesting-approach' as const };
    render(<WalkthroughEntry {...defaultProps} entry={entry} />);
    expect(screen.getByText('Interesting')).toBeInTheDocument();
  });

  it('renders category badge for exemplary', () => {
    const entry = { ...mockEntry, category: 'exemplary' as const };
    render(<WalkthroughEntry {...defaultProps} entry={entry} />);
    expect(screen.getByText('Exemplary')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    render(<WalkthroughEntry {...defaultProps} />);
    fireEvent.click(screen.getByText('Student A'));
    expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
  });

  it('applies active styles when isActive is true', () => {
    const { container } = render(<WalkthroughEntry {...defaultProps} isActive={true} />);
    const entryDiv = container.firstChild as HTMLElement;
    expect(entryDiv.style.border).toContain('2px');
  });

  it('handles entry without pedagogical note', () => {
    const entry = { ...mockEntry, pedagogicalNote: '' };
    render(<WalkthroughEntry {...defaultProps} entry={entry} />);
    // Should render without errors
    expect(screen.getByText('Student A')).toBeInTheDocument();
  });

  it('handles entry with empty discussion points', () => {
    const entry = { ...mockEntry, discussionPoints: [] };
    render(<WalkthroughEntry {...defaultProps} entry={entry} />);
    // Should render without errors
    expect(screen.getByText('Student A')).toBeInTheDocument();
  });
});
