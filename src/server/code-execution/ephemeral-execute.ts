/**
 * Ephemeral Code Execution Utility
 *
 * Provides code execution without associating with a session.
 * Used for:
 * - Instructor preview when creating/editing problems
 * - Practice mode in completed sessions
 *
 * Local dev: Uses executor service without sessionId
 * Vercel prod: Creates ephemeral sandbox, executes, destroys immediately
 */

import { Sandbox } from '@vercel/sandbox';
import { CodeSubmission, ExecutionResult } from './interfaces';
import { getExecutorService } from './executor-service';
import { sanitizeFilename, truncateOutput, sanitizeError, INPUT_ECHO_PREAMBLE } from './utils';

// Sandbox timeout: 60 seconds (short-lived for ephemeral execution)
const SANDBOX_TIMEOUT_MS = 60_000;

// Default execution timeout: 10 seconds
const DEFAULT_EXECUTION_TIMEOUT_MS = 10_000;

// Max execution timeout: 30 seconds
const MAX_EXECUTION_TIMEOUT_MS = 30_000;

// Working directory for code execution
const SANDBOX_CWD = '/vercel/sandbox';

/**
 * Execute code in an ephemeral sandbox (no session association)
 *
 * @param submission - Code and execution settings
 * @param timeout - Optional timeout in milliseconds
 * @returns Execution result
 */
export async function executeEphemeral(
  submission: CodeSubmission,
  timeout?: number
): Promise<ExecutionResult> {
  // Local development or Vercel without sandbox: use executor service
  if (process.env.VERCEL !== '1' || process.env.VERCEL_SANDBOX_ENABLED !== '1') {
    return getExecutorService().executeCode(submission, timeout);
  }

  // Vercel production: use ephemeral sandbox
  let sandbox: Sandbox | null = null;
  const startTime = Date.now();

  try {
    // Clamp timeout
    const effectiveTimeout = Math.min(
      timeout ?? DEFAULT_EXECUTION_TIMEOUT_MS,
      MAX_EXECUTION_TIMEOUT_MS
    );

    // Create ephemeral sandbox
    sandbox = await Sandbox.create({
      runtime: 'python3.13',
      timeout: SANDBOX_TIMEOUT_MS,
    });

    const { code, executionSettings } = submission;
    const { stdin, randomSeed, attachedFiles } = executionSettings || {};

    // Prepare code with random seed injection if needed
    let executionCode = code;
    if (randomSeed !== undefined) {
      const seedInjection = `import random\nrandom.seed(${randomSeed})\n`;
      executionCode = seedInjection + code;
    }
    // Inject input echo wrapper so stdin values appear in output
    executionCode = INPUT_ECHO_PREAMBLE + executionCode;

    // Build files to write
    const filesToWrite: Array<{ path: string; content: Buffer }> = [
      { path: 'main.py', content: Buffer.from(executionCode) },
    ];

    // Add stdin file if provided
    if (stdin !== undefined && stdin !== null) {
      filesToWrite.push({ path: '/tmp/stdin.txt', content: Buffer.from(stdin) });
    }

    // Add attached files
    if (attachedFiles && Array.isArray(attachedFiles)) {
      for (const file of attachedFiles) {
        if (file.name && file.content) {
          const sanitizedName = sanitizeFilename(file.name);
          filesToWrite.push({ path: sanitizedName, content: Buffer.from(file.content) });
        }
      }
    }

    // Write all files
    await sandbox.writeFiles(filesToWrite);

    // Execute with timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      // Vercel Sandbox runCommand doesn't support stdin piping, so when
      // stdin is provided we use shell redirection from the stdin file.
      const hasStdin = stdin !== undefined && stdin !== null;
      const result = await sandbox.runCommand({
        cmd: hasStdin ? 'bash' : 'python3',
        args: hasStdin
          ? ['-c', 'python3 main.py < /tmp/stdin.txt']
          : ['main.py'],
        cwd: SANDBOX_CWD,
        signal: controller.signal,
      });

      const stdout = await result.stdout();
      const stderr = await result.stderr();
      const executionTime = Date.now() - startTime;
      const success = result.exitCode === 0 && stderr.length === 0;

      return {
        success,
        output: truncateOutput(stdout),
        error: success ? '' : sanitizeError(truncateOutput(stderr)),
        executionTime,
        stdin,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: unknown) {
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        output: '',
        error: 'Execution timed out',
        executionTime: Date.now() - startTime,
      };
    }

    throw error;
  } finally {
    // Always destroy sandbox
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch (e) {
        console.error('Failed to stop sandbox:', e);
      }
    }
  }
}
