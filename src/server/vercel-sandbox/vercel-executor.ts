/**
 * Vercel Sandbox Executor
 *
 * Provides code execution using Vercel's Sandbox service. Sandboxes are
 * created eagerly when sessions are created and reused across executions.
 *
 * Architecture:
 * - Session creation: createSessionSandbox() → stores sandbox_id in Supabase
 * - Execution: getSandbox() → reconnect → executeCode
 * - Session end: cleanupSandbox() → stop sandbox
 *
 * Timeout handling:
 * - Sandbox timeout: 45 minutes (Hobby plan max)
 * - If sandbox times out, getSandbox() recreates it automatically
 * - Per-execution timeout: 10 seconds
 */

import { Sandbox } from '@vercel/sandbox';
import { getSupabaseClient } from '../supabase/client';
import { ExecutionResult, CodeSubmission, ExecutionTrace } from '../types';
import { TRACER_SCRIPT, TRACER_PATH } from './tracer-script';
import { logSandboxEvent } from './logger';

// Session sandbox timeout: 45 minutes (Hobby plan max)
const SESSION_TIMEOUT_MS = 45 * 60 * 1000;

// Per-execution timeout: 10 seconds
const EXECUTION_TIMEOUT_MS = 10_000;

// Working directory for code execution
const SANDBOX_CWD = '/vercel/sandbox';

/**
 * Error thrown when sandbox operations fail
 */
export class SandboxError extends Error {
  constructor(
    message: string,
    public readonly code: 'CREATION_FAILED' | 'RECONNECTION_FAILED' | 'EXECUTION_FAILED' | 'TIMEOUT' | 'UNAVAILABLE',
    public readonly sessionId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

/**
 * Create a new sandbox for a session
 *
 * Called when a session is created. Stores sandbox_id in Supabase
 * for reconnection across serverless invocations.
 *
 * @param sessionId - Session ID to associate with sandbox
 * @returns Sandbox ID
 * @throws SandboxError if creation fails
 */
export async function createSessionSandbox(sessionId: string): Promise<string> {
  const startTime = Date.now();

  try {
    const sandbox = await Sandbox.create({
      runtime: 'python3.13',
      timeout: SESSION_TIMEOUT_MS,
    });

    // Store sandbox ID in Supabase for reconnection
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('session_sandboxes')
      .insert({
        session_id: sessionId,
        sandbox_id: sandbox.sandboxId,
      });

    if (error) {
      // Clean up sandbox if DB insert fails
      try {
        await sandbox.stop();
      } catch {
        // Ignore cleanup errors
      }
      throw new SandboxError(
        `Failed to store sandbox ID: ${error.message}`,
        'CREATION_FAILED',
        sessionId
      );
    }

    logSandboxEvent({
      event: 'sandbox_create',
      sessionId,
      sandboxId: sandbox.sandboxId,
      durationMs: Date.now() - startTime,
      success: true,
    });

    return sandbox.sandboxId;
  } catch (error) {
    logSandboxEvent({
      event: 'sandbox_create',
      sessionId,
      durationMs: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: error instanceof SandboxError ? error.code : undefined,
    });

    if (error instanceof SandboxError) {
      throw error;
    }
    throw new SandboxError(
      `Failed to create sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'CREATION_FAILED',
      sessionId,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get or recreate a sandbox for a session
 *
 * Fetches sandbox_id from Supabase and reconnects. If the sandbox
 * has timed out or failed, creates a new one.
 *
 * @param sessionId - Session ID to get sandbox for
 * @returns Active Sandbox instance
 * @throws SandboxError if sandbox cannot be obtained
 */
export async function getSandbox(sessionId: string): Promise<Sandbox> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  // Fetch sandbox ID from Supabase
  const { data, error } = await supabase
    .from('session_sandboxes')
    .select('sandbox_id')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) {
    logSandboxEvent({
      event: 'sandbox_reconnect',
      sessionId,
      durationMs: Date.now() - startTime,
      success: false,
      error: `No sandbox found: ${error?.message || 'Not found'}`,
      errorCode: 'UNAVAILABLE',
    });
    throw new SandboxError(
      `No sandbox found for session: ${error?.message || 'Not found'}`,
      'UNAVAILABLE',
      sessionId
    );
  }

  try {
    // Reconnect to sandbox
    const sandbox = await Sandbox.get({ sandboxId: data.sandbox_id });

    // Check if sandbox is still running
    if (sandbox.status === 'running') {
      logSandboxEvent({
        event: 'sandbox_reconnect',
        sessionId,
        sandboxId: data.sandbox_id,
        durationMs: Date.now() - startTime,
        success: true,
      });
      return sandbox;
    }

    // Sandbox has timed out or failed - recreate
    logSandboxEvent({
      event: 'sandbox_reconnect',
      sessionId,
      sandboxId: data.sandbox_id,
      durationMs: Date.now() - startTime,
      success: false,
      error: `Sandbox status is ${sandbox.status}`,
      metadata: { status: sandbox.status, needsRecreate: true },
    });
    return await recreateSandbox(sessionId, data.sandbox_id);
  } catch (error) {
    // Sandbox may not exist anymore - try to recreate
    logSandboxEvent({
      event: 'sandbox_reconnect',
      sessionId,
      sandboxId: data.sandbox_id,
      durationMs: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: { needsRecreate: true },
    });
    return await recreateSandbox(sessionId, data.sandbox_id);
  }
}

/**
 * Recreate a sandbox for a session
 *
 * Creates a new sandbox and updates the session_sandboxes record.
 * Uses optimistic locking to handle race conditions.
 *
 * @param sessionId - Session ID
 * @param oldSandboxId - Previous sandbox ID (for optimistic locking)
 * @returns New Sandbox instance
 */
async function recreateSandbox(sessionId: string, oldSandboxId: string): Promise<Sandbox> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  try {
    const newSandbox = await Sandbox.create({
      runtime: 'python3.13',
      timeout: SESSION_TIMEOUT_MS,
    });

    // Optimistic locking: only update if sandbox_id hasn't changed
    const { data, error } = await supabase
      .from('session_sandboxes')
      .update({ sandbox_id: newSandbox.sandboxId })
      .eq('session_id', sessionId)
      .eq('sandbox_id', oldSandboxId)
      .select()
      .single();

    if (error || !data) {
      // Someone else won the race - use their sandbox
      try {
        await newSandbox.stop();
      } catch {
        // Ignore cleanup error - orphan will auto-timeout
      }

      // Fetch the winner's sandbox
      const { data: winner } = await supabase
        .from('session_sandboxes')
        .select('sandbox_id')
        .eq('session_id', sessionId)
        .single();

      if (!winner) {
        logSandboxEvent({
          event: 'sandbox_recreate',
          sessionId,
          durationMs: Date.now() - startTime,
          success: false,
          error: 'Failed to get sandbox after race condition',
          metadata: { oldSandboxId, raceCondition: true },
        });
        throw new SandboxError(
          'Failed to get sandbox after race condition',
          'RECONNECTION_FAILED',
          sessionId
        );
      }

      logSandboxEvent({
        event: 'sandbox_recreate',
        sessionId,
        sandboxId: winner.sandbox_id,
        durationMs: Date.now() - startTime,
        success: true,
        metadata: { oldSandboxId, raceCondition: true, usedWinner: true },
      });

      return await Sandbox.get({ sandboxId: winner.sandbox_id });
    }

    logSandboxEvent({
      event: 'sandbox_recreate',
      sessionId,
      sandboxId: newSandbox.sandboxId,
      durationMs: Date.now() - startTime,
      success: true,
      metadata: { oldSandboxId },
    });

    return newSandbox;
  } catch (error) {
    logSandboxEvent({
      event: 'sandbox_recreate',
      sessionId,
      durationMs: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: error instanceof SandboxError ? error.code : undefined,
      metadata: { oldSandboxId },
    });

    if (error instanceof SandboxError) {
      throw error;
    }
    throw new SandboxError(
      `Failed to recreate sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'RECONNECTION_FAILED',
      sessionId,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Execute code on Vercel Sandbox
 *
 * @param sessionId - Session ID (for sandbox lookup)
 * @param submission - Code submission with execution settings
 * @returns Execution result
 */
export async function executeOnVercelSandbox(
  sessionId: string,
  submission: CodeSubmission
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const { code, executionSettings } = submission;
  const stdin = executionSettings?.stdin;
  const randomSeed = executionSettings?.randomSeed;
  const attachedFiles = executionSettings?.attachedFiles;

  try {
    const sandbox = await getSandbox(sessionId);

    // Prepare code with random seed injection if needed
    let executionCode = code;
    if (randomSeed !== undefined) {
      const seedInjection = `import random\nrandom.seed(${randomSeed})\n`;
      executionCode = seedInjection + code;
    }

    // Build files to write
    const filesToWrite: Array<{ path: string; content: Buffer }> = [
      { path: 'main.py', content: Buffer.from(executionCode) },
    ];

    // Add stdin file if provided
    if (stdin !== undefined && stdin !== null) {
      filesToWrite.push({ path: '/tmp/stdin.txt', content: Buffer.from(stdin) });
    }

    // Add attached files
    if (attachedFiles && attachedFiles.length > 0) {
      for (const file of attachedFiles) {
        const sanitizedName = sanitizeFilename(file.name);
        filesToWrite.push({ path: sanitizedName, content: Buffer.from(file.content) });
      }
    }

    // Write all files
    await sandbox.writeFiles(filesToWrite);

    // Build command arguments
    const pythonArgs = ['main.py'];

    // Handle stdin by reading from file if provided
    // The code will need to read from /tmp/stdin.txt
    // Alternative: we could use shell redirection, but direct file read is simpler

    // Execute with timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXECUTION_TIMEOUT_MS);

    try {
      const result = await sandbox.runCommand({
        cmd: 'python3',
        args: pythonArgs,
        cwd: SANDBOX_CWD,
        signal: controller.signal,
      });

      const stdout = await result.stdout();
      const stderr = await result.stderr();
      const executionTime = Date.now() - startTime;
      const success = result.exitCode === 0 && stderr.length === 0;

      logSandboxEvent({
        event: 'sandbox_execute',
        sessionId,
        durationMs: executionTime,
        success,
        metadata: {
          exitCode: result.exitCode,
          hasStderr: stderr.length > 0,
          codeLength: code.length,
        },
      });

      return {
        success,
        output: stdout,
        error: stderr,
        executionTime,
        stdin,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;

    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      logSandboxEvent({
        event: 'sandbox_execute',
        sessionId,
        durationMs: executionTime,
        success: false,
        error: 'Execution timed out',
        errorCode: 'TIMEOUT',
        metadata: { codeLength: code.length },
      });
      return {
        success: false,
        output: '',
        error: `Execution timed out after ${EXECUTION_TIMEOUT_MS}ms`,
        executionTime,
        stdin,
      };
    }

    // Handle sandbox errors
    if (error instanceof SandboxError) {
      logSandboxEvent({
        event: 'sandbox_execute',
        sessionId,
        durationMs: executionTime,
        success: false,
        error: error.message,
        errorCode: error.code,
        metadata: { codeLength: code.length },
      });
      return {
        success: false,
        output: '',
        error: `Code execution temporarily unavailable: ${error.message}`,
        executionTime,
        stdin,
      };
    }

    logSandboxEvent({
      event: 'sandbox_execute',
      sessionId,
      durationMs: executionTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: { codeLength: code.length },
    });

    return {
      success: false,
      output: '',
      error: `Failed to execute code: ${error instanceof Error ? error.message : 'Unknown error'}`,
      executionTime,
      stdin,
    };
  }
}

/**
 * Cleanup sandbox when session ends
 *
 * Stops the sandbox and removes the session_sandboxes record.
 * Failures are logged but not thrown - sandbox will auto-timeout anyway.
 *
 * @param sessionId - Session ID
 */
export async function cleanupSandbox(sessionId: string): Promise<void> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  try {
    // Get sandbox ID
    const { data } = await supabase
      .from('session_sandboxes')
      .select('sandbox_id')
      .eq('session_id', sessionId)
      .single();

    if (!data) {
      // No sandbox record - nothing to clean up
      logSandboxEvent({
        event: 'sandbox_cleanup',
        sessionId,
        durationMs: Date.now() - startTime,
        success: true,
        metadata: { noRecord: true },
      });
      return;
    }

    // Stop sandbox (best effort)
    let stopError: string | undefined;
    try {
      const sandbox = await Sandbox.get({ sandboxId: data.sandbox_id });
      if (sandbox.status === 'running') {
        await sandbox.stop();
      }
    } catch (error) {
      stopError = error instanceof Error ? error.message : 'Unknown error';
      // Continue with cleanup - sandbox may already be stopped
    }

    // Delete record (ON DELETE CASCADE handles this when session is deleted,
    // but we clean up explicitly for session end without deletion)
    await supabase
      .from('session_sandboxes')
      .delete()
      .eq('session_id', sessionId);

    logSandboxEvent({
      event: 'sandbox_cleanup',
      sessionId,
      sandboxId: data.sandbox_id,
      durationMs: Date.now() - startTime,
      success: true,
      metadata: stopError ? { stopWarning: stopError } : undefined,
    });
  } catch (error) {
    logSandboxEvent({
      event: 'sandbox_cleanup',
      sessionId,
      durationMs: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - sandbox will auto-timeout
  }
}

/**
 * Check if a session has a sandbox
 *
 * @param sessionId - Session ID
 * @returns true if session has a sandbox record
 */
export async function hasSandbox(sessionId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('session_sandboxes')
    .select('session_id')
    .eq('session_id', sessionId)
    .single();

  return !error && data !== null;
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\.+/, '_');

  if (!sanitized || sanitized.trim() === '') {
    return 'unnamed_file.txt';
  }

  return sanitized;
}

/**
 * Trace options for execution tracing
 */
export interface TraceOptions {
  stdin?: string;
  maxSteps?: number;
}

const DEFAULT_MAX_STEPS = 5000;

/**
 * Trace code execution on Vercel Sandbox
 *
 * Writes the tracer script to the sandbox, executes the code with tracing,
 * and returns the execution trace.
 *
 * @param sessionId - Session ID (for sandbox lookup)
 * @param code - Python code to trace
 * @param options - Trace options (stdin, maxSteps)
 * @returns Execution trace
 */
export async function traceOnVercelSandbox(
  sessionId: string,
  code: string,
  options: TraceOptions = {}
): Promise<ExecutionTrace> {
  const startTime = Date.now();
  const { stdin = '', maxSteps = DEFAULT_MAX_STEPS } = options;

  try {
    const sandbox = await getSandbox(sessionId);

    // Write tracer script and code to sandbox
    const filesToWrite: Array<{ path: string; content: Buffer }> = [
      { path: TRACER_PATH, content: Buffer.from(TRACER_SCRIPT) },
    ];

    await sandbox.writeFiles(filesToWrite);

    // Execute tracer with timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXECUTION_TIMEOUT_MS);

    try {
      const result = await sandbox.runCommand({
        cmd: 'python3',
        args: [TRACER_PATH, code, stdin, maxSteps.toString()],
        cwd: SANDBOX_CWD,
        signal: controller.signal,
      });

      const stdout = await result.stdout();
      const stderr = await result.stderr();
      const durationMs = Date.now() - startTime;

      // Parse JSON output from tracer
      try {
        const trace: ExecutionTrace = JSON.parse(stdout);

        logSandboxEvent({
          event: 'sandbox_trace',
          sessionId,
          durationMs,
          success: !trace.error,
          metadata: {
            totalSteps: trace.totalSteps,
            truncated: trace.truncated,
            codeLength: code.length,
            hasStderr: !!stderr,
          },
        });

        return trace;
      } catch {
        logSandboxEvent({
          event: 'sandbox_trace',
          sessionId,
          durationMs,
          success: false,
          error: 'Failed to parse trace output',
          metadata: { codeLength: code.length },
        });
        return {
          steps: [],
          totalSteps: 0,
          exitCode: 1,
          error: stderr || 'Failed to parse trace output',
          truncated: false,
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      logSandboxEvent({
        event: 'sandbox_trace',
        sessionId,
        durationMs,
        success: false,
        error: 'Trace execution timed out',
        errorCode: 'TIMEOUT',
        metadata: { codeLength: code.length },
      });
      return {
        steps: [],
        totalSteps: 0,
        exitCode: 1,
        error: `Trace execution timed out after ${EXECUTION_TIMEOUT_MS}ms`,
        truncated: false,
      };
    }

    // Handle sandbox errors
    if (error instanceof SandboxError) {
      logSandboxEvent({
        event: 'sandbox_trace',
        sessionId,
        durationMs,
        success: false,
        error: error.message,
        errorCode: error.code,
        metadata: { codeLength: code.length },
      });
      return {
        steps: [],
        totalSteps: 0,
        exitCode: 1,
        error: `Code tracing temporarily unavailable: ${error.message}`,
        truncated: false,
      };
    }

    logSandboxEvent({
      event: 'sandbox_trace',
      sessionId,
      durationMs,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: { codeLength: code.length },
    });

    return {
      steps: [],
      totalSteps: 0,
      exitCode: 1,
      error: `Failed to trace code: ${error instanceof Error ? error.message : 'Unknown error'}`,
      truncated: false,
    };
  }
}
