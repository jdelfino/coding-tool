import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Support PORT override so worktree dev servers can run on a non-default port
// without colliding with a main-branch server already listening on 3000.
// Usage: PORT=3001 npm run test:e2e
// When PORT is unset, behaviour is unchanged: use 3000 and reuse any running server.
const serverPort = process.env.PORT || '3000';
const serverUrl = `http://localhost:${serverPort}`;

/**
 * Playwright configuration for E2E testing
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests in files in parallel - SAFE with namespace isolation */
  fullyParallel: true,

  /* CI uses production build (stable under load); dev server needs fewer workers */
  workers: process.env.CI ? undefined : 2,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* No retries - flaky tests should fail immediately so they get fixed */
  retries: 0,

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: serverUrl,

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot only on failure */
    screenshot: 'only-on-failure',

    /* Video only on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for Chromium only */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    // Use production build in CI for stability, dev mode locally for speed
    command: process.env.CI ? 'npm run build && npm start' : 'npm run dev',
    url: serverUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
    // Pass environment variables to the dev server subprocess
    env: {
      ...process.env,
      PORT: serverPort,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || '',
      SYSTEM_ADMIN_EMAIL: process.env.SYSTEM_ADMIN_EMAIL || 'admin@test.local',
    },
  },

  /* Test timeout */
  timeout: 30 * 1000, // 30 seconds per test
});
