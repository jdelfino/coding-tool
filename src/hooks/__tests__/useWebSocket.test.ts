/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket';

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number;
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    // Store instance for test access
    (MockWebSocket as any).lastInstance = this;
    // Don't auto-trigger onopen - tests must explicitly call triggerOpen()
  }

  // Helper to manually trigger open event
  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen({});
    }
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code?: number) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: code || 1000 });
    }
  }

  // Helper to simulate server closing connection
  simulateClose(code: number = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code });
    }
  }

  // Helper to simulate error
  simulateError() {
    if (this.onerror) {
      this.onerror({});
    }
  }

  // Helper to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

// Replace global WebSocket with mock
const originalWebSocket = global.WebSocket;
beforeAll(() => {
  (global as any).WebSocket = MockWebSocket;
});

afterAll(() => {
  global.WebSocket = originalWebSocket;
});

describe('useWebSocket', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial connection', () => {
    it('should not connect when URL is empty', async () => {
      const { result } = renderHook(() => useWebSocket(''));

      // Use waitFor to ensure React finishes all pending updates
      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('disconnected');
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('should connect when URL is provided', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      expect(result.current.connectionStatus).toBe('connecting');

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected');
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('should handle connection error', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.simulateError();
      });

      expect(result.current.connectionError).toBe('Connection error occurred');
    });
  });

  describe('Message handling', () => {
    it('should receive and parse messages', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const testMessage = { type: 'TEST', payload: { data: 'test' } };

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.simulateMessage(testMessage);
      });

      expect(result.current.lastMessage).toEqual(testMessage);
    });

    it('should handle invalid message format', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        if (ws.onmessage) {
          ws.onmessage({ data: 'invalid json' });
        }
      });

      expect(result.current.connectionError).toBe('Received invalid message from server');
    });
  });

  describe('Sending messages', () => {
    it('should send messages when connected', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
      const sendSpy = jest.spyOn(ws, 'send');

      await act(async () => {
        result.current.sendMessage('TEST', { data: 'test' });
      });

      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({
        type: 'TEST',
        payload: { data: 'test' }
      }));
    });

    it('should not send messages when disconnected', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      await act(async () => {
        result.current.sendMessage('TEST', { data: 'test' });
      });

      await waitFor(() => {
        expect(result.current.connectionError).toBe('Not connected to server');
      });
    });
  });

  describe('Reconnection logic', () => {
    it('should reconnect after unexpected disconnection', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      // Wait for initial connection
      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate unexpected disconnection (code !== 1000)
      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.simulateClose(1006);
      });

      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);

      // Fast-forward reconnection delay and trigger connection
      await act(async () => {
        jest.advanceTimersByTime(1000);
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected');
      }, { timeout: 5000 });
    });

    it('should not reconnect after normal closure (code 1000)', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      const initialInstance = (MockWebSocket as any).lastInstance;

      // Simulate normal closure
      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.close(1000);
      });

      expect(result.current.connectionStatus).toBe('disconnected');

      // Wait for potential reconnection
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Should not have created a new WebSocket instance
      expect((MockWebSocket as any).lastInstance).toBe(initialInstance);
    });

    it('should handle URL change during reconnection', async () => {
      const { result, rerender } = renderHook(
        ({ url }) => useWebSocket(url),
        { initialProps: { url: 'ws://localhost:3000/ws' } }
      );

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Disconnect
      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.simulateClose(1006);
      });

      // Change URL before reconnection happens
      rerender({ url: 'ws://localhost:4000/ws' });

      // Trigger reconnection
      await act(async () => {
        jest.advanceTimersByTime(1000);
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Verify it connected to the new URL
      const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
      expect(ws.url).toBe('ws://localhost:4000/ws');
    });

    it('should close existing connection before creating new one', async () => {
      const { result, rerender } = renderHook(
        ({ url }) => useWebSocket(url),
        { initialProps: { url: 'ws://localhost:3000/ws' } }
      );

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const firstWs = (MockWebSocket as any).lastInstance as MockWebSocket;
      const closeSpy = jest.spyOn(firstWs, 'close');

      // Change URL
      rerender({ url: 'ws://localhost:4000/ws' });

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      // Verify the old connection was closed
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should clear pending reconnection timeout when unmounted', async () => {
      const { result, unmount } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Disconnect to trigger reconnection timer
      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.simulateClose(1006);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // Unmount before reconnection happens
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid URL changes', async () => {
      const { rerender } = renderHook(
        ({ url }) => useWebSocket(url),
        { initialProps: { url: 'ws://localhost:3000/ws' } }
      );

      // Rapidly change URL multiple times
      await act(async () => {
        rerender({ url: 'ws://localhost:4000/ws' });
        rerender({ url: 'ws://localhost:5000/ws' });
        rerender({ url: 'ws://localhost:6000/ws' });
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      // Should eventually connect to the last URL
      const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
      expect(ws.url).toBe('ws://localhost:6000/ws');
    });

    it('should reset reconnection attempts after successful connection', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Disconnect and reconnect once
      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.simulateClose(1006);
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.triggerOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Disconnect again
      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.simulateClose(1006);
      });

      // Should start with 1s delay again, not 2s
      const errorMessage = result.current.connectionError || '';
      expect(errorMessage).toContain('Reconnecting in 1s');
    });
  });
});
