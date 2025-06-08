// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 60 * 1000,
    expect: {
        timeout: 10000
    },
    fullyParallel: false, // Run tests sequentially for P2P testing
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1, // Single worker for P2P tests
    reporter: [
        ['html', { outputFolder: 'test-results/html' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['list']
    ],

    use: {
        actionTimeout: 0,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },

    projects: [
        {
            name: 'chromium-websocket',
            use: {
                ...devices['Desktop Chrome'],
                // Extension testing requires special setup
                launchOptions: {
                    args: [
                        `--disable-extensions-except=${process.cwd()}`,
                        `--load-extension=${process.cwd()}`
                    ]
                }
            },
            testMatch: '**/websocket-discovery.spec.js'
        },
        {
            name: 'chromium-stun',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    args: [
                        `--disable-extensions-except=${process.cwd()}`,
                        `--load-extension=${process.cwd()}`
                    ]
                }
            },
            testMatch: '**/stun-discovery.spec.js'
        }
    ],

    // Run signaling server before tests
    webServer: {
        command: 'node ../signaling-server/server.js',
        port: 8080,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe'
    }
});