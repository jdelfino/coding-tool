import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionEndedNotification from '../SessionEndedNotification';

describe('SessionEndedNotification', () => {
  it('renders normal ended message without replacement', () => {
    render(
      <SessionEndedNotification
        onLeaveToDashboard={jest.fn()}
        code="print('hello')"
      />
    );

    expect(screen.getByText(/Session ended/)).toBeInTheDocument();
    expect(screen.queryByTestId('join-new-session-button')).not.toBeInTheDocument();
  });

  it('renders Join New Session button when replacementSessionId is set', () => {
    render(
      <SessionEndedNotification
        onLeaveToDashboard={jest.fn()}
        code="print('hello')"
        replacementSessionId="new-session-123"
        onJoinNewSession={jest.fn()}
      />
    );

    expect(screen.getByTestId('join-new-session-button')).toBeInTheDocument();
    expect(screen.getByText('Join New Session')).toBeInTheDocument();
    expect(screen.getByText(/instructor started a new problem/)).toBeInTheDocument();
  });

  it('calls onJoinNewSession when Join New Session button is clicked', () => {
    const onJoinNewSession = jest.fn();
    render(
      <SessionEndedNotification
        onLeaveToDashboard={jest.fn()}
        code="print('hello')"
        replacementSessionId="new-session-123"
        onJoinNewSession={onJoinNewSession}
      />
    );

    fireEvent.click(screen.getByTestId('join-new-session-button'));
    expect(onJoinNewSession).toHaveBeenCalledTimes(1);
  });

  it('still shows Copy Code and Back to Sections as secondary actions with replacement', () => {
    render(
      <SessionEndedNotification
        onLeaveToDashboard={jest.fn()}
        code="print('hello')"
        replacementSessionId="new-session-123"
        onJoinNewSession={jest.fn()}
      />
    );

    expect(screen.getByTestId('copy-code-button')).toBeInTheDocument();
    expect(screen.getByTestId('go-to-dashboard-button')).toBeInTheDocument();
  });
});
