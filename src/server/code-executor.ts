import { spawn } from 'child_process';
import { ExecutionResult, CodeSubmission } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { executeInSandbox } from './vercel-sandbox';

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const MAX_FILE_SIZE = 10 * 1024; // 10KB per file
const MAX_FILES = 5;

export async function executeCode(
  submission: CodeSubmission,
  timeout: number = DEFAULT_TIMEOUT,
  sessionId?: string
): Promise<ExecutionResult> {
  // Use sandbox abstraction for environment-based execution
  if (sessionId) {
    const sandboxResult = await executeInSandbox(sessionId, submission);
    if (sandboxResult !== null) {
      // Sandbox handled execution (either Vercel sandbox or "not available" error)
      return sandboxResult;
    }
    // sandboxResult === null means local development - continue with local execution
  } else {
    // No sessionId provided - use legacy Vercel check for backward compatibility
    if (process.env.VERCEL && !process.env.VERCEL_SANDBOX_ENABLED) {
      return {
        success: false,
        output: '',
        error: 'Code execution is not yet available in production. Coming soon!',
        executionTime: 0,
        stdin: submission.executionSettings?.stdin,
      };
    }
  }

  const { code, executionSettings } = submission;
  const stdin = executionSettings?.stdin;
  const randomSeed = executionSettings?.randomSeed;
  const attachedFiles = executionSettings?.attachedFiles;
  const startTime = Date.now();
  
  // Create temporary directory for attached files
  let tempDir: string | null = null;
  if (attachedFiles && attachedFiles.length > 0) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-tool-'));
    
    // Validate and write attached files
    try {
      validateAttachedFiles(attachedFiles);
      for (const file of attachedFiles) {
        const sanitizedName = sanitizeFilename(file.name);
        const filePath = path.join(tempDir, sanitizedName);
        fs.writeFileSync(filePath, file.content, 'utf-8');
      }
    } catch (error: any) {
      // Clean up temp directory on error
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('Failed to cleanup temp directory:', cleanupError);
        }
      }
      
      return {
        success: false,
        output: '',
        error: `File attachment error: ${error.message}`,
        executionTime: Date.now() - startTime,
        stdin,
      };
    }
  }
  
  // Inject random seed if provided
  let executionCode = code;
  if (randomSeed !== undefined) {
    const seedInjection = `import random\nrandom.seed(${randomSeed})\n`;
    executionCode = seedInjection + code;
  }
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    
    // Spawn Python process with optional working directory
    const spawnOptions: any = {
      env: { ...process.env },
      timeout,
    };
    
    if (tempDir) {
      spawnOptions.cwd = tempDir;
    }
    
    const pythonProcess = spawn('python3', ['-c', executionCode], spawnOptions);
    
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
      
      // Clean up temp directory
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (error) {
          console.error('Failed to cleanup temp directory:', error);
        }
      }
      
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
      
      // Clean up temp directory
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('Failed to cleanup temp directory:', cleanupError);
        }
      }
      
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
 * Validate attached files
 */
function validateAttachedFiles(files: Array<{ name: string; content: string }>): void {
  if (files.length > MAX_FILES) {
    throw new Error(`Too many files attached (max ${MAX_FILES})`);
  }
  
  for (const file of files) {
    if (!file.name || !file.content) {
      throw new Error('Invalid file: name and content are required');
    }
    
    const size = Buffer.byteLength(file.content, 'utf-8');
    if (size > MAX_FILE_SIZE) {
      throw new Error(`File "${file.name}" exceeds size limit (${MAX_FILE_SIZE} bytes)`);
    }
  }
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and parent directory references
  const sanitized = filename
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\.+/, '_');
  
  // Ensure filename is not empty
  if (!sanitized || sanitized.trim() === '') {
    return 'unnamed_file.txt';
  }
  
  return sanitized;
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
 *
 * @param submission - Code submission with code and execution settings
 * @param timeout - Optional timeout in milliseconds (defaults to 10s)
 * @param sessionId - Optional session ID for Vercel Sandbox integration
 */
export async function executeCodeSafe(
  submission: CodeSubmission,
  timeout?: number,
  sessionId?: string
): Promise<ExecutionResult> {
  const result = await executeCode(submission, timeout, sessionId);

  if (!result.success && result.error) {
    result.error = sanitizeError(result.error);
  }

  return result;
}
