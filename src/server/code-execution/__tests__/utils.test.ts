import {
  sanitizeError,
  sanitizeFilename,
  validateAttachedFiles,
  DEFAULT_TIMEOUT,
  MAX_FILE_SIZE,
  MAX_FILES,
} from '../utils';

describe('code-execution utils', () => {
  describe('constants', () => {
    it('should export DEFAULT_TIMEOUT as 10000ms', () => {
      expect(DEFAULT_TIMEOUT).toBe(10000);
    });

    it('should export MAX_FILE_SIZE as 10KB', () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024);
    });

    it('should export MAX_FILES as 5', () => {
      expect(MAX_FILES).toBe(5);
    });
  });

  describe('sanitizeError', () => {
    it('should remove file paths from error messages', () => {
      const error = 'File "/tmp/foo.py", line 5, in <module>';
      const result = sanitizeError(error);
      expect(result).toBe('File "<student code>", line 5, in <module>');
    });

    it('should handle multiple file paths in an error', () => {
      const error = 'File "/tmp/foo.py", line 5\nFile "/home/user/bar.py", line 10';
      const result = sanitizeError(error);
      expect(result).toBe('File "<student code>", line 5\nFile "<student code>", line 10');
    });

    it('should replace errno numbers with generic error', () => {
      const error = '[Errno 2] No such file or directory';
      const result = sanitizeError(error);
      expect(result).toBe('[Error] No such file or directory');
    });

    it('should handle both file paths and errno in the same error', () => {
      const error = 'File "/tmp/code.py", line 1\n[Errno 13] Permission denied';
      const result = sanitizeError(error);
      expect(result).toBe('File "<student code>", line 1\n[Error] Permission denied');
    });

    it('should return unchanged string if no sensitive info present', () => {
      const error = 'NameError: name \'x\' is not defined';
      const result = sanitizeError(error);
      expect(result).toBe(error);
    });
  });

  describe('sanitizeFilename', () => {
    it('should return valid filenames unchanged', () => {
      expect(sanitizeFilename('data.txt')).toBe('data.txt');
      expect(sanitizeFilename('my_file.csv')).toBe('my_file.csv');
    });

    it('should replace forward slashes with underscores', () => {
      expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
    });

    it('should replace backslashes with underscores', () => {
      expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
    });

    it('should prevent parent directory traversal attacks', () => {
      // ../../../etc/passwd -> .._.._.._etc_passwd (slashes) -> ______etc_passwd (.. replaced)
      expect(sanitizeFilename('../../../etc/passwd')).toBe('______etc_passwd');
      // ..\\..\\windows\\system32 -> .._.._.._windows_system32 -> ______windows_system32
      expect(sanitizeFilename('..\\..\\..\\windows\\system32')).toBe('______windows_system32');
    });

    it('should replace leading dots', () => {
      expect(sanitizeFilename('.hidden')).toBe('_hidden');
      // ..hidden -> _hidden (.. replaced with _)
      expect(sanitizeFilename('..hidden')).toBe('_hidden');
      // ...hidden -> _.hidden (first .. replaced with _, leaving .hidden)
      expect(sanitizeFilename('...hidden')).toBe('_.hidden');
    });

    it('should return default name for empty input', () => {
      expect(sanitizeFilename('')).toBe('unnamed_file.txt');
    });

    it('should return default name for whitespace-only input', () => {
      expect(sanitizeFilename('   ')).toBe('unnamed_file.txt');
    });
  });

  describe('validateAttachedFiles', () => {
    it('should accept valid files within limits', () => {
      const files = [
        { name: 'file1.txt', content: 'hello' },
        { name: 'file2.txt', content: 'world' },
      ];
      expect(() => validateAttachedFiles(files)).not.toThrow();
    });

    it('should accept empty array', () => {
      expect(() => validateAttachedFiles([])).not.toThrow();
    });

    it('should accept exactly MAX_FILES files', () => {
      const files = Array.from({ length: MAX_FILES }, (_, i) => ({
        name: `file${i}.txt`,
        content: 'content',
      }));
      expect(() => validateAttachedFiles(files)).not.toThrow();
    });

    it('should throw error for too many files', () => {
      const files = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({
        name: `file${i}.txt`,
        content: 'content',
      }));
      expect(() => validateAttachedFiles(files)).toThrow(`Too many files attached (max ${MAX_FILES})`);
    });

    it('should throw error for file exceeding size limit', () => {
      const largeContent = 'x'.repeat(MAX_FILE_SIZE + 1);
      const files = [{ name: 'large.txt', content: largeContent }];
      expect(() => validateAttachedFiles(files)).toThrow(
        `File "large.txt" exceeds size limit (${MAX_FILE_SIZE} bytes)`
      );
    });

    it('should accept file at exactly MAX_FILE_SIZE', () => {
      const exactContent = 'x'.repeat(MAX_FILE_SIZE);
      const files = [{ name: 'exact.txt', content: exactContent }];
      expect(() => validateAttachedFiles(files)).not.toThrow();
    });

    it('should throw error for file without name', () => {
      const files = [{ name: '', content: 'content' }];
      expect(() => validateAttachedFiles(files)).toThrow('Invalid file: name and content are required');
    });

    it('should throw error for file without content', () => {
      const files = [{ name: 'file.txt', content: '' }];
      expect(() => validateAttachedFiles(files)).toThrow('Invalid file: name and content are required');
    });

    it('should correctly calculate multi-byte character sizes', () => {
      // Each emoji is typically 4 bytes in UTF-8
      const emojiContent = '\u{1F600}'.repeat(2560); // 2560 * 4 = 10240 bytes = exactly MAX_FILE_SIZE
      const files = [{ name: 'emoji.txt', content: emojiContent }];
      expect(() => validateAttachedFiles(files)).not.toThrow();

      const tooManyEmojis = '\u{1F600}'.repeat(2561); // One more emoji = over limit
      const overFiles = [{ name: 'emoji.txt', content: tooManyEmojis }];
      expect(() => validateAttachedFiles(overFiles)).toThrow(/exceeds size limit/);
    });
  });
});
