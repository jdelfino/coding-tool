import { spawn } from 'child_process';
import { ExecutionResult, CodeSubmission } from './types';

const DEFAULT_TIMEOUT = 10000; // 10 seconds

export async function executeCode(
  submission: CodeSubmission,
  timeout: number = DEFAULT_TIMEOUT
): Promise<ExecutionResult> {
  const { code, stdin } = submission;
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    
    // Spawn Python process
    const pythonProcess = spawn('python3', ['-c', code], {
      env: { ...process.env },
      timeout,
    });
    
    // Pipe stdin to the process if provided
    if (stdin !== undefined && stdin !== null) {
      pythonProcess.stdin.write(stdin);
      pythonProcess.stdin.end();
    }
    
    // Set up timeout handler
    const timeoutId = setTimeout(() => {
      timedOut = true;
      pythonProcess.kill('SIGTERM');
      
      // Force kill if it doesn't terminate
      setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill('SIGKILL');
        }
      }, 1000);
    }, timeout);
    
    // Capture stdout
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // Capture stderr
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Handle process completion
    pythonProcess.on('close', (exitCode) => {
      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;
      
      if (timedOut) {
        resolve({
          success: false,
          output: stdout,
          error: `Execution timed out after ${timeout}ms`,
          executionTime,
          stdin,
        });
        return;
      }
      
      const success = exitCode === 0 && stderr.length === 0;
      
      resolve({
        success,
        output: stdout,
        error: stderr,
        executionTime,
        stdin, // Include stdin in the result
      });
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;
      
      resolve({
        success: false,
        output: stdout,
        error: `Failed to execute code: ${error.message}`,
        executionTime,
        stdin,
      });
    });
  });
}

/**
 * Sanitize error messages to remove sensitive information
 */
export function sanitizeError(error: string): string {
  // Remove file paths from error messages
  return error
    .replace(/File ".*?", line/g, 'File "<student code>", line')
    .replace(/\[Errno \d+\]/g, '[Error]');
}

/**
 * Execute code with sanitized errors
 */
export async function executeCodeSafe(
  submission: CodeSubmission,
  timeout?: number
): Promise<ExecutionResult> {
  const result = await executeCode(submission, timeout);
  
  if (!result.success && result.error) {
    result.error = sanitizeError(result.error);
  }
  
  return result;
}
