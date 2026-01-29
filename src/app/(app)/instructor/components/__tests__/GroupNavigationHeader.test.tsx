import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupNavigationHeader from '../GroupNavigationHeader';
import { AnalysisGroup } from '../../hooks/useAnalysisGroups';

const makeGroup = (overrides: Partial<AnalysisGroup> = {}): AnalysisGroup => ({
  id: 'common-error',
  label: 'Common Errors',
  entries: [],
  studentIds: ['s1', 's2'],
  recommendedStudentId: 's1',
  ...overrides,
});

const allGroup: AnalysisGroup = {
  id: 'all',
  label: 'All Submissions',
  entries: [],
  studentIds: [],
  recommendedStudentId: null,
};

const groups: AnalysisGroup[] = [
  allGroup,
  makeGroup({ id: 'common-error', label: 'Common Errors', studentIds: ['s1', 's2'] }),
  makeGroup({ id: 'edge-case', label: 'Edge Cases', studentIds: ['s3'] }),
];

describe('GroupNavigationHeader', () => {
  it('renders group label and position indicator', () => {
    render(
      <GroupNavigationHeader
        groups={groups}
        activeGroupIndex={1}
        onNavigate={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(screen.getByText('Common Errors')).toBeInTheDocument();
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
  });

  it('renders student count for active group', () => {
    render(
      <GroupNavigationHeader
        groups={groups}
        activeGroupIndex={1}
        onNavigate={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(screen.getByText(/2 students/)).toBeInTheDocument();
  });

  it('disables prev button on first group', () => {
    render(
      <GroupNavigationHeader
        groups={groups}
        activeGroupIndex={0}
        onNavigate={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    const prevButton = screen.getByRole('button', { name: /previous/i });
    expect(prevButton).toBeDisabled();
  });

  it('disables next button on last group', () => {
    render(
      <GroupNavigationHeader
        groups={groups}
        activeGroupIndex={2}
        onNavigate={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it('calls onNavigate with correct direction when clicking arrows', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();

    render(
      <GroupNavigationHeader
        groups={groups}
        activeGroupIndex={1}
        onNavigate={onNavigate}
        onDismiss={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(onNavigate).toHaveBeenCalledWith('prev');

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onNavigate).toHaveBeenCalledWith('next');
  });

  it('hides dismiss button for "All Submissions" group', () => {
    render(
      <GroupNavigationHeader
        groups={groups}
        activeGroupIndex={0}
        onNavigate={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('calls onDismiss with group id when clicking dismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();

    render(
      <GroupNavigationHeader
        groups={groups}
        activeGroupIndex={1}
        onNavigate={jest.fn()}
        onDismiss={onDismiss}
      />
    );

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith('common-error');
  });

  it('shows common patterns only for "all" group', () => {
    const patterns = ['Most students used a for loop', 'Several forgot edge cases'];

    const { rerender } = render(
      <GroupNavigationHeader
        groups={groups}
        activeGroupIndex={0}
        onNavigate={jest.fn()}
        onDismiss={jest.fn()}
        commonPatterns={patterns}
      />
    );

    expect(screen.getByText('Most students used a for loop')).toBeInTheDocument();
    expect(screen.getByText('Several forgot edge cases')).toBeInTheDocument();

    // Not shown for non-all group
    rerender(
      <GroupNavigationHeader
        groups={groups}
        activeGroupIndex={1}
        onNavigate={jest.fn()}
        onDismiss={jest.fn()}
        commonPatterns={patterns}
      />
    );

    expect(screen.queryByText('Most students used a for loop')).not.toBeInTheDocument();
  });
});
