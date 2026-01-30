/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InstructorActions from '../InstructorActions';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'instructor' },
    isLoading: false,
  }),
}));

jest.mock('@/app/(app)/instructor/components/CreateSessionFromProblemModal', () => {
  return function MockModal({ onSuccess }: { onSuccess: (id: string) => void }) {
    return (
      <div data-testid="mock-modal">
        <button onClick={() => onSuccess('new-session-123')}>Confirm</button>
      </div>
    );
  };
});

beforeEach(() => {
  (globalThis as Record<string, unknown>).BroadcastChannel = jest.fn().mockImplementation(() => ({
    postMessage: jest.fn(),
    close: jest.fn(),
  }));
});

describe('InstructorActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to public-view after session creation', () => {
    render(<InstructorActions problemId="prob-1" problemTitle="Test Problem" classId="class-1" />);

    fireEvent.click(screen.getByText('Start Session'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(mockPush).toHaveBeenCalledWith('/public-view?sessionId=new-session-123');
  });

  it('posts BroadcastChannel message with sessionId and problemTitle', () => {
    const postedMessages: unknown[] = [];
    const closeCalls: number[] = [];

    const MockBroadcastChannel = jest.fn().mockImplementation(() => ({
      postMessage: (msg: unknown) => postedMessages.push(msg),
      close: () => closeCalls.push(1),
    }));
    (globalThis as Record<string, unknown>).BroadcastChannel = MockBroadcastChannel;

    render(<InstructorActions problemId="prob-1" problemTitle="Test Problem" classId="class-1" />);

    fireEvent.click(screen.getByText('Start Session'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(MockBroadcastChannel).toHaveBeenCalledWith('instructor-session-created');
    expect(postedMessages).toEqual([{ sessionId: 'new-session-123', problemTitle: 'Test Problem' }]);
    expect(closeCalls).toHaveLength(1);
  });
});
