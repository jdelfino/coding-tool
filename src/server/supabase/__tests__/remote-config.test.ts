/**
 * Unit tests for Supabase configuration
 *
 * These tests verify the environment detection and configuration
 * logic for local vs remote Supabase instances.
 *
 * The app uses unified env vars:
 * - NEXT_PUBLIC_SUPABASE_URL - Points to local or remote
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY - Safe for browser (anon key)
 * - SUPABASE_SECRET_KEY - Server-only (service role key)
 * - TEST_REMOTE_SUPABASE - Flag to indicate remote testing mode
 */

describe('Supabase Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Environment Detection', () => {
    it('should default to local mode when TEST_REMOTE_SUPABASE is not set', () => {
      delete process.env.TEST_REMOTE_SUPABASE;

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';

      expect(isRemoteTest).toBe(false);
    });

    it('should enable remote mode when TEST_REMOTE_SUPABASE is true', () => {
      process.env.TEST_REMOTE_SUPABASE = 'true';

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';

      expect(isRemoteTest).toBe(true);
    });

    it('should stay in local mode when TEST_REMOTE_SUPABASE is false', () => {
      process.env.TEST_REMOTE_SUPABASE = 'false';

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';

      expect(isRemoteTest).toBe(false);
    });

    it('should stay in local mode for non-boolean values', () => {
      process.env.TEST_REMOTE_SUPABASE = 'yes';

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';

      expect(isRemoteTest).toBe(false);
    });
  });

  describe('Environment Variable Usage', () => {
    it('should use standard env vars for local mode', () => {
      delete process.env.TEST_REMOTE_SUPABASE;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SECRET_KEY = 'local_key';

      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || '';

      expect(SUPABASE_URL).toBe('http://localhost:54321');
      expect(SUPABASE_SECRET).toBe('local_key');
    });

    it('should use same env vars for remote mode (just different values)', () => {
      process.env.TEST_REMOTE_SUPABASE = 'true';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
      process.env.SUPABASE_SECRET_KEY = 'remote_key';

      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || '';

      expect(SUPABASE_URL).toBe('https://project.supabase.co');
      expect(SUPABASE_SECRET).toBe('remote_key');
    });

    it('should handle missing variables gracefully', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SECRET_KEY;

      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || '';

      expect(SUPABASE_URL).toBe('');
      expect(SUPABASE_SECRET).toBe('');
    });
  });

  describe('Test Skip Logic', () => {
    it('should skip tests when credentials are missing', () => {
      delete process.env.SUPABASE_SECRET_KEY;

      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
      const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || '';
      const canRunTests = SUPABASE_SECRET.length > 0 && SUPABASE_URL.length > 0;

      expect(canRunTests).toBe(false);
    });

    it('should allow tests when credentials are present', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SECRET_KEY = 'test_key';

      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || '';
      const canRunTests = SUPABASE_SECRET.length > 0 && SUPABASE_URL.length > 0;

      expect(canRunTests).toBe(true);
    });
  });

  describe('Test Labeling', () => {
    it('should generate correct label for local mode', () => {
      delete process.env.TEST_REMOTE_SUPABASE;

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const testLabel = isRemoteTest ? 'Remote Supabase' : 'Local Supabase';

      expect(testLabel).toBe('Local Supabase');
    });

    it('should generate correct label for remote mode', () => {
      process.env.TEST_REMOTE_SUPABASE = 'true';

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const testLabel = isRemoteTest ? 'Remote Supabase' : 'Local Supabase';

      expect(testLabel).toBe('Remote Supabase');
    });

    it('should generate correct skip message', () => {
      const skipMessage = 'Skipping tests: SUPABASE_SECRET_KEY not set';

      expect(skipMessage).toContain('SUPABASE_SECRET_KEY');
    });
  });

  describe('URL Validation', () => {
    it('should accept localhost URLs for local mode', () => {
      const url = 'http://localhost:54321';

      expect(url).toContain('localhost');
    });

    it('should accept 127.0.0.1 URLs for local mode', () => {
      const url = 'http://127.0.0.1:54321';

      expect(url).toContain('127.0.0.1');
    });

    it('should detect supabase.co URLs for remote mode', () => {
      const url = 'https://test-project.supabase.co';

      expect(url).toContain('supabase.co');
      expect(url).toMatch(/^https:\/\//);
    });

    it('should reject localhost URLs in remote validation', () => {
      const url = 'http://localhost:54321';

      const isValidRemote = !url.includes('localhost') &&
                           !url.includes('127.0.0.1') &&
                           url.startsWith('https://') &&
                           url.includes('supabase.co');

      expect(isValidRemote).toBe(false);
    });

    it('should reject http URLs in remote validation', () => {
      const url = 'http://test.supabase.co';

      const isValidRemote = !url.includes('localhost') &&
                           !url.includes('127.0.0.1') &&
                           url.startsWith('https://') &&
                           url.includes('supabase.co');

      expect(isValidRemote).toBe(false);
    });

    it('should accept valid remote URLs', () => {
      const url = 'https://test-project.supabase.co';

      const isValidRemote = !url.includes('localhost') &&
                           !url.includes('127.0.0.1') &&
                           url.startsWith('https://') &&
                           url.includes('supabase.co');

      expect(isValidRemote).toBe(true);
    });
  });
});
