const path = require('path');

/**
 * Setup a browser context with the extension loaded
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{context: import('@playwright/test').BrowserContext, extensionId: string}>}
 */
async function setupExtension(browser) {
    const pathToExtension = path.join(__dirname, '../..');
    
    const context = await browser.newContext({
        args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`
        ],
        // Needed for extension APIs
        permissions: ['clipboard-read', 'clipboard-write']
    });

    // Get extension ID
    let extensionId;
    const backgroundPages = context.serviceWorkers();
    const backgroundPage = backgroundPages.find(worker => worker.url().startsWith('chrome-extension://'));
    
    if (backgroundPage) {
        const url = new URL(backgroundPage.url());
        extensionId = url.hostname;
    } else {
        // Fallback: navigate to chrome://extensions to get ID
        const page = await context.newPage();
        await page.goto('chrome://extensions');
        // This would require more complex logic to extract the ID
        // For now, we'll use a placeholder
        extensionId = 'test-extension-id';
        await page.close();
    }

    return { context, extensionId };
}

/**
 * Generate a random shared secret
 * @returns {string}
 */
function generateSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

/**
 * Wait for a specific number of milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    setupExtension,
    generateSecret,
    wait
};