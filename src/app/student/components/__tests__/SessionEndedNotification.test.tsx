/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionEndedNotification from '../SessionEndedNotification';

describe('SessionEndedNotification', () => {
  const mockOnLeaveToDashboard = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic rendering', () => {
    it('renders the session ended notification', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
        />
      );

      expect(screen.getByTestId('session-ended-notification')).toBeInTheDocument();
      expect(screen.getByText('Session Ended')).toBeInTheDocument();
    });

    it('displays the main messaging about session ending', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
        />
      );

      expect(screen.getByText('The instructor has ended this session.')).toBeInTheDocument();
      expect(screen.getByText('You can no longer run code, but you can copy your work below.')).toBeInTheDocument();
    });

    it('shows code saved message when codeSaved is true', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
          codeSaved={true}
        />
      );

      expect(screen.getByTestId('code-saved-message')).toBeInTheDocument();
      expect(screen.getByText('Your code has been saved automatically.')).toBeInTheDocument();
    });

    it('hides code saved message when codeSaved is false', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
          codeSaved={false}
        />
      );

      expect(screen.queryByTestId('code-saved-message')).not.toBeInTheDocument();
    });
  });

  describe('Go to Dashboard button', () => {
    it('renders the Go to Dashboard button', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
        />
      );

      expect(screen.getByTestId('go-to-dashboard-button')).toBeInTheDocument();
      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    });

    it('calls onLeaveToDashboard when button is clicked', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
        />
      );

      fireEvent.click(screen.getByTestId('go-to-dashboard-button'));
      expect(mockOnLeaveToDashboard).toHaveBeenCalledTimes(1);
    });
  });

  describe('Copy Code button', () => {
    it('does not show Copy Code button when no code is provided', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
        />
      );

      expect(screen.queryByTestId('copy-code-button')).not.toBeInTheDocument();
    });

    it('does not show Copy Code button when code is empty string', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
          code=""
        />
      );

      expect(screen.queryByTestId('copy-code-button')).not.toBeInTheDocument();
    });

    it('shows Copy Code button when code is provided', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
          code="print('hello world')"
        />
      );

      expect(screen.getByTestId('copy-code-button')).toBeInTheDocument();
      expect(screen.getByText('Copy Code')).toBeInTheDocument();
    });

    it('copies code to clipboard when Copy Code button is clicked', async () => {
      const testCode = "print('hello world')";
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
          code={testCode}
        />
      );

      fireEvent.click(screen.getByTestId('copy-code-button'));

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testCode);
      });
    });

    it('shows Copied! message after successful copy', async () => {
      jest.useFakeTimers();
      const testCode = "print('hello world')";
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
          code={testCode}
        />
      );

      fireEvent.click(screen.getByTestId('copy-code-button'));

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });

      // The button should revert after 2 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByText('Copy Code')).toBeInTheDocument();
      });
    });

    it('handles clipboard API failure gracefully with fallback', async () => {
      // Mock clipboard failure
      const clipboardError = new Error('Clipboard not available');
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockRejectedValue(clipboardError),
        },
      });

      // Mock document.execCommand for fallback
      const mockExecCommand = jest.fn().mockReturnValue(true);
      document.execCommand = mockExecCommand;

      const testCode = "print('hello world')";
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
          code={testCode}
        />
      );

      fireEvent.click(screen.getByTestId('copy-code-button'));

      await waitFor(() => {
        expect(mockExecCommand).toHaveBeenCalledWith('copy');
      });
    });
  });

  describe('styling and accessibility', () => {
    it('has appropriate aria attributes', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
          code="test"
        />
      );

      // Check that SVG icons have aria-hidden
      const svgs = document.querySelectorAll('svg[aria-hidden="true"]');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('uses semantic button elements', () => {
      render(
        <SessionEndedNotification
          onLeaveToDashboard={mockOnLeaveToDashboard}
          code="test"
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(2); // Copy Code and Go to Dashboard
    });
  });
});
