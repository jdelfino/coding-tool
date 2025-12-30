import { spawn } from 'child_process';
import * as path from 'path';
import { ExecutionTrace } from './types';

const DEFAULT_MAX_STEPS = 5000;
const TRACE_TIMEOUT = 10000; // 10 seconds

export interface TraceOptions {
  stdin?: string;
  maxSteps?: number;
}

export async function traceExecution(
  code: string,
  options: TraceOptions = {}
): Promise<ExecutionTrace> {
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

    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0 && code !== null) {
        // Non-zero exit but might still have valid trace data
        console.error('Tracer stderr:', errorData);
      }

      try {
        // Parse JSON output from tracer
        const result: ExecutionTrace = JSON.parse(outputData);
        resolve(result);
      } catch (error) {
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
