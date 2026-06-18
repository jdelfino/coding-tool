/**
 * Ephemeral Code Execution Utility
 *
 * Provides code execution without associating with a session.
 * Used for:
 * - Instructor preview when creating/editing problems
 * - Practice mode in completed sessions
 *
 * Delegates to the executor service (local nsjail backend) without a sessionId.
 */

import { CodeSubmission, ExecutionResult } from './interfaces';
import { getExecutorService } from './executor-service';

/**
 * Execute code without a session association.
 *
 * @param submission - Code and execution settings
 * @param timeout - Optional timeout in milliseconds
 * @returns Execution result
 */
export async function executeEphemeral(
  submission: CodeSubmission,
  timeout?: number
): Promise<ExecutionResult> {
  return getExecutorService().executeCode(submission, timeout);
}
