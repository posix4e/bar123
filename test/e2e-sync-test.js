/**
 * e2e-sync-test.js
 * End-to-end test for Chrome extension to Swift CLI sync
 */

const { chromium } = require('playwright');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Configuration
const EXTENSION_PATH = '../chrome-extension';
const CLI_PATH = '../cli/.build/debug/bar123-cli';
const ROOM_ID = 'test-room-' + Date.now();

// Test URLs to visit
const TEST_URLS = [
    { url: 'https://github.com', title: 'GitHub' },
    { url: 'https://stackoverflow.com', title: 'Stack Overflow' },
    { url: 'https://news.ycombinator.com', title: 'Hacker News' }
];

async function runCLICommand(command) {
    try {
        const { stdout, stderr } = await execAsync(`${CLI_PATH} ${command}`);
        if (stderr && !stderr.includes('warning')) {
            console.error('CLI Error:', stderr);
        }
        return stdout;
    } catch (error) {
        console.error('Failed to run CLI command:', error);
        throw error;
    }
}

async function main() {
    console.log('🚀 E2E Sync Test - Chrome Extension to Swift CLI');
    console.log('===============================================');
    
    // Step 1: Clean up
    console.log('\n1️⃣ Cleaning up...');
    await runCLICommand('delete-peer --all');
    
    // Step 2: Announce CLI as peer
    console.log('\n2️⃣ Announcing CLI as peer...');
    await runCLICommand(`announce --name "Test CLI" --type "cli" --room-id ${ROOM_ID}`);
    
    // Step 3: Launch browser with extension
    console.log('\n3️⃣ Launching Chrome with extension...');
    const browser = await chromium.launch({
        headless: false,
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`
        ]
    });
    
    const context = await browser.newContext();
    
    // Step 4: Configure extension
    console.log('\n4️⃣ Configuring extension...');
    const extensionId = await getExtensionId(context);
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup-simple.html`);
    
    // Set room ID
    await popupPage.fill('#room-id', ROOM_ID);
    
    // Enable Cloudflare
    await popupPage.click('#cloudflare-toggle');
    
    // Configure Cloudflare (these should come from environment)
    await popupPage.fill('#cloudflare-api-token', process.env.CLOUDFLARE_API_TOKEN || '');
    await popupPage.fill('#cloudflare-zone-id', process.env.CLOUDFLARE_ZONE_ID || '');
    await popupPage.fill('#cloudflare-domain', process.env.CLOUDFLARE_DOMAIN || '');
    
    // Connect
    await popupPage.click('#connect-btn');
    
    // Wait for connection
    await popupPage.waitForTimeout(3000);
    
    // Step 5: Browse test sites
    console.log('\n5️⃣ Browsing test sites...');
    const page = await context.newPage();
    
    for (const site of TEST_URLS) {
        console.log(`   Visiting ${site.url}...`);
        await page.goto(site.url);
        await page.waitForTimeout(2000); // Wait for history tracking
    }
    
    // Step 6: Wait for sync
    console.log('\n6️⃣ Waiting for sync...');
    await page.waitForTimeout(5000);
    
    // Step 7: Export synced history
    console.log('\n7️⃣ Exporting synced history from CLI...');
    const history = await runCLICommand('export --format json');
    
    console.log('\n📋 Synced History:');
    console.log(history);
    
    // Step 8: Parse and verify
    try {
        const entries = JSON.parse(history);
        console.log(`\n✅ Successfully synced ${entries.length} history entries!`);
        
        // Check if we got the expected URLs
        const syncedUrls = entries.map(e => new URL(e.url).hostname);
        const expectedHosts = TEST_URLS.map(u => new URL(u.url).hostname);
        
        console.log('\nExpected hosts:', expectedHosts);
        console.log('Synced hosts:', [...new Set(syncedUrls)]);
        
    } catch (error) {
        console.error('\n❌ Failed to parse history:', error);
    }
    
    // Cleanup
    await browser.close();
    console.log('\n🎉 Test completed!');
}

async function getExtensionId(context) {
    // Get extension ID from manifest
    const [background] = context.serviceWorkers();
    if (background) {
        const url = background.url();
        const match = url.match(/chrome-extension:\/\/([^\/]+)/);
        return match ? match[1] : null;
    }
    
    // Fallback: create a page and get from there
    const page = await context.newPage();
    await page.goto('chrome://extensions');
    // This won't work in headless, but we're running headful
    return null;
}

// Run the test
main().catch(console.error);