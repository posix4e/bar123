import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e-interop',
  fullyParallel: false, // Run tests sequentially for extension testing
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for extension tests
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['list']
  ],
  
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chrome-to-chrome',
      testDir: './test/e2e-interop/js-js',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      }
    },
    {
      name: 'cross-platform',
      testDir: './test/e2e-interop/swift-js',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      },
      timeout: 120000 // 2 minutes for cross-platform tests
    }
  ],

  // Global setup for building extensions
  globalSetup: './test/e2e-interop/global-setup.js'
});