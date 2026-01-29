import React from 'react';
import { render, screen } from '@testing-library/react';
import StudentAnalysisDetails from '../StudentAnalysisDetails';
import { WalkthroughEntry } from '@/server/types/analysis';

const makeEntry = (overrides: Partial<WalkthroughEntry> = {}): WalkthroughEntry => ({
  position: 1,
  studentLabel: 'Student A',
  studentId: 'stu-1',
  discussionPoints: ['Uses a helper function', 'Handles edge case'],
  pedagogicalNote: 'Good example of decomposition',
  category: 'interesting-approach',
  ...overrides,
});

describe('StudentAnalysisDetails', () => {
  it('renders nothing when entries array is empty', () => {
    const { container } = render(<StudentAnalysisDetails entries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders discussion points and pedagogical note for a single entry', () => {
    render(<StudentAnalysisDetails entries={[makeEntry()]} />);

    expect(screen.getByText('Uses a helper function')).toBeInTheDocument();
    expect(screen.getByText('Handles edge case')).toBeInTheDocument();
    expect(screen.getByText('Good example of decomposition')).toBeInTheDocument();
  });

  it('renders the correct category badge for each entry', () => {
    const entries = [
      makeEntry({ category: 'common-error', position: 1 }),
      makeEntry({ category: 'exemplary', position: 2, studentLabel: 'Student B', studentId: 'stu-2' }),
    ];
    render(<StudentAnalysisDetails entries={entries} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Exemplary')).toBeInTheDocument();
  });

  it('renders multiple entries with dividers between them', () => {
    const entries = [
      makeEntry({ position: 1, discussionPoints: ['Point A'] }),
      makeEntry({
        position: 2,
        studentLabel: 'Student B',
        studentId: 'stu-2',
        discussionPoints: ['Point B'],
        pedagogicalNote: 'Second note',
        category: 'edge-case',
      }),
    ];
    const { container } = render(<StudentAnalysisDetails entries={entries} />);

    expect(screen.getByText('Point A')).toBeInTheDocument();
    expect(screen.getByText('Point B')).toBeInTheDocument();
    // Divider exists between entries (hr element)
    expect(container.querySelectorAll('hr')).toHaveLength(1);
  });

  it('renders pedagogical note in italic style', () => {
    render(<StudentAnalysisDetails entries={[makeEntry()]} />);
    const note = screen.getByText('Good example of decomposition');
    expect(note).toHaveStyle({ fontStyle: 'italic' });
  });

  it('renders discussion points as a bullet list', () => {
    const { container } = render(<StudentAnalysisDetails entries={[makeEntry()]} />);
    const listItems = container.querySelectorAll('li');
    expect(listItems).toHaveLength(2);
  });
});
