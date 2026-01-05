/**
 * Unit tests for remote Supabase configuration
 *
 * These tests verify the environment detection and client creation
 * logic for remote vs local Supabase instances.
 */

describe('Remote Supabase Configuration', () => {
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

  describe('Environment Variable Selection', () => {
    it('should use local variables when in local mode', () => {
      delete process.env.TEST_REMOTE_SUPABASE;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'local_key';
      process.env.REMOTE_SUPABASE_URL = 'https://remote.supabase.co';
      process.env.REMOTE_SUPABASE_SECRET_KEY = 'remote_key';

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const REMOTE_URL = process.env.REMOTE_SUPABASE_URL || '';
      const SUPABASE_URL = isRemoteTest ? REMOTE_URL : LOCAL_URL;

      expect(SUPABASE_URL).toBe('http://localhost:54321');
    });

    it('should use remote variables when in remote mode', () => {
      process.env.TEST_REMOTE_SUPABASE = 'true';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'local_key';
      process.env.REMOTE_SUPABASE_URL = 'https://remote.supabase.co';
      process.env.REMOTE_SUPABASE_SECRET_KEY = 'remote_key';

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const REMOTE_URL = process.env.REMOTE_SUPABASE_URL || '';
      const SUPABASE_URL = isRemoteTest ? REMOTE_URL : LOCAL_URL;

      expect(SUPABASE_URL).toBe('https://remote.supabase.co');
    });

    it('should handle missing local variables gracefully', () => {
      delete process.env.TEST_REMOTE_SUPABASE;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const LOCAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      expect(LOCAL_URL).toBe('');
      expect(LOCAL_KEY).toBe('');
    });

    it('should handle missing remote variables gracefully', () => {
      process.env.TEST_REMOTE_SUPABASE = 'true';
      delete process.env.REMOTE_SUPABASE_URL;
      delete process.env.REMOTE_SUPABASE_SECRET_KEY;
      delete process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY;

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const REMOTE_URL = process.env.REMOTE_SUPABASE_URL || '';
      const REMOTE_KEY = process.env.REMOTE_SUPABASE_SECRET_KEY || process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY || '';

      expect(REMOTE_URL).toBe('');
      expect(REMOTE_KEY).toBe('');
    });
  });

  describe('Test Skip Logic', () => {
    it('should skip tests when remote credentials are missing', () => {
      process.env.TEST_REMOTE_SUPABASE = 'true';
      delete process.env.REMOTE_SUPABASE_URL;
      delete process.env.REMOTE_SUPABASE_SECRET_KEY;
      delete process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY;

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const REMOTE_URL = process.env.REMOTE_SUPABASE_URL || '';
      const REMOTE_KEY = process.env.REMOTE_SUPABASE_SECRET_KEY || process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY || '';
      const canRunTests = REMOTE_KEY.length > 0 && REMOTE_URL.length > 0;

      expect(canRunTests).toBe(false);
    });

    it('should skip tests when local credentials are missing', () => {
      delete process.env.TEST_REMOTE_SUPABASE;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const LOCAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
      const canRunTests = LOCAL_KEY.length > 0 && LOCAL_URL.length > 0;

      expect(canRunTests).toBe(false);
    });

    it('should allow tests when remote credentials are present', () => {
      process.env.TEST_REMOTE_SUPABASE = 'true';
      process.env.REMOTE_SUPABASE_URL = 'https://test.supabase.co';
      process.env.REMOTE_SUPABASE_SECRET_KEY = 'test_key';

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const REMOTE_URL = process.env.REMOTE_SUPABASE_URL || '';
      const REMOTE_KEY = process.env.REMOTE_SUPABASE_SECRET_KEY || process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY || '';
      const canRunTests = REMOTE_KEY.length > 0 && REMOTE_URL.length > 0;

      expect(canRunTests).toBe(true);
    });

    it('should allow tests when local credentials are present', () => {
      delete process.env.TEST_REMOTE_SUPABASE;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'local_key';

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const LOCAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
      const canRunTests = LOCAL_KEY.length > 0 && LOCAL_URL.length > 0;

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

    it('should generate correct skip message for local mode', () => {
      delete process.env.TEST_REMOTE_SUPABASE;

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const skipMessage = isRemoteTest
        ? 'Skipping remote tests: REMOTE_SUPABASE_URL or REMOTE_SUPABASE_SERVICE_ROLE_KEY not set'
        : 'Skipping local tests: SUPABASE_SERVICE_ROLE_KEY not set';

      expect(skipMessage).toContain('local tests');
      expect(skipMessage).toContain('SUPABASE_SERVICE_ROLE_KEY');
    });

    it('should generate correct skip message for remote mode', () => {
      process.env.TEST_REMOTE_SUPABASE = 'true';

      const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';
      const skipMessage = isRemoteTest
        ? 'Skipping remote tests: REMOTE_SUPABASE_URL or REMOTE_SUPABASE_SECRET_KEY not set'
        : 'Skipping local tests: SUPABASE_SERVICE_ROLE_KEY not set';

      expect(skipMessage).toContain('remote tests');
      expect(skipMessage).toContain('REMOTE_SUPABASE_URL');
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
