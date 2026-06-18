/**
 * Code Execution Module
 *
 * This module provides a pluggable code execution abstraction layer.
 * It supports multiple backends (local Python, disabled) with automatic
 * selection based on environment and capabilities.
 *
 * Usage:
 *   import { getExecutorService } from '@/server/code-execution';
 *   const result = await getExecutorService().executeCode({ code: 'print("hello")' });
 *
 * Backend selection order (first available wins):
 *   1. local-python - executes via the local sandbox (nsjail)
 *   2. disabled - fallback when no execution available
 */

import { getBackendRegistry } from './registry';
import { LocalPythonBackend } from './backends/local-python-backend';
import { DisabledBackend } from './backends/disabled-backend';
import { SupabaseBackendStateRepository } from './supabase-state-repository';

// Register all backends on module load
const registry = getBackendRegistry();

// Only register if not already registered (prevents double-registration on hot reload)
if (registry.list().length === 0) {
  // Local Python - executes code in the local sandbox (nsjail). The only
  // real execution backend.
  registry.register({
    type: 'local-python',
    factory: () => new LocalPythonBackend(),
    isAvailable: () => true,
    capabilities: {
      execute: true,
      trace: true,
      attachedFiles: true,
      stdin: true,
      randomSeed: true,
      stateful: false,
      requiresWarmup: false,
    },
  });

  // Disabled - fallback when no execution available
  registry.register({
    type: 'disabled',
    factory: () => new DisabledBackend(),
    isAvailable: () => true, // Always available as fallback
    capabilities: {
      execute: false,
      trace: false,
      attachedFiles: false,
      stdin: false,
      randomSeed: false,
      stateful: false,
      requiresWarmup: false,
    },
  });
}

// Re-export everything
export { ExecutorService, getExecutorService, resetExecutorService } from './executor-service';
export { BackendRegistry, getBackendRegistry } from './registry';
export type { BackendRegistration, BackendSelector } from './registry';
export { SupabaseBackendStateRepository } from './supabase-state-repository';
export type {
  ICodeExecutionBackend,
  ISessionScopedBackend,
  IBackendStateRepository,
  BackendCapabilities,
  BackendStatus,
  ExecuteOptions,
  TraceOptions,
  CodeSubmission,
  ExecutionResult,
  ExecutionTrace,
} from './interfaces';
export { LocalPythonBackend, DisabledBackend } from './backends';
export {
  DEFAULT_TIMEOUT,
  MAX_FILE_SIZE,
  MAX_FILES,
  validateAttachedFiles,
  sanitizeFilename,
  sanitizeError,
} from './utils';
