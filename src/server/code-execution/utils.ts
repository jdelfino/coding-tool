/**
 * Shared utilities for code execution
 */

export const DEFAULT_TIMEOUT = 10000; // 10 seconds
export const MAX_FILE_SIZE = 10 * 1024; // 10KB per file
export const MAX_FILES = 5;

/**
 * Validate attached files
 */
export function validateAttachedFiles(files: Array<{ name: string; content: string }>): void {
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
export function sanitizeFilename(filename: string): string {
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
