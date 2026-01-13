/**
 * Tests for Vercel Sandbox structured logging
 */

import { logSandboxEvent, withSandboxLogging, SandboxLogEntry } from '../logger';

describe('logSandboxEvent', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('logs successful events to console.log', () => {
    const entry: SandboxLogEntry = {
      event: 'sandbox_create',
      sessionId: 'test-session',
      sandboxId: 'sb_123',
      durationMs: 500,
      success: true,
    };

    logSandboxEvent(entry);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(loggedData).toMatchObject({
      service: 'vercel-sandbox',
      level: 'info',
      event: 'sandbox_create',
      sessionId: 'test-session',
      sandboxId: 'sb_123',
      durationMs: 500,
      success: true,
    });
    expect(loggedData.timestamp).toBeDefined();
  });

  it('logs failed events to console.error', () => {
    const entry: SandboxLogEntry = {
      event: 'sandbox_execute',
      sessionId: 'test-session',
      durationMs: 100,
      success: false,
      error: 'Execution failed',
      errorCode: 'EXECUTION_FAILED',
    };

    logSandboxEvent(entry);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).not.toHaveBeenCalled();

    const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(loggedData).toMatchObject({
      service: 'vercel-sandbox',
      level: 'error',
      event: 'sandbox_execute',
      sessionId: 'test-session',
      success: false,
      error: 'Execution failed',
      errorCode: 'EXECUTION_FAILED',
    });
  });

  it('includes metadata when provided', () => {
    const entry: SandboxLogEntry = {
      event: 'sandbox_reconnect',
      sessionId: 'test-session',
      success: true,
      metadata: {
        status: 'running',
        reconnectAttempt: 1,
      },
    };

    logSandboxEvent(entry);

    const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(loggedData.metadata).toEqual({
      status: 'running',
      reconnectAttempt: 1,
    });
  });

  it('logs all event types correctly', () => {
    const eventTypes: SandboxLogEntry['event'][] = [
      'sandbox_create',
      'sandbox_reconnect',
      'sandbox_recreate',
      'sandbox_execute',
      'sandbox_trace',
      'sandbox_cleanup',
      'sandbox_error',
    ];

    eventTypes.forEach((event) => {
      consoleLogSpy.mockClear();
      logSandboxEvent({
        event,
        sessionId: 'test',
        success: true,
      });

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.event).toBe(event);
    });
  });
});

describe('withSandboxLogging', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('logs success and returns result for successful operations', async () => {
    const result = await withSandboxLogging(
      'sandbox_create',
      'test-session',
      async () => 'sandbox-id-123'
    );

    expect(result).toBe('sandbox-id-123');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);

    const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(loggedData.success).toBe(true);
    expect(loggedData.event).toBe('sandbox_create');
    expect(loggedData.sessionId).toBe('test-session');
    expect(loggedData.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('logs failure and rethrows error for failed operations', async () => {
    const testError = new Error('Test failure');

    await expect(
      withSandboxLogging('sandbox_execute', 'test-session', async () => {
        throw testError;
      })
    ).rejects.toThrow('Test failure');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(loggedData.success).toBe(false);
    expect(loggedData.error).toBe('Test failure');
  });

  it('includes metadata from getMetadata callback', async () => {
    await withSandboxLogging(
      'sandbox_create',
      'test-session',
      async () => ({ id: 'sb_123', status: 'running' }),
      (result) => ({ sandboxId: result.id, status: result.status })
    );

    const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(loggedData.metadata).toEqual({
      sandboxId: 'sb_123',
      status: 'running',
    });
  });

  it('measures duration accurately', async () => {
    const delay = 50;
    await withSandboxLogging('sandbox_execute', 'test-session', async () => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return 'done';
    });

    const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(loggedData.durationMs).toBeGreaterThanOrEqual(delay - 10); // Allow some timing variance
    expect(loggedData.durationMs).toBeLessThan(delay + 100);
  });
});
