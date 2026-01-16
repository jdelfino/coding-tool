/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConnectionStatus, ConnectionState } from '../ConnectionStatus';

describe('ConnectionStatus', () => {
  describe('Badge variant (default)', () => {
    describe('Connected state', () => {
      it('renders connected status with green indicator', () => {
        render(<ConnectionStatus status="connected" />);

        const container = screen.getByTestId('connection-status');
        expect(container).toHaveAttribute('data-status', 'connected');
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      it('does not show description when connected', () => {
        render(<ConnectionStatus status="connected" />);

        expect(screen.queryByTestId('connection-status-description')).not.toBeInTheDocument();
      });

      it('does not show reconnect button when connected', () => {
        render(<ConnectionStatus status="connected" onReconnect={jest.fn()} />);

        expect(screen.queryByTestId('reconnect-button')).not.toBeInTheDocument();
      });
    });

    describe('Connecting state', () => {
      it('renders connecting status with guidance message', () => {
        render(<ConnectionStatus status="connecting" />);

        const container = screen.getByTestId('connection-status');
        expect(container).toHaveAttribute('data-status', 'connecting');
        expect(screen.getByText('Connecting...')).toBeInTheDocument();
        expect(screen.getByTestId('connection-status-description')).toHaveTextContent(
          'Please wait, establishing connection'
        );
      });

      it('does not show reconnect button when connecting', () => {
        render(<ConnectionStatus status="connecting" onReconnect={jest.fn()} />);

        expect(screen.queryByTestId('reconnect-button')).not.toBeInTheDocument();
      });
    });

    describe('Disconnected state', () => {
      it('renders disconnected status with reconnecting message', () => {
        render(<ConnectionStatus status="disconnected" />);

        const container = screen.getByTestId('connection-status');
        expect(container).toHaveAttribute('data-status', 'disconnected');
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
        expect(screen.getByTestId('connection-status-description')).toHaveTextContent(
          'Attempting to reconnect...'
        );
      });

      it('shows reconnect attempt count when reconnecting', () => {
        render(
          <ConnectionStatus
            status="disconnected"
            reconnectAttempt={2}
            maxReconnectAttempts={5}
          />
        );

        expect(screen.getByTestId('connection-status-description')).toHaveTextContent(
          'Reconnecting (attempt 2 of 5)...'
        );
      });
    });

    describe('Failed state', () => {
      it('renders failed status with error message', () => {
        render(<ConnectionStatus status="failed" />);

        const container = screen.getByTestId('connection-status');
        expect(container).toHaveAttribute('data-status', 'failed');
        expect(screen.getByText('Connection Failed')).toBeInTheDocument();
        expect(screen.getByTestId('connection-status-description')).toHaveTextContent(
          'Check your internet connection and try again.'
        );
      });

      it('shows custom error message when provided', () => {
        render(
          <ConnectionStatus
            status="failed"
            error="Server is unavailable"
          />
        );

        expect(screen.getByTestId('connection-status-description')).toHaveTextContent(
          'Server is unavailable'
        );
      });

      it('shows reconnect button in failed state', () => {
        const onReconnect = jest.fn();
        render(<ConnectionStatus status="failed" onReconnect={onReconnect} />);

        const button = screen.getByTestId('reconnect-button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent('Reconnect');
      });

      it('calls onReconnect when button is clicked', () => {
        const onReconnect = jest.fn();
        render(<ConnectionStatus status="failed" onReconnect={onReconnect} />);

        fireEvent.click(screen.getByTestId('reconnect-button'));
        expect(onReconnect).toHaveBeenCalledTimes(1);
      });

      it('disables reconnect button when reconnecting', () => {
        const onReconnect = jest.fn();
        render(
          <ConnectionStatus
            status="failed"
            onReconnect={onReconnect}
            isReconnecting={true}
          />
        );

        const button = screen.getByTestId('reconnect-button');
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent('Reconnecting...');
      });

      it('does not call onReconnect when button is disabled', () => {
        const onReconnect = jest.fn();
        render(
          <ConnectionStatus
            status="failed"
            onReconnect={onReconnect}
            isReconnecting={true}
          />
        );

        fireEvent.click(screen.getByTestId('reconnect-button'));
        expect(onReconnect).not.toHaveBeenCalled();
      });
    });
  });

  describe('Banner variant', () => {
    it('renders banner with correct data-testid', () => {
      render(<ConnectionStatus status="connected" variant="banner" />);

      expect(screen.getByTestId('connection-status-banner')).toBeInTheDocument();
    });

    it('shows reconnect button in banner for failed state', () => {
      const onReconnect = jest.fn();
      render(
        <ConnectionStatus
          status="failed"
          variant="banner"
          onReconnect={onReconnect}
        />
      );

      const button = screen.getByTestId('reconnect-button');
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(onReconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Connection timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('shows timeout message after threshold is exceeded', () => {
      const connectionStartTime = Date.now() - 15000; // 15 seconds ago

      render(
        <ConnectionStatus
          status="connecting"
          connectionStartTime={connectionStartTime}
          timeoutThreshold={10000}
        />
      );

      // The timeout check runs immediately on mount
      expect(screen.getByText('Still connecting...')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status-description')).toHaveTextContent(
        'Taking longer than expected. Check your internet connection.'
      );
    });

    it('does not show timeout message before threshold', () => {
      const connectionStartTime = Date.now() - 5000; // 5 seconds ago

      render(
        <ConnectionStatus
          status="connecting"
          connectionStartTime={connectionStartTime}
          timeoutThreshold={10000}
        />
      );

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status-description')).toHaveTextContent(
        'Please wait, establishing connection'
      );
    });

    it('updates to timeout message when threshold is crossed', () => {
      const connectionStartTime = Date.now();

      render(
        <ConnectionStatus
          status="connecting"
          connectionStartTime={connectionStartTime}
          timeoutThreshold={10000}
        />
      );

      // Initially shows normal connecting message
      expect(screen.getByText('Connecting...')).toBeInTheDocument();

      // Advance time past threshold
      act(() => {
        jest.advanceTimersByTime(11000);
      });

      // Now shows timeout message
      expect(screen.getByText('Still connecting...')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status-description')).toHaveTextContent(
        'Taking longer than expected. Check your internet connection.'
      );
    });

    it('clears timeout state when status changes from connecting', () => {
      const connectionStartTime = Date.now() - 15000;

      const { rerender } = render(
        <ConnectionStatus
          status="connecting"
          connectionStartTime={connectionStartTime}
          timeoutThreshold={10000}
        />
      );

      expect(screen.getByText('Still connecting...')).toBeInTheDocument();

      // Status changes to connected
      rerender(
        <ConnectionStatus
          status="connected"
          connectionStartTime={null as any}
          timeoutThreshold={10000}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles unknown status gracefully', () => {
      render(<ConnectionStatus status={'unknown' as ConnectionState} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('does not show reconnect button without onReconnect callback', () => {
      render(<ConnectionStatus status="failed" />);

      expect(screen.queryByTestId('reconnect-button')).not.toBeInTheDocument();
    });

    it('handles zero reconnect attempts', () => {
      render(
        <ConnectionStatus
          status="disconnected"
          reconnectAttempt={0}
          maxReconnectAttempts={5}
        />
      );

      expect(screen.getByTestId('connection-status-description')).toHaveTextContent(
        'Attempting to reconnect...'
      );
    });
  });
});
