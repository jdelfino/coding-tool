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
import { ExecutionResult, CodeSubmission } from '../types';

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

    return sandbox.sandboxId;
  } catch (error) {
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
  const supabase = getSupabaseClient();

  // Fetch sandbox ID from Supabase
  const { data, error } = await supabase
    .from('session_sandboxes')
    .select('sandbox_id')
    .eq('session_id', sessionId)
    .single();

  if (error || !data) {
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
      return sandbox;
    }

    // Sandbox has timed out or failed - recreate
    console.log(`Sandbox ${data.sandbox_id} status is ${sandbox.status}, recreating...`);
    return await recreateSandbox(sessionId, data.sandbox_id);
  } catch (error) {
    // Sandbox may not exist anymore - try to recreate
    console.log(`Failed to reconnect to sandbox ${data.sandbox_id}, recreating...`, error);
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
        throw new SandboxError(
          'Failed to get sandbox after race condition',
          'RECONNECTION_FAILED',
          sessionId
        );
      }

      return await Sandbox.get({ sandboxId: winner.sandbox_id });
    }

    return newSandbox;
  } catch (error) {
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

      return {
        success: result.exitCode === 0 && stderr.length === 0,
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
      return {
        success: false,
        output: '',
        error: `Code execution temporarily unavailable: ${error.message}`,
        executionTime,
        stdin,
      };
    }

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
      return;
    }

    // Stop sandbox (best effort)
    try {
      const sandbox = await Sandbox.get({ sandboxId: data.sandbox_id });
      if (sandbox.status === 'running') {
        await sandbox.stop();
      }
    } catch (error) {
      console.log(`Failed to stop sandbox ${data.sandbox_id} (may already be stopped):`, error);
    }

    // Delete record (ON DELETE CASCADE handles this when session is deleted,
    // but we clean up explicitly for session end without deletion)
    await supabase
      .from('session_sandboxes')
      .delete()
      .eq('session_id', sessionId);
  } catch (error) {
    console.error(`Failed to cleanup sandbox for session ${sessionId}:`, error);
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
