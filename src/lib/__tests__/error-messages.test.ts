/**
 * Unit tests for error message mapper utility
 */

import {
  classifyError,
  getUserFriendlyError,
  isRetryableError,
  getErrorCategory,
  ErrorCategory,
} from '../error-messages';

describe('error-messages', () => {
  describe('classifyError', () => {
    describe('network errors', () => {
      it.each([
        ['Network error'],
        ['Failed to fetch'],
        ['net::ERR_CONNECTION_REFUSED'],
        ['ECONNREFUSED'],
        ['ENOTFOUND'],
        ['Connection refused'],
        ['No internet connection'],
        ['offline'],
      ])('should classify "%s" as network error', (message) => {
        const result = classifyError(new Error(message));
        expect(result.category).toBe('network');
        expect(result.userMessage).toBe('Connection error. Please check your internet and try again.');
        expect(result.isRetryable).toBe(true);
      });
    });

    describe('timeout errors', () => {
      it.each([
        ['Timeout'],
        ['Request timed out'],
        ['Operation timed out'],
        ['ETIMEDOUT'],
        ['Connection timeout error'],
      ])('should classify "%s" as timeout error', (message) => {
        const result = classifyError(new Error(message));
        expect(result.category).toBe('timeout');
        expect(result.userMessage).toBe('Request timed out. Please try again.');
        expect(result.isRetryable).toBe(true);
      });
    });

    describe('authentication errors', () => {
      it.each([
        ['Unauthorized'],
        ['Not authenticated'],
        ['Invalid token'],
        ['Token expired'],
        ['Session expired'],
        ['Please sign in'],
        ['Login required'],
        ['401 Unauthorized'],
      ])('should classify "%s" as auth error', (message) => {
        const result = classifyError(new Error(message));
        expect(result.category).toBe('auth');
        expect(result.userMessage).toBe('Your session has expired. Please sign in again.');
        expect(result.isRetryable).toBe(false);
      });
    });

    describe('permission errors', () => {
      it.each([
        ['Forbidden'],
        ['Permission denied'],
        ['Access denied'],
        ['Not authorized to access'],
        ['Insufficient permissions'],
        ['403 Forbidden'],
      ])('should classify "%s" as permission error', (message) => {
        const result = classifyError(new Error(message));
        expect(result.category).toBe('permission');
        expect(result.userMessage).toBe('You do not have permission to perform this action.');
        expect(result.isRetryable).toBe(false);
      });
    });

    describe('validation errors', () => {
      it.each([
        ['Validation failed'],
        ['Invalid input'],
        ['Invalid format'],
        ['Required field missing'],
        ['Name must be unique'],
        ['Email cannot be empty'],
        ['Password too short'],
        ['Description too long'],
        ['400 Bad Request'],
      ])('should classify "%s" as validation error', (message) => {
        const result = classifyError(new Error(message));
        expect(result.category).toBe('validation');
        expect(result.userMessage).toBe('Please check your input and try again.');
        expect(result.isRetryable).toBe(false);
      });
    });

    describe('not found errors', () => {
      it.each([
        ['Not found'],
        ['Resource does not exist'],
        ['No such user'],
        ['404 Not Found'],
      ])('should classify "%s" as notFound error', (message) => {
        const result = classifyError(new Error(message));
        expect(result.category).toBe('notFound');
        expect(result.userMessage).toBe('The requested item could not be found.');
        expect(result.isRetryable).toBe(false);
      });
    });

    describe('conflict errors', () => {
      it.each([
        ['Conflict'],
        ['User already exists'],
        ['Duplicate key'],
        ['Unique constraint violation'],
        ['Foreign key violation'],
        ['409 Conflict'],
      ])('should classify "%s" as conflict error', (message) => {
        const result = classifyError(new Error(message));
        expect(result.category).toBe('conflict');
        expect(result.userMessage).toBe('This operation conflicts with existing data. Please try a different value.');
        expect(result.isRetryable).toBe(false);
      });
    });

    describe('server errors', () => {
      it.each([
        ['Server error'],
        ['Internal server error'],
        ['500 Internal Server Error'],
        ['502 Bad Gateway'],
        ['503 Service Unavailable'],
        ['504 Gateway Timeout'],
        ['Service unavailable'],
        ['Bad gateway'],
      ])('should classify "%s" as server error', (message) => {
        const result = classifyError(new Error(message));
        expect(result.category).toBe('server');
        expect(result.userMessage).toBe('The server is having trouble. Please try again in a moment.');
        expect(result.isRetryable).toBe(true);
      });
    });

    describe('unknown errors', () => {
      it('should classify unknown errors as unknown', () => {
        const result = classifyError(new Error('Something completely random'));
        expect(result.category).toBe('unknown');
        expect(result.userMessage).toBe('Something went wrong. Please try again.');
        expect(result.isRetryable).toBe(true);
      });
    });

    it('should handle string input', () => {
      const result = classifyError('Network error occurred');
      expect(result.category).toBe('network');
      expect(result.technicalMessage).toBe('Network error occurred');
    });

    it('should preserve technical message', () => {
      const message = 'ECONNREFUSED: Connection refused at localhost:3000';
      const result = classifyError(new Error(message));
      expect(result.technicalMessage).toBe(message);
    });
  });

  describe('getUserFriendlyError', () => {
    it('should return user-friendly message for Error', () => {
      const message = getUserFriendlyError(new Error('ECONNREFUSED'));
      expect(message).toBe('Connection error. Please check your internet and try again.');
    });

    it('should return user-friendly message for string', () => {
      const message = getUserFriendlyError('Connection timeout');
      expect(message).toBe('Request timed out. Please try again.');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true);
    });

    it('should return true for timeout errors', () => {
      expect(isRetryableError(new Error('Request timed out'))).toBe(true);
    });

    it('should return true for server errors', () => {
      expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
    });

    it('should return false for auth errors', () => {
      expect(isRetryableError(new Error('Unauthorized'))).toBe(false);
    });

    it('should return false for validation errors', () => {
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
    });

    it('should return true for unknown errors', () => {
      expect(isRetryableError(new Error('Random error'))).toBe(true);
    });
  });

  describe('getErrorCategory', () => {
    it('should return correct category for each error type', () => {
      expect(getErrorCategory(new Error('Network error'))).toBe('network');
      expect(getErrorCategory(new Error('Timeout'))).toBe('timeout');
      expect(getErrorCategory(new Error('Unauthorized'))).toBe('auth');
      expect(getErrorCategory(new Error('Forbidden'))).toBe('permission');
      expect(getErrorCategory(new Error('Invalid input'))).toBe('validation');
      expect(getErrorCategory(new Error('Not found'))).toBe('notFound');
      expect(getErrorCategory(new Error('Already exists'))).toBe('conflict');
      expect(getErrorCategory(new Error('Server error'))).toBe('server');
      expect(getErrorCategory(new Error('Random'))).toBe('unknown');
    });
  });
});
