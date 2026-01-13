import { spawn } from 'child_process';
import * as path from 'path';
import { ExecutionTrace } from './types';
import { traceInSandbox, TraceOptions as SandboxTraceOptions } from './vercel-sandbox';

const DEFAULT_MAX_STEPS = 5000;
const TRACE_TIMEOUT = 10000; // 10 seconds

export interface TraceOptions {
  stdin?: string;
  maxSteps?: number;
}

/**
 * Trace code execution
 *
 * Uses sandbox abstraction for environment-based execution:
 * - On Vercel with sandbox enabled: Uses Vercel Sandbox
 * - On Vercel without sandbox: Returns error
 * - Locally: Spawns Python process with tracer script
 *
 * @param code - Python code to trace
 * @param options - Trace options (stdin, maxSteps)
 * @param sessionId - Optional session ID for Vercel Sandbox integration
 */
export async function traceExecution(
  code: string,
  options: TraceOptions = {},
  sessionId?: string
): Promise<ExecutionTrace> {
  // Use sandbox abstraction for environment-based tracing
  if (sessionId) {
    const sandboxOptions: SandboxTraceOptions = {
      stdin: options.stdin,
      maxSteps: options.maxSteps,
    };
    const sandboxResult = await traceInSandbox(sessionId, code, sandboxOptions);
    if (sandboxResult !== null) {
      // Sandbox handled tracing (either Vercel sandbox or "not available" error)
      return sandboxResult;
    }
    // sandboxResult === null means local development - continue with local tracing
  } else {
    // No sessionId provided - use legacy Vercel check for backward compatibility
    if (process.env.VERCEL && !process.env.VERCEL_SANDBOX_ENABLED) {
      return {
        steps: [],
        totalSteps: 0,
        exitCode: 1,
        error: 'Code tracing is not yet available in production. Coming soon!',
        truncated: false,
      };
    }
  }

  const { stdin = '', maxSteps = DEFAULT_MAX_STEPS } = options;

  return new Promise((resolve, reject) => {
    const tracerPath = path.join(__dirname, 'python-tracer.py');

    // Spawn Python process with tracer script
    const pythonProcess = spawn('python3', [
      tracerPath,
      code,
      stdin,
      maxSteps.toString()
    ]);

    let outputData = '';
    let errorData = '';

    // Set timeout
    const timeout = setTimeout(() => {
      pythonProcess.kill();
      reject(new Error('Trace execution timeout exceeded'));
    }, TRACE_TIMEOUT);

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (exitCode) => {
      clearTimeout(timeout);

      if (exitCode !== 0 && exitCode !== null) {
        // Non-zero exit but might still have valid trace data
        console.error('Tracer stderr:', errorData);
      }

      try {
        // Parse JSON output from tracer
        const result: ExecutionTrace = JSON.parse(outputData);
        resolve(result);
      } catch {
        // Failed to parse - return error trace
        resolve({
          steps: [],
          totalSteps: 0,
          exitCode: 1,
          error: errorData || 'Failed to parse trace output',
          truncated: false
        });
      }
    });

    pythonProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
