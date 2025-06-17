import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  // Only run CI tests in CI environment
  testMatch: process.env.CI ? '**/chrome-extension-ci.spec.ts' : '**/*.spec.ts',
  use: {
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'on',
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Launch Chrome with extension loading capabilities
        launchOptions: {
          args: [
            '--disable-blink-features=AutomationControlled',
          ]
        }
      },
    },
  ],
});