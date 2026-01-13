/**
 * Sandbox Abstraction Layer
 *
 * Provides environment-based selection between Vercel Sandbox (production)
 * and local execution (development).
 *
 * Usage:
 * - Session creation: if (shouldUseVercelSandbox()) await createSandboxForSession(sessionId)
 * - Execution: await executeInSandbox(sessionId, submission)
 */

import { ExecutionResult, CodeSubmission } from '../types';
import {
  createSessionSandbox,
  executeOnVercelSandbox,
  cleanupSandbox as cleanupVercelSandbox,
  hasSandbox,
  SandboxError,
} from './vercel-executor';

// Re-export for convenience
export { SandboxError };

/**
 * Check if we should use Vercel Sandbox
 *
 * Returns true when:
 * - Running on Vercel (process.env.VERCEL is set)
 * - Vercel Sandbox is enabled (VERCEL_SANDBOX_ENABLED is set)
 */
export function shouldUseVercelSandbox(): boolean {
  return Boolean(process.env.VERCEL && process.env.VERCEL_SANDBOX_ENABLED);
}

/**
 * Check if running on Vercel (regardless of sandbox status)
 */
export function isVercelEnvironment(): boolean {
  return Boolean(process.env.VERCEL);
}

/**
 * Create a sandbox for a session
 *
 * Only creates a sandbox on Vercel when sandbox is enabled.
 * On local development, this is a no-op.
 *
 * @param sessionId - Session ID
 * @returns Sandbox ID if created, null otherwise
 */
export async function createSandboxForSession(sessionId: string): Promise<string | null> {
  if (!shouldUseVercelSandbox()) {
    return null;
  }

  return await createSessionSandbox(sessionId);
}

/**
 * Execute code in the appropriate sandbox
 *
 * - On Vercel with sandbox enabled: Uses Vercel Sandbox
 * - On Vercel without sandbox: Returns error (code execution disabled)
 * - Locally: Falls through to allow normal execution (handled elsewhere)
 *
 * @param sessionId - Session ID (for Vercel Sandbox lookup)
 * @param submission - Code submission
 * @returns Execution result, or null to indicate local execution should be used
 */
export async function executeInSandbox(
  sessionId: string,
  submission: CodeSubmission
): Promise<ExecutionResult | null> {
  // On Vercel with sandbox enabled: use Vercel Sandbox
  if (shouldUseVercelSandbox()) {
    // Check if session has a sandbox (should have been created on session creation)
    const sessionHasSandbox = await hasSandbox(sessionId);

    if (!sessionHasSandbox) {
      // This shouldn't happen - sandbox should be created on session creation
      // Try to create one now as a fallback
      console.warn(`Session ${sessionId} missing sandbox, creating one now...`);
      try {
        await createSessionSandbox(sessionId);
      } catch (error) {
        return {
          success: false,
          output: '',
          error: 'Code execution temporarily unavailable. Please try again.',
          executionTime: 0,
          stdin: submission.executionSettings?.stdin,
        };
      }
    }

    return await executeOnVercelSandbox(sessionId, submission);
  }

  // On Vercel without sandbox enabled: code execution is disabled
  if (isVercelEnvironment()) {
    return {
      success: false,
      output: '',
      error: 'Code execution is not yet available in production. Coming soon!',
      executionTime: 0,
      stdin: submission.executionSettings?.stdin,
    };
  }

  // Local development: return null to indicate local execution should be used
  return null;
}

/**
 * Cleanup sandbox when session ends
 *
 * Only cleans up on Vercel when sandbox is enabled.
 * On local development, this is a no-op.
 *
 * @param sessionId - Session ID
 */
export async function cleanupSandbox(sessionId: string): Promise<void> {
  if (!shouldUseVercelSandbox()) {
    return;
  }

  await cleanupVercelSandbox(sessionId);
}
