/**
 * Shared types for instructor session components.
 */

export interface Student {
  id: string;
  name: string;
  hasCode: boolean;
  executionSettings?: {
    randomSeed?: number;
    stdin?: string;
    attachedFiles?: Array<{ name: string; content: string }>;
  };
}

export interface RealtimeStudent {
  id: string;
  name: string;
  code?: string;
  executionSettings?: {
    randomSeed?: number;
    stdin?: string;
    attachedFiles?: Array<{ name: string; content: string }>;
  };
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  executionTime: number;
}
