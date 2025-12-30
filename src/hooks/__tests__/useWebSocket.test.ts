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
    // Automatically trigger onopen after a microtask
    setTimeout(() => {
      if (this.onopen && this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen({});
      }
    }, 0);
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
    it('should not connect when URL is empty', () => {
      const { result } = renderHook(() => useWebSocket(''));
      
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });

    it('should connect when URL is provided', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));
      
      expect(result.current.connectionStatus).toBe('connecting');
      
      await act(async () => {
        jest.runAllTimers();
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
        jest.runAllTimers();
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
        jest.runAllTimers();
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
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
      const sendSpy = jest.spyOn(ws, 'send');

      act(() => {
        result.current.sendMessage('TEST', { data: 'test' });
      });

      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({ 
        type: 'TEST', 
        payload: { data: 'test' } 
      }));
    });

    it('should not send messages when disconnected', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));
      
      act(() => {
        result.current.sendMessage('TEST', { data: 'test' });
      });

      expect(result.current.connectionError).toBe('Not connected to server');
    });
  });

  describe('Reconnection logic', () => {
    it('should reconnect after unexpected disconnection', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));
      
      // Wait for initial connection
      await act(async () => {
        jest.runAllTimers();
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

      // Fast-forward reconnection delay
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // Wait for reconnection
      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected');
      }, { timeout: 5000 });
    });

    it('should not reconnect after normal closure (code 1000)', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));
      
      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
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

    it.skip('should use exponential backoff for reconnection attempts', async () => {
      // Mock WebSocket to fail connection attempts
      const originalWebSocket = (global as any).WebSocket;
      let connectionAttempt = 0;
      
      class FailingMockWebSocket extends MockWebSocket {
        constructor(url: string) {
          super(url);
          connectionAttempt++;
          // Fail the first 3 connection attempts immediately
          if (connectionAttempt <= 3) {
            setTimeout(() => {
              this.readyState = MockWebSocket.CLOSED;
              if (this.onclose) {
                this.onclose({ code: 1006 });
              }
            }, 0);
          }
        }
      }
      
      (global as any).WebSocket = FailingMockWebSocket;
      
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));
      
      const delays: number[] = [];

      // Simulate 3 failed connection attempts
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          jest.runAllTimers();
        });

        await waitFor(() => {
          expect(result.current.connectionStatus).toBe('disconnected');
        });

        const errorMessage = result.current.connectionError || '';
        const match = errorMessage.match(/Reconnecting in (\d+)s/);
        if (match) {
          delays.push(parseInt(match[1]));
        }

        // Advance to the next reconnection attempt
        await act(async () => {
          jest.advanceTimersByTime(Math.pow(2, i) * 1000 + 100);
        });
      }

      // Restore original WebSocket
      (global as any).WebSocket = originalWebSocket;

      // Verify exponential backoff: 1s, 2s, 4s
      expect(delays).toEqual([1, 2, 4]);
    });

    it.skip('should stop reconnecting after max attempts', async () => {
      // Mock WebSocket to always fail
      const originalWebSocket = (global as any).WebSocket;
      
      class AlwaysFailingMockWebSocket extends MockWebSocket {
        constructor(url: string) {
          super(url);
          // Always fail connection attempts immediately
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED;
            if (this.onclose) {
              this.onclose({ code: 1006 });
            }
          }, 0);
        }
      }
      
      (global as any).WebSocket = AlwaysFailingMockWebSocket;
      
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

      // Let all 5 connection attempts fail
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          jest.runAllTimers();
        });

        await waitFor(() => {
          expect(result.current.connectionStatus).toBe('disconnected');
        });

        // Advance time to trigger next reconnection attempt (if not at max)
        if (i < 4) {
          await act(async () => {
            jest.advanceTimersByTime(Math.pow(2, i) * 1000 + 100);
          });
        }
      }

      // Advance time to see if it tries to reconnect again (it shouldn't)
      await act(async () => {
        jest.advanceTimersByTime(30000);
        jest.runAllTimers();
      });

      // Restore original WebSocket
      (global as any).WebSocket = originalWebSocket;

      // Should now be in failed state
      expect(result.current.connectionStatus).toBe('failed');
      expect(result.current.connectionError).toBe('Unable to reconnect. Please refresh the page.');
    });

    it('should handle URL change during reconnection', async () => {
      const { result, rerender } = renderHook(
        ({ url }) => useWebSocket(url),
        { initialProps: { url: 'ws://localhost:3000/ws' } }
      );
      
      await act(async () => {
        jest.runAllTimers();
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
        jest.runAllTimers();
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
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const firstWs = (MockWebSocket as any).lastInstance as MockWebSocket;
      const closeSpy = jest.spyOn(firstWs, 'close');

      // Change URL
      rerender({ url: 'ws://localhost:4000/ws' });

      await act(async () => {
        jest.runAllTimers();
      });

      // Verify the old connection was closed
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should clear pending reconnection timeout when unmounted', async () => {
      const { result, unmount } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));
      
      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Disconnect to trigger reconnection timer
      await act(async () => {
        const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
        ws.simulateClose(1006);
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
        jest.runAllTimers();
      });

      // Should eventually connect to the last URL
      const ws = (MockWebSocket as any).lastInstance as MockWebSocket;
      expect(ws.url).toBe('ws://localhost:6000/ws');
    });

    it('should reset reconnection attempts after successful connection', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));
      
      await act(async () => {
        jest.runAllTimers();
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
        jest.runAllTimers();
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
