/**
 * Error message mapper utility
 *
 * Converts technical error messages to user-friendly messages
 * that users can understand and act upon.
 */

/**
 * Error type categories for classification
 */
export type ErrorCategory =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'permission'
  | 'validation'
  | 'notFound'
  | 'conflict'
  | 'server'
  | 'unknown';

/**
 * Result of error classification
 */
export interface ClassifiedError {
  category: ErrorCategory;
  userMessage: string;
  technicalMessage: string;
  isRetryable: boolean;
}

/**
 * Error pattern matchers for classification
 */
const errorPatterns: Array<{
  patterns: RegExp[];
  category: ErrorCategory;
  userMessage: string;
  isRetryable: boolean;
}> = [
  // Network errors
  {
    patterns: [
      /network/i,
      /fetch/i,
      /failed to fetch/i,
      /net::err/i,
      /econnrefused/i,
      /enotfound/i,
      /connection refused/i,
      /no internet/i,
      /offline/i,
    ],
    category: 'network',
    userMessage: 'Connection error. Please check your internet and try again.',
    isRetryable: true,
  },
  // Timeout errors (but not HTTP 504 which is a server error)
  {
    patterns: [
      /^timeout$/i,
      /timed out/i,
      /etimedout/i,
      /request.*timeout/i,
      /operation.*timeout/i,
      /connection.*timeout/i,
    ],
    category: 'timeout',
    userMessage: 'Request timed out. Please try again.',
    isRetryable: true,
  },
  // Authentication errors
  {
    patterns: [
      /unauthorized/i,
      /unauthenticated/i,
      /not authenticated/i,
      /invalid.*token/i,
      /token.*expired/i,
      /session.*expired/i,
      /please.*sign.*in/i,
      /login.*required/i,
      /401/,
    ],
    category: 'auth',
    userMessage: 'Your session has expired. Please sign in again.',
    isRetryable: false,
  },
  // Permission errors
  {
    patterns: [
      /forbidden/i,
      /permission.*denied/i,
      /access.*denied/i,
      /not.*authorized/i,
      /insufficient.*permission/i,
      /403/,
    ],
    category: 'permission',
    userMessage: 'You do not have permission to perform this action.',
    isRetryable: false,
  },
  // Validation errors
  {
    patterns: [
      /validation/i,
      /invalid.*input/i,
      /invalid.*format/i,
      /required.*field/i,
      /must.*be/i,
      /cannot.*be.*empty/i,
      /too.*long/i,
      /too.*short/i,
      /400/,
    ],
    category: 'validation',
    userMessage: 'Please check your input and try again.',
    isRetryable: false,
  },
  // Not found errors
  {
    patterns: [
      /not.*found/i,
      /does.*not.*exist/i,
      /no.*such/i,
      /404/,
    ],
    category: 'notFound',
    userMessage: 'The requested item could not be found.',
    isRetryable: false,
  },
  // Conflict errors
  {
    patterns: [
      /conflict/i,
      /already.*exists/i,
      /duplicate/i,
      /unique.*constraint/i,
      /foreign.*key/i,
      /409/,
    ],
    category: 'conflict',
    userMessage: 'This operation conflicts with existing data. Please try a different value.',
    isRetryable: false,
  },
  // Server errors
  {
    patterns: [
      /server.*error/i,
      /internal.*error/i,
      /500/,
      /502/,
      /503/,
      /504/,
      /service.*unavailable/i,
      /bad.*gateway/i,
    ],
    category: 'server',
    userMessage: 'The server is having trouble. Please try again in a moment.',
    isRetryable: true,
  },
];

/**
 * Classifies an error and returns user-friendly information
 *
 * @param error - The error to classify (Error object or string)
 * @returns ClassifiedError with category, user message, and retry info
 */
export function classifyError(error: Error | string): ClassifiedError {
  const technicalMessage = typeof error === 'string' ? error : error.message;
  const messageLower = technicalMessage.toLowerCase();

  for (const pattern of errorPatterns) {
    for (const regex of pattern.patterns) {
      if (regex.test(messageLower)) {
        return {
          category: pattern.category,
          userMessage: pattern.userMessage,
          technicalMessage,
          isRetryable: pattern.isRetryable,
        };
      }
    }
  }

  // Default to unknown error
  return {
    category: 'unknown',
    userMessage: 'Something went wrong. Please try again.',
    technicalMessage,
    isRetryable: true,
  };
}

/**
 * Gets a user-friendly error message from an error
 *
 * @param error - The error to get a message for
 * @returns A user-friendly error message string
 */
export function getUserFriendlyError(error: Error | string): string {
  return classifyError(error).userMessage;
}

/**
 * Checks if an error is likely retryable
 *
 * @param error - The error to check
 * @returns true if the error is likely transient and retryable
 */
export function isRetryableError(error: Error | string): boolean {
  return classifyError(error).isRetryable;
}

/**
 * Gets the error category
 *
 * @param error - The error to categorize
 * @returns The error category
 */
export function getErrorCategory(error: Error | string): ErrorCategory {
  return classifyError(error).category;
}
