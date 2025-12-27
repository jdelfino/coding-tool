import { test as baseTest } from '@playwright/test';
import { clearTestData } from './db-helpers';

/**
 * Extended test fixture that clears test data before each test
 */
export const test = baseTest.extend({
  // Automatically clear test data before each test
  page: async ({ page }, use) => {
    await clearTestData();
    await use(page);
  },
});

export { expect } from '@playwright/test';
